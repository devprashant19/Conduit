import { useState, useEffect, useRef } from 'react';
import Ic from './Icons';
import type { Agent } from '../api';

interface GroupChatMsg {
  id: string;
  role: 'human' | 'agent' | 'supervisor';
  sender: string;
  message?: string;
  text?: string;
  classification?: string;
  ts: string;
}

interface Props {
  projectId: string;
  agents: Agent[];
  wsRef: React.RefObject<WebSocket | null>;
}

function timeAgo(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return secs + 's';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GroupChat({ projectId, agents, wsRef }: Props) {
  const [messages, setMessages] = useState<GroupChatMsg[]>([]);
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/groupchat`)
      .then(r => r.json())
      .then((data: any) => {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'groupchat:message' && data.payload.projectId === projectId) {
          setMessages(prev => [...prev, data.payload]);
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [projectId, wsRef]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!composeBody.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/groupchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: composeBody.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || `HTTP ${res.status}`); return; }
      setComposeBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-h">
        <div className="panel-h-l">
          <h2>Group Chat</h2>
          <span className="panel-sub">
            Talk to all agents across the project
          </span>
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 ? (
          <div className="panel-empty">No messages in group chat yet. Say hello!</div>
        ) : (
          messages.map(m => {
            const isHuman = m.role === 'human';
            const isSystem = m.role === 'supervisor';
            const isGate = m.classification === 'risky_action';
            const isPlanProgress = isSystem && m.classification === 'progress';
            const isPlanBlocker = isSystem && m.classification === 'blocker';
            
            let bg = isHuman ? 'var(--accent)' : 'var(--bg2)';
            let color = isHuman ? '#fff' : 'var(--fg)';
            let border = isSystem ? '1px dashed var(--border)' : '1px solid var(--border)';

            if (isGate) {
              bg = 'rgba(255, 60, 60, 0.1)';
              color = 'var(--err)';
              border = '1px solid var(--err)';
            } else if (isPlanProgress) {
              bg = 'rgba(60, 255, 60, 0.05)';
              border = '1px solid var(--success)';
            } else if (isPlanBlocker) {
              bg = 'rgba(255, 60, 60, 0.05)';
              border = '1px dashed var(--err)';
            }

            return (
              <div 
                key={m.id} 
                style={{ 
                  alignSelf: isHuman ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: bg,
                  color: color,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  borderBottomRightRadius: isHuman ? '2px' : '12px',
                  borderBottomLeftRadius: !isHuman ? '2px' : '12px',
                  border: border,
                }}
              >
                <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{m.sender}</strong>
                  <span style={{ marginLeft: '12px' }}>{timeAgo(m.ts)}</span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {m.text || m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        {error && <div style={{ color: 'var(--err)', fontSize: 11.5, marginBottom: '8px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            placeholder="Send a message (e.g. '@Backend check the auth flow')"
            rows={1}
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ 
              flex: 1, 
              minHeight: '40px',
              maxHeight: '120px',
              resize: 'none',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--fg)',
              fontFamily: 'inherit',
              fontSize: '13px'
            }}
          />
          <button
            className="send-btn primary"
            onClick={handleSend}
            disabled={sending || !composeBody.trim()}
            style={{ height: '40px', padding: '0 16px', borderRadius: '8px', fontWeight: 600 }}
          >
            <Ic.send size={13} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
