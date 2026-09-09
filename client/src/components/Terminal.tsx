import { useEffect, useRef } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { WsApi } from '../hooks/useWebSocket';

interface Props {
  agentId: string;
  ws: WsApi;
  onFocus?: () => void;
  /** When true, imperatively focus the xterm so keyboard input routes here. */
  focused?: boolean;
}

const DARK_THEME = {
  background: '#09090b',
  foreground: '#f4f4f5',
  cursor: '#3b82f6',
  selectionBackground: 'rgba(59, 130, 246, 0.3)',
  black: '#09090b',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#8b5cf6',
  cyan: '#06b6d4',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#f87171',
  brightGreen: '#34d399',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#a78bfa',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

// Light palette matched to Claude Code's light theme (ansi color names)
const LIGHT_THEME = {
  background: '#f7f7f5',
  foreground: '#37352f',
  cursor: '#2383e2',
  selectionBackground: 'rgba(0, 153, 153, 0.2)',
  black: '#37352f',
  red: '#c0392b',
  green: '#2c7a39',
  yellow: '#966c1e',
  blue: '#2383e2',
  magenta: '#8700af',
  cyan: '#0e7a7a',
  white: '#e0ddd8',
  brightBlack: '#8b8680',
  brightRed: '#d77b53',
  brightGreen: '#4dab9a',
  brightYellow: '#c49a1a',
  brightBlue: '#529cca',
  brightMagenta: '#b44dd7',
  brightCyan: '#3aafa9',
  brightWhite: '#f7f7f5',
};

export default function Terminal({ agentId, ws, onFocus, focused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onFocusRef = useRef(onFocus);
  useEffect(() => { onFocusRef.current = onFocus; });

  // When the `focused` prop flips to true (e.g. via Ctrl+1-5 or programmatic
  // selection), route keyboard input to this xterm instance.
  useEffect(() => {
    if (focused) termRef.current?.focus();
  }, [focused]);

  // Follow theme switches without recreating the terminal.
  useEffect(() => {
    const el = document.documentElement;
    const apply = () => {
      const t = termRef.current;
      if (!t) return;
      t.options.theme = el.getAttribute('data-theme') === 'light' ? LIGHT_THEME : DARK_THEME;
    };
    const obs = new MutationObserver(apply);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 12.25,
      fontFamily: "'Consolas', 'Fira Code', monospace",
      theme: DARK_THEME,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    try { fit.fit(); } catch { /* container not laid out yet */ }

    termRef.current = term;
    fitRef.current = fit;

    // Only scroll to bottom during initial buffer load (attach), not on every output
    let initialLoad = true;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    let attached = false;

    const attach = () => {
      if (!ws.isOpen()) return;
      initialLoad = true;
      term.clear();
      ws.send({ type: 'terminal:attach', agentId });
      ws.send({ type: 'terminal:resize', agentId, cols: term.cols, rows: term.rows });
      attached = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { initialLoad = false; }, 2000);
    };

    // Handle user input
    term.onData((data) => {
      ws.send({ type: 'terminal:input', agentId, data });
    });

    // Allow browser paste/copy and Conduit app shortcuts to reach the window handler
    // even when xterm has focus. Returning false tells xterm to skip the key; the
    // browser still dispatches keydown to window listeners (capture or otherwise).
    //
    // Escape is intentionally NOT returned false here — xterm must forward ESC to
    // the terminal program (Claude Code interrupt, vim, etc.).
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'v') return false;                          // paste
      if (mod && e.key === 'c' && term.hasSelection()) return false;   // copy when selection
      if (mod && (e.key === 'k' || e.key === 'K')) return false;       // palette
      if (mod && (e.key === 'j' || e.key === 'J')) return false;       // command panel
      if (mod && e.key === '/') return false;                          // palette (alt)
      if (mod && e.key === ';') return false;                          // voice
      if (mod && /^[1-9]$/.test(e.key)) return false;                  // agent focus
      return true;
    });

    term.onResize(({ cols, rows }) => {
      ws.send({ type: 'terminal:resize', agentId, cols, rows });
    });

    // Incoming frames — this subscription survives socket reconnects, and the
    // synthetic ws:open frame re-attaches us so the pane never goes dead.
    const unsubscribe = ws.subscribe((msg) => {
      if (msg.type === 'terminal:output' && msg.agentId === agentId && typeof msg.data === 'string') {
        term.write(msg.data);
        if (initialLoad) {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            term.scrollToBottom();
            initialLoad = false;
          }, 150);
        }
      } else if (msg.type === 'ws:open') {
        attach();
      } else if (msg.type === 'ws:close') {
        attached = false;
        term.write('\r\n\x1b[33m[conduit] connection lost — reconnecting…\x1b[0m\r\n');
      }
    });

    attach();

    // Notify parent when terminal gets focus; also ensure the hidden xterm
    // textarea gets focus when the user clicks so keyboard + paste routes work.
    const handleFocusIn = () => onFocusRef.current?.();
    const handleMouseDown = () => {
      onFocusRef.current?.();
      setTimeout(() => termRef.current?.focus(), 0);
    };
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('mousedown', handleMouseDown);

    // Explicit paste handler — works for both Ctrl/Cmd+V and right-click →
    // Paste. xterm.paste() routes the text into the terminal input stream as
    // if typed, handling bracketed paste mode when enabled by the server.
    const handlePaste = (ev: ClipboardEvent) => {
      const text = ev.clipboardData?.getData('text');
      if (text && termRef.current) {
        ev.preventDefault();
        ev.stopPropagation();
        termRef.current.paste(text);
      }
    };
    container.addEventListener('paste', handlePaste);

    // Fit on resize — debounced to avoid thrashing during drag
    let fitTimeout: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(fitTimeout);
      fitTimeout = setTimeout(() => { try { fit.fit(); } catch { /* ignore */ } }, 50);
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(fitTimeout);
      clearTimeout(scrollTimer);
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('paste', handlePaste);
      if (attached) ws.send({ type: 'terminal:detach', agentId });
      unsubscribe();
      resizeObserver.disconnect();
      term.dispose();
      if (termRef.current === term) termRef.current = null;
    };
    // `ws` is a stable object from useWebSocket (memoised on identity-stable callbacks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, ws.send, ws.subscribe, ws.isOpen]);

  return <div ref={containerRef} className="terminal-container" data-tour="terminal" />;
}
