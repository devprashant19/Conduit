/**
 * useWakeWord — always-on wake-word listening via the Web Speech API.
 *
 * When enabled, runs a continuous SpeechRecognition. Saying the configured
 * wake phrase arms it and the next utterance is taken as a command; saying
 * "<phrase>, <command>" in one breath fires immediately.
 *
 * Chrome / Edge only, secure context only, foreground tab only. Chrome ends
 * continuous recognition periodically — it's restarted automatically.
 */

import { useEffect, useRef, useState } from 'react';

const ARM_TIMEOUT = 9000; // disarm if no command follows the wake phrase

interface WakeOptions {
  enabled: boolean;
  /** The wake phrase to listen for, in the same language as `language`. */
  phrase: string;
  /** BCP-47 tag for recognition, e.g. "en-US". Defaults to the browser language. */
  language?: string;
  onWake: () => void;
  onCommand: (text: string) => void;
}

export function useWakeWord({ enabled, phrase, language, onWake, onCommand }: WakeOptions) {
  const [armed, setArmed] = useState(false);
  const [listening, setListening] = useState(false);
  const armedRef = useRef(false);
  const phraseRef = useRef(phrase);
  const cbRef = useRef({ onWake, onCommand });
  useEffect(() => { phraseRef.current = phrase; cbRef.current = { onWake, onCommand }; });
  const lang = language || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en-US';

  const SR =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      : undefined;
  const supported = !!SR;

  useEffect(() => {
    const Rec = SR as { new (): SpeechRecognitionLike } | undefined;
    if (!Rec || !enabled) return;
    let stopped = false;
    let rec: SpeechRecognitionLike | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let armTimer: ReturnType<typeof setTimeout> | null = null;

    const setArmedState = (v: boolean) => { armedRef.current = v; setArmed(v); };
    const clearArmTimer = () => { if (armTimer) { clearTimeout(armTimer); armTimer = null; } };

    const handleResult = (e: SpeechResultEvent) => {
      const last = e.results?.[e.results.length - 1];
      if (!last || !last.isFinal) return;
      const raw = String(last[0]?.transcript || '').trim();
      if (!raw) return;

      if (armedRef.current) {
        clearArmTimer();
        setArmedState(false);
        cbRef.current.onCommand(raw);
        return;
      }
      const term = phraseRef.current.trim().toLowerCase();
      const hit = term ? raw.toLowerCase().indexOf(term) : -1;
      if (hit < 0) return;
      const after = raw.slice(hit + term.length).replace(/^[\s,，。、:：!！?？]+/, '').trim();
      if (after) {
        cbRef.current.onCommand(after);
      } else {
        setArmedState(true);
        cbRef.current.onWake();
        clearArmTimer();
        armTimer = setTimeout(() => {
          armTimer = null;
          setArmedState(false);
        }, ARM_TIMEOUT);
      }
    };

    let restarts = 0;
    const scheduleRestart = () => {
      if (stopped || restartTimer) return;
      // Back off if recognition keeps ending immediately (no mic, tab hidden…)
      restarts += 1;
      const delay = Math.min(15_000, 600 * Math.pow(1.5, Math.min(restarts, 8)));
      restartTimer = setTimeout(() => { restartTimer = null; start(); }, delay);
    };

    const start = () => {
      if (stopped) return;
      let r: SpeechRecognitionLike;
      try { r = new Rec(); }
      catch (err) { console.warn('[wake] could not create SpeechRecognition:', err); return; }
      r.lang = lang;
      r.continuous = true;
      r.interimResults = false; // matching only acts on final results — interim is noise
      r.onstart = () => { setListening(true); restarts = 0; };
      r.onspeechstart = () => { /* no-op */ };
      r.onresult = handleResult;
      r.onerror = (ev: { error?: string }) => {
        const code = String(ev?.error || '');
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          stopped = true;
          console.warn('[wake] microphone blocked — toggle wake word off and on after allowing mic access');
        }
        // 'no-speech' / 'aborted' / 'network' are normal during continuous listening — silent.
      };
      r.onend = () => { rec = null; setListening(false); if (!stopped) scheduleRestart(); };
      rec = r;
      try { r.start(); }
      catch { rec = null; scheduleRestart(); }
    };

    start();

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      clearArmTimer();
      setArmedState(false);
      setListening(false);
      try { rec?.abort(); } catch { /* ignore */ }
      rec = null;
    };
  }, [SR, enabled, lang]);

  return { supported, armed, listening };
}

// Minimal structural types for the Web Speech API (not in lib.dom for webkit).
interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onspeechstart: () => void;
  onresult: (e: SpeechResultEvent) => void;
  onerror: (e: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  abort: () => void;
}
