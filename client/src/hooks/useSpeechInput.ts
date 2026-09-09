/**
 * useSpeechInput — push-to-talk speech-to-text.
 *
 * Two modes, picked per call via `options.provider`:
 *  - `'browser'` (default): Web Speech API. Free, in-browser, Chrome/Edge only,
 *    needs a secure context (https or http://localhost).
 *  - `'openai'` / `'gemini'`: records the mic with MediaRecorder and POSTs the
 *    audio blob to `/api/voice/transcribe`, which proxies to the API. Cleaner
 *    Mandarin, costs API quota.
 *
 * Returned API is the same regardless of mode — `toggle()` starts/stops, and
 * `onText(text, final)` fires with the result.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { UtteranceAssembler } from '../utils/utterance';

/**
 * Quiet period that ends a spoken command.
 *
 * Long enough to survive thinking mid-sentence, short enough that the user
 * is not left waiting after they have finished. The recogniser's own
 * end-of-utterance is not usable for this: it fires at the first pause.
 */
const SETTLE_MS = 1100;

type SpeechResultHandler = (text: string, final: boolean) => void;
export interface SpeechOptions {
  provider?: 'browser' | 'openai' | 'gemini';
  language?: string;
}

function explainError(code: string, secure: boolean): string {
  if (!secure) return 'not a secure context — open Conduit via http://localhost, not an IP';
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'microphone blocked — allow mic access for this site';
    case 'no-speech':
      return 'no speech heard — check the mic is not muted / is the right device';
    case 'audio-capture':
      return 'no microphone found';
    case 'network':
      // Inside Electron this is not a network problem and never recovers:
      // Chromium proxies recognition to a Google service using API keys the
      // desktop build does not ship.
      return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
        ? 'browser speech recognition does not work in the desktop app — choose OpenAI or Gemini in Voice settings'
        : 'speech service unreachable — check the network';
    default:
      return code || 'unknown error';
  }
}

type Active =
  | { kind: 'browser'; obj: { stop: () => void } }
  | { kind: 'recorder'; obj: MediaRecorder; stream: MediaStream }
  | null;

export function useSpeechInput(onText: SpeechResultHandler, options: SpeechOptions = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<Active>(null);
  /** True between the user pressing stop and the engine actually ending. */
  const stoppingRef = useRef(false);
  const lastFinalRef = useRef('');
  const assemblerRef = useRef<UtteranceAssembler | null>(null);
  const onTextRef = useRef(onText);
  const optRef = useRef(options);
  useEffect(() => { onTextRef.current = onText; optRef.current = options; });

  const SR =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      : undefined;
  const browserSupported = !!SR;
  const mediaSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const provider = options.provider || 'browser';
  const supported = provider === 'browser' ? browserSupported : mediaSupported;
  const secure = typeof window !== 'undefined' ? window.isSecureContext : true;

  const stop = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    stoppingRef.current = true;
    // Release anything already spoken instead of discarding it.
    assemblerRef.current?.flush();
    try { a.obj.stop(); } catch { /* ignore */ }
  }, []);

  const startBrowser = useCallback(() => {
    const Rec = SR as { new (): {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
      onerror: (e: { error?: string }) => void;
      onend: () => void;
      start: () => void; stop: () => void;
    } } | undefined;
    if (!Rec) { setError('not supported'); return; }
    if (!secure) { setError(explainError('', false)); return; }
    setError(null);
    const r = new Rec();
    r.lang = optRef.current.language || navigator.language || 'en-US';
    r.interimResults = true;
    // Continuous, or the recogniser ends at the user's first natural pause —
    // which is why holding the mic button appeared to "stop after a second".
    // Push-to-talk ends when the user says it ends, not when they breathe.
    r.continuous = true;

    // Chrome finalises at every pause, so a fragment is not the end of a
    // command. Collect them and only call it finished once the speaker has
    // actually stopped — then send automatically, without a second click.
    let sent = false;
    const finish = (text: string) => {
      if (sent || !text.trim()) return;
      sent = true;
      onTextRef.current(text.trim(), true);
      // Push-to-talk is one command per press: close the mic once it is sent.
      stoppingRef.current = true;
      try { r.stop(); } catch { /* already stopping */ }
    };
    const assembler = new UtteranceAssembler(finish, { settleMs: SETTLE_MS });
    assemblerRef.current = assembler;

    // Text finalised in earlier recognition sessions. Chrome ends a continuous
    // session periodically and we restart it, which resets `e.results`.
    let carried = '';
    let sessionFinal = '';

    r.onresult = (e) => {
      // `e.results` is cumulative for the session, so rebuild rather than
      // append — appending repeats every earlier final on every event.
      let final = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      sessionFinal = final;
      const settledText = (carried + final).replace(/\s+/g, ' ').trim();
      // Live text for the box; the send happens when the utterance settles.
      onTextRef.current((settledText + ' ' + interim).replace(/\s+/g, ' ').trim(), false);
      lastFinalRef.current = settledText;
      if (final.trim()) assembler.replace(settledText);
    };

    r.onerror = (e) => {
      const code = String(e?.error || 'error');
      // Silence is not a failure while someone is holding the button down.
      if (code === 'no-speech' || code === 'aborted') return;
      setError(explainError(code, secure));
    };
    r.onend = () => {
      // Chrome ends continuous recognition on its own every so often. Restart
      // while the user is still talking, or a long sentence is lost halfway.
      if (activeRef.current?.obj === r && !stoppingRef.current) {
        // Carry this session's final text across, since `e.results` restarts.
        carried = (carried + sessionFinal).replace(/\s+/g, ' ').trim() + ' ';
        sessionFinal = '';
        try { r.start(); return; } catch { /* fall through to a real stop */ }
      }
      activeRef.current = null;
      stoppingRef.current = false;
      assemblerRef.current = null;
      setListening(false);
      // Pressing stop mid-sentence sends what was said rather than losing it.
      assembler.flush();
      if (!sent) finish(lastFinalRef.current);
    };
    stoppingRef.current = false;
    lastFinalRef.current = '';
    activeRef.current = { kind: 'browser', obj: r };
    setListening(true);
    try { r.start(); }
    catch (err) {
      console.warn('[speech] start failed:', err);
      activeRef.current = null;
      setListening(false);
      setError('could not start');
    }
  }, [SR, secure]);

  const startApi = useCallback(async () => {
    if (!mediaSupported) { setError('mic not supported'); return; }
    setError(null);
    let stream: MediaStream;
    try {
      // Disable the default browser audio processing — echoCancellation,
      // noiseSuppression and AGC need a second or two to adapt and end up
      // suppressing the first part of speech. We want the raw mic so STT
      // gets the full utterance.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch {
      setError('microphone blocked — allow mic access for this site');
      return;
    }

    const pick = (mimes: string[]) => mimes.find((m) => MediaRecorder.isTypeSupported(m));
    const mime = pick(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
    let mr: MediaRecorder;
    try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
    catch (err) {
      console.warn('[speech] MediaRecorder failed:', err);
      stream.getTracks().forEach((t) => t.stop());
      setError('recorder failed');
      return;
    }

    const tStart = performance.now();
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mr.onerror = (e) => console.warn('[speech] recorder error:', e);
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => console.warn('[speech] ⚠ mic track ended — stream taken away');
    });

    mr.onstop = async () => {
      const elapsedMs = Math.round(performance.now() - tStart);
      stream.getTracks().forEach((t) => t.stop());
      activeRef.current = null;
      setListening(false);
      const blobMime = mr.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type: blobMime });
      console.log(`[speech] stop — ${chunks.length} chunk(s), ${blob.size} bytes, ${elapsedMs}ms elapsed`);
      if (blob.size === 0) { console.warn('[speech] empty blob'); return; }
      try {
        const lang = optRef.current.language ? `?language=${encodeURIComponent(optRef.current.language)}` : '';
        const r = await fetch('/api/voice/transcribe' + lang, {
          method: 'POST',
          headers: { 'Content-Type': blobMime },
          body: blob,
        });
        if (!r.ok) {
          let msg = `transcribe ${r.status}`;
          try { const j = await r.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
          console.warn('[speech] transcribe failed:', msg);
          setError(msg);
          return;
        }
        const j = (await r.json()) as { text?: string };
        const text = (j.text || '').trim();
        console.log('[speech] transcript:', JSON.stringify(text));
        if (text) onTextRef.current(text, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    activeRef.current = { kind: 'recorder', obj: mr, stream };
    setListening(true);
    // No timeslice — one ondataavailable on stop() with the complete blob.
    mr.start();
    console.log('[speech] ▶ mr.start() — mime:', mime);
  }, [mediaSupported]);

  const toggle = useCallback(() => {
    if (activeRef.current) { stop(); return; }
    const p = optRef.current.provider || 'browser';
    if (p === 'browser') startBrowser();
    else void startApi();
  }, [stop, startBrowser, startApi]);

  // Abort any in-flight capture on unmount.
  useEffect(() => () => {
    const a = activeRef.current;
    if (!a) return;
    try { a.obj.stop(); } catch { /* ignore */ }
    if (a.kind === 'recorder') a.stream.getTracks().forEach((t) => t.stop());
  }, []);

  return { supported, listening, error, toggle };
}
