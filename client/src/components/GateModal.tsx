import { useState } from 'react';
import type { Agent, Project } from '../api';
import Ic from './Icons';

interface Props {
  project?: Project;
  agent?: Agent;
  gate?: NonNullable<Agent['pendingGate']>;
  onClose: () => void;
  onResolve: (decision: 'approve' | 'reject' | 'custom', customInput?: string) => void;
}

const HIGH_RISK_KEYWORDS = [
  /delete/i,
  /force push/i,
  /drop table/i,
  /rm -rf/i,
  /overwrite/i,
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
];

export default function GateModal({ project, agent, gate, onClose, onResolve }: Props) {
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  if (!agent || !gate) return null;

  const isHighRisk = HIGH_RISK_KEYWORDS.some(pattern => pattern.test(gate.prompt));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-h">
          <h2>Action Required: {agent.name}</h2>
          <button className="hbtn" onClick={onClose}><Ic.x size={14} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Agent <strong>{agent.name}</strong> in project <strong>{project?.name || agent.projectId}</strong> is blocked.
            {gate.source === 'supervisor' && ' The Supervisor detected a risky action.'}
          </div>

          {isHighRisk && (
            <div style={{ padding: '8px 12px', background: 'rgba(255, 60, 60, 0.1)', color: 'var(--err)', borderRadius: 6, fontSize: 13, border: '1px solid var(--err)' }}>
              <strong>High Risk Action:</strong> This action matches a restricted pattern and cannot be auto-approved. You must explicitly choose an action.
            </div>
          )}

          <div style={{
            background: 'var(--bg)',
            padding: 12,
            borderRadius: 6,
            border: '1px solid var(--border)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: 'var(--fg)',
            maxHeight: 200,
            overflowY: 'auto'
          }}>
            {gate.prompt}
          </div>

          {!showCustom ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn" onClick={() => setShowCustom(true)}>Custom Input</button>
              <button className="btn" style={{ color: 'var(--err)', borderColor: 'var(--err)' }} onClick={() => onResolve('reject')}>
                Reject (n)
              </button>
              <button 
                className="btn primary" 
                onClick={() => onResolve('approve')}
              >
                Approve (y)
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <input
                autoFocus
                className="input"
                placeholder="Enter custom input to send..."
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onResolve('custom', customInput);
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setShowCustom(false)}>Back</button>
                <button className="btn primary" onClick={() => onResolve('custom', customInput)}>Send Input</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
