import React, { useState, useEffect, useRef } from 'react';
import Ic from './Icons';

export type DemoStage =
  | 'idle'             // Clean workspace, cursor waiting
  | 'request_typing'   // Cursor moves to prompt, characters type in
  | 'request_submit'   // Cursor clicks submit arrow
  | 'plan_revealing'   // Plan checklist reveals item by item
  | 'agents_active'    // Terminals stagger active: Claude typing, Codex passing tests
  | 'supervisor_scan'  // Supervisor observer pulses & classifies
  | 'risk_detected'    // Dangerous git push --force appears, terminal halts, amber alert
  | 'gate_modal'       // Modal smoothly animates in, cursor moves to Approve
  | 'human_click'      // Cursor clicks Approve with scale ripple physics
  | 'agent_resumed'    // Force-with-lease execution continues
  | 'all_completed';   // Clean stats summary appears

export interface CursorPos {
  x: number;
  y: number;
  clicking?: boolean;
}

interface ConduitAgentDemoProps {
  onOpenConsole: () => void;
}

export default function ConduitAgentDemo({ onOpenConsole }: ConduitAgentDemoProps) {
  const [stage, setStage] = useState<DemoStage>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [typedRequest, setTypedRequest] = useState('');
  const [typedCommand, setTypedCommand] = useState('');
  const [planRevealedCount, setPlanRevealedCount] = useState(0);
  const [cursor, setCursor] = useState<CursorPos>({ x: 50, y: 70 });
  const [cursorClicking, setCursorClicking] = useState(false);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);

  const fullRequestText = "Refactor authentication middleware to use session cookies, update tests, and verify.";
  const dangerousCommand = "git push origin feature/auth --force";

  // Timeline orchestrator
  useEffect(() => {
    if (isPaused) return;
    let timer: NodeJS.Timeout;

    if (stage === 'idle') {
      setTypedRequest('');
      setTypedCommand('');
      setPlanRevealedCount(0);
      setCursor({ x: 45, y: 80 });
      setHoveredTarget(null);
      setCursorClicking(false);
      timer = setTimeout(() => {
        // Move cursor toward prompt input
        setCursor({ x: 30, y: 35 });
        setStage('request_typing');
      }, 1400);
    } else if (stage === 'request_typing') {
      // Type out prompt character by character
      let charIdx = 0;
      const typeInterval = setInterval(() => {
        charIdx++;
        setTypedRequest(fullRequestText.slice(0, charIdx));
        if (charIdx >= fullRequestText.length) {
          clearInterval(typeInterval);
          // Move cursor to send button
          setCursor({ x: 74, y: 35 });
          setHoveredTarget('send');
          timer = setTimeout(() => {
            setCursorClicking(true);
            setTimeout(() => {
              setCursorClicking(false);
              setStage('request_submit');
            }, 300);
          }, 600);
        }
      }, 25);
      return () => clearInterval(typeInterval);
    } else if (stage === 'request_submit') {
      setHoveredTarget(null);
      setCursor({ x: 50, y: 25 });
      timer = setTimeout(() => {
        setStage('plan_revealing');
      }, 800);
    } else if (stage === 'plan_revealing') {
      let count = 0;
      const planInterval = setInterval(() => {
        count++;
        setPlanRevealedCount(count);
        if (count === 1) setCursor({ x: 40, y: 32 });
        if (count === 2) setCursor({ x: 40, y: 38 });
        if (count === 3) setCursor({ x: 40, y: 44 });
        if (count >= 4) {
          clearInterval(planInterval);
          timer = setTimeout(() => {
            setStage('agents_active');
          }, 1200);
        }
      }, 500);
      return () => clearInterval(planInterval);
    } else if (stage === 'agents_active') {
      // Cursor visits Claude's terminal
      setCursor({ x: 28, y: 55 });
      setHoveredTarget('claude-term');
      timer = setTimeout(() => {
        // Cursor visits Codex terminal
        setCursor({ x: 62, y: 55 });
        setHoveredTarget('codex-term');
        timer = setTimeout(() => {
          setStage('supervisor_scan');
        }, 2200);
      }, 2200);
    } else if (stage === 'supervisor_scan') {
      // Cursor moves to Supervisor Observer badge
      setCursor({ x: 50, y: 15 });
      setHoveredTarget('supervisor');
      timer = setTimeout(() => {
        setStage('risk_detected');
      }, 2500);
    } else if (stage === 'risk_detected') {
      // Type out dangerous command
      setHoveredTarget('claude-term');
      setCursor({ x: 30, y: 65 });
      let cmdIdx = 0;
      const cmdInterval = setInterval(() => {
        cmdIdx++;
        setTypedCommand(dangerousCommand.slice(0, cmdIdx));
        if (cmdIdx >= dangerousCommand.length) {
          clearInterval(cmdInterval);
          // Pause and trigger gate!
          timer = setTimeout(() => {
            setStage('gate_modal');
          }, 900);
        }
      }, 35);
      return () => clearInterval(cmdInterval);
    } else if (stage === 'gate_modal') {
      // Cursor moves purposefully toward the modal Approve button
      setHoveredTarget(null);
      setCursor({ x: 50, y: 50 });
      timer = setTimeout(() => {
        // Arrive over the Approve button
        setCursor({ x: 57, y: 58 });
        setHoveredTarget('approve-btn');
        timer = setTimeout(() => {
          setCursorClicking(true);
          setStage('human_click');
        }, 1200);
      }, 1000);
    } else if (stage === 'human_click') {
      timer = setTimeout(() => {
        setCursorClicking(false);
        setHoveredTarget(null);
        setCursor({ x: 45, y: 70 });
        setStage('agent_resumed');
      }, 600);
    } else if (stage === 'agent_resumed') {
      setCursor({ x: 35, y: 68 });
      timer = setTimeout(() => {
        setStage('all_completed');
      }, 3000);
    } else if (stage === 'all_completed') {
      setCursor({ x: 50, y: 56 });
      setHoveredTarget('cta-btn');
      timer = setTimeout(() => {
        // Reset loop softly
        setCursor({ x: 50, y: 80 });
        setStage('idle');
      }, 5500);
    }

    return () => clearTimeout(timer);
  }, [stage, isPaused]);

  return (
    <div
      className="conduit-cinematic-stage"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Interactive visual story: Conduit multi-agent coordination with real-time supervisor and approval gate"
    >
      {/* SIMULATED DESKTOP CURSOR */}
      <div
        className={`simulated-cursor ${cursorClicking ? 'clicking' : ''}`}
        style={{
          left: `${cursor.x}%`,
          top: `${cursor.y}%`,
        }}
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          {/* Sleek, sharp dark pointer with crisp border */}
          <path
            d="M5.5 3.5L18.5 12L12 13.5L9.5 19.5L5.5 3.5Z"
            fill="#0f0f11"
            stroke="#ffffff"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
        {cursorClicking && <span className="cursor-click-ripple" />}
      </div>

      {/* Main Conduit Application Window Frame */}
      <div className="conduit-app-window">
        {/* Window Chrome Header */}
        <div className="window-chrome">
          <div className="window-traffic-lights" aria-hidden="true">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>

          <div className="window-center-brand">
            <span className="brand-logo-icon">◈</span>
            <span className="brand-app-name">CONDUIT</span>
            <span className="brand-sep">/</span>
            <span className="brand-project">core-auth-service</span>
          </div>

          <div className="window-status-capsule">
            <span className={`status-pill-dot ${stage === 'risk_detected' || stage === 'gate_modal' ? 'amber' : stage === 'all_completed' ? 'green' : 'idle'}`} />
            <span className="status-pill-text">
              {stage === 'idle' && 'Standby'}
              {stage === 'request_typing' && 'Composing...'}
              {stage === 'request_submit' && 'Dispatched'}
              {stage === 'plan_revealing' && 'Plan Created'}
              {stage === 'agents_active' && 'Agents Active'}
              {stage === 'supervisor_scan' && 'Monitoring'}
              {stage === 'risk_detected' && 'Risk Flagged'}
              {stage === 'gate_modal' && 'Approval Gate'}
              {stage === 'human_click' && 'Confirmed'}
              {stage === 'agent_resumed' && 'Resumed Safely'}
              {stage === 'all_completed' && 'Completed'}
            </span>
          </div>
        </div>

        {/* Narrative Workspace Body */}
        <div className={`window-narrative-body ${stage === 'gate_modal' || stage === 'human_click' ? 'is-blurred' : ''}`}>
          
          {/* TOP TIER: User Prompt Composer */}
          <div className={`story-prompt-container ${stage === 'request_typing' || stage === 'request_submit' ? 'prominent' : 'compact'}`}>
            <div className="prompt-pill-bar">
              <span className="prompt-lead-avatar"><Ic.user size={13} /></span>
              <div className="prompt-input-area">
                {stage === 'idle' && <span className="prompt-placeholder">Describe your engineering goal...</span>}
                {(stage !== 'idle') && (
                  <span className="prompt-active-text">
                    {typedRequest}
                    {stage === 'request_typing' && <span className="caret-blink">|</span>}
                  </span>
                )}
              </div>
              <button className={`prompt-submit-circle ${hoveredTarget === 'send' ? 'hovered' : ''}`} aria-label="Submit request">
                <span className="arrow-up">↑</span>
              </button>
            </div>
          </div>

          {/* MIDDLE TIER: Supervisor Plan Card & Bedrock Observer Ribbon */}
          {(stage !== 'idle' && stage !== 'request_typing') && (
            <div className="story-coordination-ribbon">
              {/* Supervisor Plan Checklist Card */}
              <div className="ribbon-plan-card">
                <div className="card-top-title">
                  <span className="badge-tag">KEEPER PLAN</span>
                  <span className="badge-sub">Approval Gate Active</span>
                </div>
                <div className="plan-stepper">
                  <div className={`plan-step-item ${planRevealedCount >= 1 ? 'revealed' : ''}`}>
                    <span className="step-icon">{planRevealedCount >= 1 ? '✓' : '1'}</span>
                    <span className="step-text">Inspect auth middleware</span>
                    <span className="step-agent">Claude</span>
                  </div>
                  <div className={`plan-step-item ${planRevealedCount >= 2 ? 'revealed' : ''}`}>
                    <span className="step-icon">{planRevealedCount >= 2 ? '✓' : '2'}</span>
                    <span className="step-text">Refactor session verification</span>
                    <span className="step-agent">Codex</span>
                  </div>
                  <div className={`plan-step-item ${planRevealedCount >= 3 ? 'revealed' : ''}`}>
                    <span className="step-icon">{planRevealedCount >= 3 ? '✓' : '3'}</span>
                    <span className="step-text">Run 42 integration test suites</span>
                    <span className="step-agent">Gemini</span>
                  </div>
                  <div className={`plan-step-item ${planRevealedCount >= 4 ? 'revealed' : ''}`}>
                    <span className="step-icon">{stage === 'all_completed' ? '✓' : '4'}</span>
                    <span className="step-text">Supervised remote push & PR</span>
                    <span className="step-agent">Gate</span>
                  </div>
                </div>
              </div>

              {/* Bedrock Strands Supervisor Observer Eye */}
              <div className={`ribbon-supervisor-monitor ${stage === 'supervisor_scan' ? 'pulse-scan' : ''} ${stage === 'risk_detected' || stage === 'gate_modal' ? 'risk-alert' : ''}`}>
                <div className="supervisor-bar-head">
                  <div className="supervisor-identity">
                    <span className="supervisor-radar-icon" />
                    <strong>Strands Supervisor</strong>
                    <span className="badge-pill-light">Bedrock</span>
                  </div>
                  <span className="supervisor-status-tag">
                    {stage === 'risk_detected' || stage === 'gate_modal' ? 'Destructive Command Halted' : 'Monitoring output'}
                  </span>
                </div>
                <div className="supervisor-telemetry">
                  <div className="telemetry-item">
                    <span className="t-k">Terminals</span>
                    <span className="t-v">3 PTY Shells</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="t-k">Status</span>
                    <span className={`t-v ${stage === 'risk_detected' || stage === 'gate_modal' ? 'text-danger' : 'text-ok'}`}>
                      {stage === 'risk_detected' || stage === 'gate_modal' ? 'Halted for Approval' : 'Operational'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOWER TIER: Multi-Agent Real Terminals Grid */}
          {(stage !== 'idle' && stage !== 'request_typing') && (
            <div className="story-terminals-grid">
              
              {/* Agent 1: Claude Code in PTY Terminal */}
              <div className={`cinematic-terminal-card ${hoveredTarget === 'claude-term' ? 'focused' : ''} ${stage === 'risk_detected' ? 'gated-border' : ''}`}>
                <div className="terminal-card-bar">
                  <div className="terminal-agent-title">
                    <span className="agent-indicator-green" />
                    <span className="agent-title-text">Claude Code</span>
                    <span className="terminal-badge">PTY #1</span>
                  </div>
                  <span className="terminal-cwd">~/src/middleware/auth.ts</span>
                </div>
                <div className="terminal-body">
                  <div className="term-line dim">$ claude</div>
                  <div className="term-line">Parsing src/middleware/auth.ts...</div>
                  <div className="term-line text-green">✓ Extracted jwtVerify logic into session.ts</div>
                  
                  {/* Progressive typing of the dangerous command */}
                  {(stage === 'risk_detected' || stage === 'gate_modal' || stage === 'human_click' || stage === 'agent_resumed' || stage === 'all_completed') && (
                    <div className="term-line term-prompt-line text-amber">
                      $ {typedCommand}
                      {stage === 'risk_detected' && <span className="term-caret">█</span>}
                    </div>
                  )}

                  {/* Resumption state after human approval */}
                  {(stage === 'agent_resumed' || stage === 'all_completed') && (
                    <>
                      <div className="term-line text-blue">
                        [Supervisor Approved] flag: --force-with-lease applied
                      </div>
                      <div className="term-line text-green">
                        remote: Branch 'feature/auth' updated successfully.
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Agent 2: Codex CLI App-Server */}
              <div className={`cinematic-terminal-card ${hoveredTarget === 'codex-term' ? 'focused' : ''}`}>
                <div className="terminal-card-bar">
                  <div className="terminal-agent-title">
                    <span className="agent-indicator-green" />
                    <span className="agent-title-text">Codex CLI</span>
                    <span className="terminal-badge">app-server</span>
                  </div>
                  <span className="terminal-cwd">tests/session.test.ts</span>
                </div>
                <div className="terminal-body">
                  <div className="term-line dim">$ codex exec "update tests"</div>
                  <div className="term-line">Executing Vitest matrix...</div>
                  <div className="term-line text-green">PASS test/auth/session.test.ts (18/18)</div>
                  <div className="term-line text-green">PASS test/auth/middleware.test.ts (24/24)</div>
                  <div className="term-line text-muted">✓ 42 total tests passing</div>
                </div>
              </div>

              {/* Agent 3: Gemini CLI */}
              <div className="cinematic-terminal-card desktop-only">
                <div className="terminal-card-bar">
                  <div className="terminal-agent-title">
                    <span className="agent-indicator-green" />
                    <span className="agent-title-text">Gemini CLI</span>
                    <span className="terminal-badge">PTY #3</span>
                  </div>
                  <span className="terminal-cwd">wiki/auth-spec.md</span>
                </div>
                <div className="terminal-body">
                  <div className="term-line dim">$ gemini --include wiki/</div>
                  <div className="term-line">Syncing project specs with LLM wiki pattern...</div>
                  <div className="term-line text-muted">✓ Specs updated.</div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* OVERLAY: THE APPROVAL GATE (Core differentiator - Human is in control) */}
        {(stage === 'gate_modal' || stage === 'human_click') && (
          <div className="cinematic-gate-backdrop" role="dialog" aria-modal="true">
            <div className="cinematic-gate-modal">
              <div className="gate-header-tag">
                <span className="gate-warning-indicator"><Ic.logo size={12} /></span>
                <span>APPROVAL GATE TRIGGERED</span>
              </div>
              
              <h3 className="gate-headline">Destructive Remote Push Intercepted</h3>
              
              <p className="gate-submessage">
                <strong>Claude Code</strong> attempted to overwrite remote git history. Execution paused:
              </p>

              <div className="gate-terminal-snippet">
                <code>$ git push origin feature/auth --force</code>
              </div>

              <div className="gate-decision-actions">
                <button className="gate-btn-secondary">
                  Reject (Esc)
                </button>
                <button className={`gate-btn-primary ${hoveredTarget === 'approve-btn' ? 'hovered' : ''} ${stage === 'human_click' ? 'clicked' : ''}`}>
                  <span>Approve with Lease (Y)</span>
                  {stage === 'human_click' && <span className="click-feedback-badge">✓ Approved</span>}
                </button>
              </div>

              <div className="gate-humancentered-note">
                Nothing reaches the agent's shell without your explicit confirmation.
              </div>
            </div>
          </div>
        )}

        {/* OVERLAY: Final Engineering Summary Banner */}
        {stage === 'all_completed' && (
          <div className="cinematic-completion-backdrop">
            <div className="completion-modal-card">
              <div className="completion-check-badge">✓</div>
              <h3 className="completion-title">Workflow Completed</h3>
              <p className="completion-lead">
                3 AI agents coordinated across real terminals under supervisor safety rules.
              </p>

              <div className="completion-metrics-row">
                <div className="metric-box">
                  <span className="m-val">3</span>
                  <span className="m-lbl">Agents</span>
                </div>
                <div className="metric-box">
                  <span className="m-val">42</span>
                  <span className="m-lbl">Tests</span>
                </div>
                <div className="metric-box">
                  <span className="m-val">1</span>
                  <span className="m-lbl">Gate Approved</span>
                </div>
                <div className="metric-box">
                  <span className="m-val">0</span>
                  <span className="m-lbl">Incidents</span>
                </div>
              </div>

              <button className="landing-btn-black completion-cta" onClick={onOpenConsole}>
                Open Control Center <Ic.chevR size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Statusbar */}
        <div className="window-bottom-statusbar">
          <div className="statusbar-left">
            <span className="status-node-dot" />
            <span>Daemon active on :3210</span>
            <span className="status-sep">·</span>
            <span>Supervisor: Bedrock</span>
          </div>
          <div className="statusbar-right">
            <span>Safety Valve: Plan-Approve</span>
            <span className="status-sep">·</span>
            <span className="shortcut-kbd">⌘J</span>
          </div>
        </div>

      </div>
    </div>
  );
}
