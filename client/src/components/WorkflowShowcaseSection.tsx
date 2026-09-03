import React, { useState, useEffect, useRef } from 'react';
import Ic from './Icons';

export interface WorkflowFeature {
  id: string;
  stepNumber: string;
  tabLabel: string;
  title: string;
  badge: string;
  description: string;
  ctaText: string;
}

export const WORKFLOW_FEATURES: WorkflowFeature[] = [
  {
    id: 'terminals',
    stepNumber: '01',
    tabLabel: 'Real Terminals',
    title: 'Side-by-side terminal supervision',
    badge: 'xterm.js · node-pty · WebSocket',
    description:
      'Every agent runs in a real pseudo-terminal you can watch and type into. Scrollback replay allows late browser viewers to reconnect seamlessly with full process output preservation.',
    ctaText: 'Open Live Terminals →',
  },
  {
    id: 'layouts',
    stepNumber: '02',
    tabLabel: '5 Persistent Layouts',
    title: '5 Multi-agent persistent layouts',
    badge: 'Single · 2-up · 3-up · Tmux Grid · Canvas',
    description:
      'Tile your coding agents your way: 1-to-3 agent splits, tmux-style draggable dividers with proportional resizing, or freeform movable window cards persisted per project.',
    ctaText: 'Explore Layouts in Console →',
  },
  {
    id: 'group_chat',
    stepNumber: '03',
    tabLabel: 'Group Chat',
    title: 'Universal project Group Chat',
    badge: 'Broadcast · @agent mention · ANSI strip',
    description:
      'Broadcast instructions to all running agents at once or target a specific one with `@agent-name`. The Supervisor automatically posts real-time progress summaries and blocker warnings here.',
    ctaText: 'Try Group Chat →',
  },
  {
    id: 'mcp',
    stepNumber: '04',
    tabLabel: 'MCP Inter-agent Messaging',
    title: 'MCP inter-agent messaging',
    badge: 'message_agent · list_teammates',
    description:
      'Claude Code agents running in the same project discover each other and coordinate autonomously via session-scoped Model Context Protocol (MCP) server endpoints.',
    ctaText: 'View MCP Configs →',
  },
  {
    id: 'keeper',
    stepNumber: '05',
    tabLabel: 'The Keeper',
    title: 'The Keeper (Codex orchestrator)',
    badge: '⌘J Command Panel · codex app-server',
    description:
      'A headless Codex CLI orchestrator answering repository-wide architecture questions, verifying progress across all agents, and coordinating multi-phase tasks on command.',
    ctaText: 'Launch The Keeper →',
  },
  {
    id: 'voice',
    stepNumber: '06',
    tabLabel: 'Voice Control',
    title: 'Push-to-talk voice pipeline',
    badge: '⌘; Hotkey · Optional Wake Word · TTS',
    description:
      'Speak naturally to your agents using browser Web Speech APIs or optional OpenAI/Gemini cloud endpoints. The Keeper answers with concise spoken audio summaries.',
    ctaText: 'Configure Voice Settings →',
  },
];

interface WorkflowShowcaseSectionProps {
  onOpenConsole: () => void;
}

export const WorkflowShowcaseSection: React.FC<WorkflowShowcaseSectionProps> = ({
  onOpenConsole,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const autoCycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // Calculate sliding active pill position
  const updatePillPosition = (index: number) => {
    if (!tabsRef.current) return;
    const tabButtons = tabsRef.current.querySelectorAll<HTMLButtonElement>('.workflow-tab-item');
    const target = tabButtons[index];
    if (target) {
      const containerLeft = tabsRef.current.getBoundingClientRect().left;
      const targetRect = target.getBoundingClientRect();
      setIndicatorStyle({
        left: targetRect.left - containerLeft,
        width: targetRect.width,
      });
    }
  };

  useEffect(() => {
    updatePillPosition(activeIndex);
    window.addEventListener('resize', () => updatePillPosition(activeIndex));
    return () => window.removeEventListener('resize', () => updatePillPosition(activeIndex));
  }, [activeIndex]);

  // Smooth feature state transition coordinator
  const selectFeature = (index: number, isManual = true) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    setIsTransitioning(true);

    // Fade out previous content, swap data, then reveal new feature
    setTimeout(() => {
      setDisplayIndex(index);
      setIsTransitioning(false);
    }, 220);

    if (isManual) {
      setIsPaused(true);
      // Resume auto cycle after 10s idle
      if (autoCycleTimerRef.current) clearTimeout(autoCycleTimerRef.current);
      autoCycleTimerRef.current = setTimeout(() => {
        setIsPaused(false);
      }, 10000);
    }
  };

  // Automatic demo cycling (5.5s per feature)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      selectFeature((activeIndex + 1) % WORKFLOW_FEATURES.length, false);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeIndex, isPaused]);

  const currentFeature = WORKFLOW_FEATURES[displayIndex];

  return (
    <section
      id="features"
      className="landing-section tools-sec workflow-showcase-section"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="faster-showcase-wrap">
        <h2 className="section-title faster-title">
          Built for serious <span className="highlight-pill animated-highlight">engineering workflows</span>
        </h2>

        {/* Sliding Pill Navigation */}
        <div className="workflow-tabs-track-wrap" ref={tabsRef}>
          <div
            className="workflow-tab-sliding-indicator"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.width > 0 ? 1 : 0,
            }}
          />
          {WORKFLOW_FEATURES.map((item, idx) => (
            <button
              key={item.id}
              className={`workflow-tab-item ${activeIndex === idx ? 'active' : ''}`}
              onClick={() => selectFeature(idx, true)}
            >
              {item.tabLabel}
            </button>
          ))}
        </div>

        {/* Persistent Living Feature Panel */}
        <div className="workflow-master-card-container">
          <div className={`workflow-feature-card ${isTransitioning ? 'card-exiting' : 'card-entering'}`}>
            {/* Top Header Row */}
            <div className="feature-header-row">
              <span className="feature-step-tag">{currentFeature.stepNumber}</span>
              <span className="feature-step-name">{currentFeature.title}</span>
              <span className="feature-tools-badge">{currentFeature.badge}</span>
            </div>

            {/* Description */}
            <p className="feature-step-desc">{currentFeature.description}</p>

            {/* Feature-Specific Animated Interactive Visual */}
            <div className="workflow-visual-stage">
              {displayIndex === 0 && <FeatureTerminalVisual isRunning={!isTransitioning} />}
              {displayIndex === 1 && <FeatureLayoutsVisual isRunning={!isTransitioning} />}
              {displayIndex === 2 && <FeatureGroupChatVisual isRunning={!isTransitioning} />}
              {displayIndex === 3 && <FeatureMcpVisual isRunning={!isTransitioning} />}
              {displayIndex === 4 && <FeatureKeeperVisual isRunning={!isTransitioning} />}
              {displayIndex === 5 && <FeatureVoiceVisual isRunning={!isTransitioning} />}
            </div>

            {/* Feature Action Row */}
            <div className="feature-action-row">
              <button className="preview-action-pill workflow-cta-btn" onClick={onOpenConsole}>
                <span>{currentFeature.ctaText}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ============================================================
   Feature 1 Visual: Real Terminals
   ============================================================ */
const FeatureTerminalVisual: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const [typedLine, setTypedLine] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    setTypedLine('');
    setLines([]);
    setStep(0);

    const t1 = setTimeout(() => {
      setTypedLine('$ npm test -- --runInBand');
      setStep(1);
    }, 400);

    const t2 = setTimeout(() => {
      setLines(['Running authentication suite...', 'PASS src/middleware/auth.test.ts (180ms)']);
      setStep(2);
    }, 1200);

    const t3 = setTimeout(() => {
      setLines((prev) => [
        ...prev,
        'PASS src/services/session.test.ts (94ms)',
        'PASS src/security/csrf.test.ts (62ms)',
        '✓ 42 test suites passed',
      ]);
      setStep(3);
    }, 2100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isRunning]);

  return (
    <div className="mini-term-visual">
      <div className="mini-term-chrome">
        <div className="mini-term-dots">
          <span className="m-dot red" />
          <span className="m-dot yel" />
          <span className="m-dot grn" />
        </div>
        <span className="mini-term-title">Claude Code — PTY Shell #1</span>
        <span className="mini-term-status">
          <span className={`status-led ${step === 3 ? 'green' : 'amber'}`} />
          {step === 3 ? 'COMPLETED' : 'RUNNING'}
        </span>
      </div>
      <div className="mini-term-body">
        {typedLine && <div className="mini-line cmd">{typedLine}</div>}
        {lines.map((l, i) => (
          <div
            key={i}
            className={`mini-line ${l.includes('PASS') || l.includes('✓') ? 'pass' : 'dim'}`}
          >
            {l}
          </div>
        ))}
        {step < 3 && <span className="mini-term-caret">█</span>}
      </div>
    </div>
  );
};

/* ============================================================
   Feature 2 Visual: 5 Persistent Layouts
   ============================================================ */
const FeatureLayoutsVisual: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const [activeLayout, setActiveLayout] = useState<'single' | 'two_up' | 'tmux' | 'canvas'>('tmux');

  useEffect(() => {
    if (!isRunning) return;
    const t1 = setTimeout(() => setActiveLayout('single'), 400);
    const t2 = setTimeout(() => setActiveLayout('two_up'), 1400);
    const t3 = setTimeout(() => setActiveLayout('tmux'), 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isRunning]);

  return (
    <div className="mini-layouts-visual">
      <div className="layouts-mode-bar">
        <span className={`mode-pill ${activeLayout === 'single' ? 'active' : ''}`}>Single</span>
        <span className={`mode-pill ${activeLayout === 'two_up' ? 'active' : ''}`}>2-up</span>
        <span className={`mode-pill ${activeLayout === 'tmux' ? 'active' : ''}`}>Tmux Grid</span>
        <span className="mode-pill">Canvas</span>
        <span className="layouts-state-tag">✓ Layout Persisted</span>
      </div>
      <div className={`layouts-grid-stage layout-${activeLayout}`}>
        <div className="layout-cell cell-1">
          <span className="cell-head">Claude Code</span>
          <span className="cell-meta">src/auth.ts</span>
        </div>
        {activeLayout !== 'single' && (
          <div className="layout-cell cell-2">
            <span className="cell-head">Codex CLI</span>
            <span className="cell-meta">tests/</span>
          </div>
        )}
        {activeLayout === 'tmux' && (
          <>
            <div className="layout-cell cell-3">
              <span className="cell-head">Gemini CLI</span>
              <span className="cell-meta">wiki/</span>
            </div>
            <div className="layout-cell cell-4">
              <span className="cell-head">OpenCode</span>
              <span className="cell-meta">daemon/</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Feature 3 Visual: Universal Group Chat
   ============================================================ */
const FeatureGroupChatVisual: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; role: string }>>([]);

  useEffect(() => {
    if (!isRunning) return;
    setMessages([]);

    const t1 = setTimeout(() => {
      setMessages([{ sender: 'Claude Code', text: 'Refactored cookie middleware for session tokens.', role: 'agent' }]);
    }, 400);

    const t2 = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: 'Codex', text: 'Updated 42 integration test suites. All passing.', role: 'agent' },
      ]);
    }, 1400);

    const t3 = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: 'Engineer', text: 'Ship with --force-with-lease to feature/auth.', role: 'human' },
      ]);
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isRunning]);

  return (
    <div className="mini-chat-visual">
      <div className="mini-chat-head">
        <span className="chat-badge-channel"># universal-group-chat</span>
        <span className="chat-broadcast-tag">Broadcast to 4 Agents</span>
      </div>
      <div className="mini-chat-stream">
        {messages.map((m, i) => (
          <div key={i} className={`mini-chat-bubble ${m.role}`}>
            <div className="bubble-sender-row">
              <strong className="sender-title">{m.sender}</strong>
              <span className="sender-time">12:3{i} PM</span>
            </div>
            <p className="bubble-msg-text">{m.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================
   Feature 4 Visual: MCP Inter-Agent Messaging
   ============================================================ */
const FeatureMcpVisual: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 900);
    }, 1800);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="mini-mcp-visual">
      <div className="mcp-hub-wrap">
        <div className="mcp-node node-left">
          <span className="node-ico">🤖</span>
          <span className="node-name">Claude Code</span>
          <span className="node-payload">message_agent()</span>
        </div>

        <div className="mcp-center-bus">
          <div className={`mcp-packet-pulse ${pulse ? 'pulsing' : ''}`} />
          <span className="bus-title">Conduit MCP Hub</span>
          <span className="bus-spec">list_teammates · session-scoped</span>
        </div>

        <div className="mcp-node node-right">
          <span className="node-ico">🧠</span>
          <span className="node-name">Codex CLI</span>
          <span className="node-payload">✓ Packet received</span>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Feature 5 Visual: The Keeper (Codex Orchestrator)
   ============================================================ */
const FeatureKeeperVisual: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isRunning]);

  return (
    <div className="mini-keeper-visual">
      <div className="keeper-palette-header">
        <span className="keeper-shortcut-badge">⌘J Command Panel</span>
        <span className="keeper-backend-tag">Codex CLI App-Server</span>
      </div>
      <div className="keeper-command-prompt">
        <span className="k-arrow">❯</span>
        <span className="k-query">"What is the current status of the authentication refactor?"</span>
      </div>
      <div className="keeper-structured-answer">
        {step >= 1 && (
          <div className="keeper-evaluating">
            <span className="eval-spinner" />
            <span>Keeper evaluating whole repository context...</span>
          </div>
        )}
        {step >= 2 && (
          <div className="keeper-telemetry-result">
            <div className="k-stat-item">
              <span className="k-num">3</span>
              <span className="k-label">Active Agents</span>
            </div>
            <div className="k-stat-item">
              <span className="k-num">42/42</span>
              <span className="k-label">Tests Passing</span>
            </div>
            <div className="k-stat-item green">
              <span className="k-num">0</span>
              <span className="k-label">Blockers Flagged</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Feature 6 Visual: Push-to-talk Voice Pipeline
   ============================================================ */
const FeatureVoiceVisual: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const [state, setState] = useState<'listening' | 'transcribing' | 'answering'>('listening');

  useEffect(() => {
    if (!isRunning) return;
    setState('listening');
    const t1 = setTimeout(() => setState('transcribing'), 1100);
    const t2 = setTimeout(() => setState('answering'), 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isRunning]);

  return (
    <div className="mini-voice-visual">
      <div className="voice-mic-cockpit">
        <div className={`voice-orb ${state}`}>
          <span className="voice-mic-icon">🎙️</span>
        </div>
        <div className="voice-waveform-bars">
          <span className="v-bar b1" />
          <span className="v-bar b2" />
          <span className="v-bar b3" />
          <span className="v-bar b4" />
          <span className="v-bar b5" />
        </div>
      </div>
      <div className="voice-transcript-card">
        <div className="voice-query-line">
          <span className="voice-label">Spoken (⌘;):</span>
          <span className="voice-text">"Jarvis, give me an audio summary of agent 2."</span>
        </div>
        {state === 'answering' && (
          <div className="voice-audio-response">
            <span className="tts-icon">🔊</span>
            <span className="tts-text">
              "Codex has finished writing session cookie tests. All 42 suites passed without errors."
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowShowcaseSection;
