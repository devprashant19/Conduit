/**
 * useWakeWord — always-on wake-word listening.
 *
 * Saying the configured wake phrase arms it and the next utterance is taken as
 * a command; saying "<phrase>, <command>" in one breath fires immediately.
 *
 * Two engines, chosen by `provider` — the same split as useSpeechInput:
 *
 *  - `'browser'`: the Web Speech API. Free, but Chrome/Edge only, and it
 *    streams audio to a Google service using API keys that Electron does not
 *    ship — so it fails with `error: 'network'` on every attempt inside the
 *    desktop app. That used to be swallowed as routine and retried forever,
 *    which is why the toggle could look on while nothing worked; repeated
 *    network failures now give up and report through `onUnavailable`.
 *
 *  - `'openai'` / `'gemini'`: capture the mic ourselves, cut it into
 *    utterances with a simple energy gate, and POST each one to
 *    `/api/voice/transcribe`. No Chromium speech service involved, so this
 *    works in the desktop app. Only actual speech is uploaded, but it is still
 *    a paid API call per utterance.
 */

import { useEffect, useRef, useState } from 'react';

const ARM_TIMEOUT = 9000;       // disarm if no command follows the wake phrase
/** Consecutive `network` errors before we stop retrying and say so. */
const NETWORK_GIVE_UP = 3;
/** Consecutive transcription failures before we stop — each one is billable. */
const TRANSCRIBE_GIVE_UP = 3;

// --- energy gate (cloud engine) ---------------------------------------
const VAD_POLL_MS = 50;
/** Silence after speech that ends an utterance. */
const SILENCE_MS = 800;
/** Ignore anything shorter — a cough should not cost an API call. */
const MIN_UTTERANCE_MS = 350;
/** Hard cap, so one long noise never uploads an enormous clip. */
const MAX_UTTERANCE_MS = 15_000;
/** Recycle the recorder during silence so its buffer cannot grow forever. */
const IDLE_RECYCLE_MS = 10_000;
/** Absolute floor, so a silent room never trips the gate. */
const MIN_SPEECH_RMS = 0.02;

export type WakeProvider = 'browser' | 'openai' | 'gemini';

interface WakeOptions {
  enabled: boolean;
  /** The wake phrase to listen for, in the same language as `language`. */
  phrase: string;
  /** BCP-47 tag for recognition, e.g. "en-US". Defaults to the browser language. */
  language?: string;
  /** Which engine to listen with. Defaults to the browser's Web Speech API. */
  provider?: WakeProvider;
  onWake: () => void;
  onCommand: (text: string) => void;
  /** Listening cannot work at all — the caller should switch the toggle off. */
  onUnavailable?: (reason: string) => void;
}

export function useWakeWord({
  enabled, phrase, language, provider = 'browser', onWake, onCommand, onUnavailable,
}: WakeOptions) {
  const [armed, setArmed] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armedRef = useRef(false);
  const phraseRef = useRef(phrase);
  const cbRef = useRef({ onWake, onCommand, onUnavailable });
  useEffect(() => { phraseRef.current = phrase; cbRef.current = { onWake, onCommand, onUnavailable }; });
  const lang = language || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en-US';

  const SR =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      : undefined;
  const mediaSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const supported = provider === 'browser' ? !!SR : mediaSupported;

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    const setArmedState = (v: boolean) => { armedRef.current = v; setArmed(v); };

    let armTimer: ReturnType<typeof setTimeout> | null = null;
    const clearArmTimer = () => { if (armTimer) { clearTimeout(armTimer); armTimer = null; } };

    /** Shared by both engines: match the phrase, arm, or fire a command. */
    const handleTranscript = (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      if (armedRef.current) {
        clearArmTimer();
        setArmedState(false);
        cbRef.current.onCommand(text);
        return;
      }
      const term = phraseRef.current.trim().toLowerCase();
      const hit = term ? text.toLowerCase().indexOf(term) : -1;
      if (hit < 0) return;
      // Strip the punctuation a transcriber puts between the wake phrase and
      // the command ("Jarvis. List the agents" / "Jarvis, list the agents").
      const after = text.slice(hit + term.length).replace(/^[\s.,;:!?，。、：！？]+/, '').trim();
      if (after) {
        cbRef.current.onCommand(after);
      } else {
        setArmedState(true);
        cbRef.current.onWake();
        clearArmTimer();
        armTimer = setTimeout(() => { armTimer = null; setArmedState(false); }, ARM_TIMEOUT);
      }
    };

    /** Give up for good, and tell the caller why. */
    const giveUp = (reason: string) => {
      if (stopped) return;
      stopped = true;
      setListening(false);
      setError(reason);
      cbRef.current.onUnavailable?.(reason);
    };

    // ── engine A: the browser's Web Speech API ───────────────────────────
    const runBrowser = () => {
      const Rec = SR as { new (): SpeechRecognitionLike } | undefined;
      if (!Rec) { giveUp('this browser has no speech recognition'); return () => {}; }

      let rec: SpeechRecognitionLike | null = null;
      let restartTimer: ReturnType<typeof setTimeout> | null = null;
      let restarts = 0;
      let networkErrors = 0;

      const scheduleRestart = () => {
        if (stopped || restartTimer) return;
        restarts += 1;
        const delay = Math.min(15_000, 600 * Math.pow(1.5, Math.min(restarts, 8)));
        restartTimer = setTimeout(() => { restartTimer = null; start(); }, delay);
      };

      const start = () => {
        if (stopped) return;
        let r: SpeechRecognitionLike;
        try { r = new Rec(); }
        catch (err) { giveUp('could not start speech recognition: ' + String(err)); return; }
        r.lang = lang;
        r.continuous = true;
        r.interimResults = false;
        r.onstart = () => { setListening(true); setError(null); restarts = 0; };
        r.onspeechstart = () => { /* no-op */ };
        r.onresult = (e: SpeechResultEvent) => {
          const last = e.results?.[e.results.length - 1];
          if (!last || !last.isFinal) return;
          networkErrors = 0;   // it is working — forget past transient failures
          handleTranscript(String(last[0]?.transcript || ''));
        };
        r.onerror = (ev: { error?: string }) => {
          const code = String(ev?.error || '');
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            giveUp('microphone blocked — allow mic access, then switch the wake word back on');
            return;
          }
          if (code === 'network') {
            // One or two of these are routine. A run of them means the speech
            // service is simply not reachable from this runtime, which is
            // always the case inside the Electron app.
            networkErrors += 1;
            if (networkErrors >= NETWORK_GIVE_UP) {
              giveUp(
                'speech recognition is unavailable in the desktop app. '
                + 'Pick OpenAI or Gemini under Voice settings to use the wake word here, '
                + 'or open Conduit at localhost:3200 in Chrome or Edge.',
              );
            }
          }
          // 'no-speech' / 'aborted' are normal during continuous listening.
        };
        r.onend = () => { rec = null; setListening(false); if (!stopped) scheduleRestart(); };
        rec = r;
        try { r.start(); }
        catch { rec = null; scheduleRestart(); }
      };

      start();
      return () => {
        if (restartTimer) clearTimeout(restartTimer);
        try { rec?.abort(); } catch { /* ignore */ }
        rec = null;
      };
    };

    // ── engine B: our own mic capture + /api/voice/transcribe ────────────
    const runCloud = () => {
      let stream: MediaStream | null = null;
      let audioCtx: AudioContext | null = null;
      let mr: MediaRecorder | null = null;
      let vadTimer: ReturnType<typeof setInterval> | null = null;
      let chunks: BlobPart[] = [];
      let segmentStart = 0;
      let speechStart = 0;
      let lastVoiceAt = 0;
      let noiseFloor = 0.005;
      let mime = '';

      /**
       * Send one utterance for transcription. Consecutive failures stop the
       * whole thing: an exhausted quota or a bad key would otherwise upload
       * every utterance forever, and each one is a billable request.
       */
      let failures = 0;
      const transcribe = async (blob: Blob) => {
        if (stopped || blob.size === 0) return;
        const fail = (msg: string) => {
          failures += 1;
          setError(msg);
          if (failures >= TRANSCRIBE_GIVE_UP) {
            giveUp(`speech-to-text keeps failing — ${msg.slice(0, 200)}`);
          }
        };
        try {
          const q = lang ? `?language=${encodeURIComponent(lang)}` : '';
          const res = await fetch('/api/voice/transcribe' + q, {
            method: 'POST',
            headers: { 'Content-Type': blob.type || 'audio/webm' },
            body: blob,
          });
          if (!res.ok) {
            let msg = `transcribe ${res.status}`;
            try { const j = await res.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
            fail(msg);
            return;
          }
          failures = 0;
          setError(null);
          const j = (await res.json()) as { text?: string };
          if (j.text) handleTranscript(j.text);
        } catch (err) {
          fail(err instanceof Error ? err.message : String(err));
        }
      };

      /** Close the current recording and start a fresh one. */
      const cut = (send: boolean) => {
        const rec = mr;
        if (!rec || !stream) return;
        const spoke = speechStart > 0;
        const durationMs = spoke ? Date.now() - speechStart : 0;
        speechStart = 0;
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
          chunks = [];
          if (send && spoke && durationMs >= MIN_UTTERANCE_MS) void transcribe(blob);
          if (!stopped) beginSegment();
        };
        try { rec.stop(); } catch { /* already stopped */ }
        mr = null;
      };

      const beginSegment = () => {
        if (stopped || !stream) return;
        let rec: MediaRecorder;
        try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
        catch (err) { giveUp('could not record audio: ' + String(err)); return; }
        chunks = [];
        segmentStart = Date.now();
        rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        rec.onerror = () => { /* the VAD loop will recycle */ };
        mr = rec;
        // A timeslice keeps chunks flowing so a cut never waits on a flush.
        rec.start(250);
        setListening(true);
      };

      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          });
        } catch {
          giveUp('microphone blocked — allow mic access, then switch the wake word back on');
          return;
        }
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

        mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
          .find((m) => MediaRecorder.isTypeSupported(m)) || '';

        const Ctx = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        audioCtx = new Ctx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);

        beginSegment();
        setError(null);

        vadTimer = setInterval(() => {
          if (stopped || !mr) return;
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);

          const now = Date.now();
          const speaking = rms > Math.max(MIN_SPEECH_RMS, noiseFloor * 2.5);
          if (speaking) {
            if (!speechStart) speechStart = now;
            lastVoiceAt = now;
          } else {
            // Only adapt the floor while quiet, so speech cannot raise it.
            noiseFloor = noiseFloor * 0.95 + rms * 0.05;
          }

          if (speechStart && now - speechStart > MAX_UTTERANCE_MS) { cut(true); return; }
          if (speechStart && !speaking && now - lastVoiceAt > SILENCE_MS) { cut(true); return; }
          if (!speechStart && now - segmentStart > IDLE_RECYCLE_MS) cut(false);
        }, VAD_POLL_MS);
      })();

      return () => {
        if (vadTimer) clearInterval(vadTimer);
        try { mr?.stop(); } catch { /* ignore */ }
        mr = null;
        chunks = [];
        try { void audioCtx?.close(); } catch { /* ignore */ }
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
      };
    };

    const teardown = provider === 'browser' ? runBrowser() : runCloud();

    return () => {
      stopped = true;
      clearArmTimer();
      setArmedState(false);
      setListening(false);
      teardown();
    };
  }, [SR, enabled, lang, provider]);

  return { supported, armed, listening, error };
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
