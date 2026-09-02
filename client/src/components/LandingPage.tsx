import React from 'react';
import Ic from './Icons';

interface LandingPageProps {
  onOpenConsole: () => void;
}

export default function LandingPage({ onOpenConsole }: LandingPageProps) {
  return (
    <div className="landing-page">
      {/* Top Floating Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <span className="brand-title">CONDUIT</span>
        </div>
        <div className="landing-nav-links">
          <a href="#how-it-works" className="landing-nav-link">How it works</a>
          <a href="#agents" className="landing-nav-link">Supported Agents</a>
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#faq" className="landing-nav-link">FAQ</a>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-btn-black" onClick={onOpenConsole}>
            Open Control Center <Ic.chevR size={12} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-bounding-frame" aria-hidden="true">
          <span className="frame-dot t-l" />
          <span className="frame-dot t-m" />
          <span className="frame-dot t-r" />
          <span className="frame-dot b-l" />
          <span className="frame-dot b-m" />
          <span className="frame-dot b-r" />
          <span className="frame-dot l-m" />
          <span className="frame-dot r-m" />
        </div>

        {/* Floating Real Agent Cards */}
        {/* Top Left: Claude Code */}
        <div className="hero-floating-badge badge-top-left">
          <div className="floating-user-bubble">Fix the race condition in the WebSocket handler</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar sprout">🤖</span>
            <div className="agent-text">
              <div className="agent-msg">Claude Code resolved socket race & passes all smoke tests.</div>
              <div className="agent-tools">Claude 3.5 Sonnet · node-pty</div>
            </div>
          </div>
        </div>

        {/* Top Right: Codex Orchestrator */}
        <div className="hero-floating-badge badge-top-right">
          <div className="floating-user-bubble">The Keeper, what are all running agents working on?</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar bunny">🧠</span>
            <div className="agent-text">
              <div className="agent-msg">Agent 1 refactoring CSS, Agent 2 running migrations.</div>
              <div className="agent-tools">The Keeper · Codex CLI</div>
            </div>
          </div>
        </div>

        {/* Mid Left: Approval Gate */}
        <div className="hero-floating-badge badge-mid-left">
          <div className="floating-user-bubble">Run database migration on staging</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar bear">🛡️</span>
            <div className="agent-text">
              <div className="agent-msg">Approval Gate: Destructive SQL detected. Awaiting OK.</div>
              <div className="agent-tools">Bedrock Supervisor · Safety Gate</div>
            </div>
          </div>
        </div>

        {/* Mid Right: Gemini CLI */}
        <div className="hero-floating-badge badge-mid-right">
          <div className="floating-user-bubble">Generate comprehensive test coverage for auth routes</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar kitten">✨</span>
            <div className="agent-text">
              <div className="agent-msg">18 integration tests generated and verified.</div>
              <div className="agent-tools">Gemini CLI · PTY Terminal</div>
            </div>
          </div>
        </div>

        {/* Bottom Left: OpenCode */}
        <div className="hero-floating-badge badge-bot-left">
          <div className="floating-user-bubble">Sync project wiki with new architectural changes</div>
          <div className="floating-agent-card compact">
            <span className="mascot-avatar blob">📖</span>
            <div className="agent-text">
              <div className="agent-msg">Updated project wiki & shared content folder.</div>
            </div>
          </div>
        </div>

        {/* Bottom Right: Voice Pipeline */}
        <div className="hero-floating-badge badge-bot-right">
          <div className="floating-user-bubble">"Jarvis, summarize blocker on agent 2"</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar peach">🎙️</span>
            <div className="agent-text">
              <div className="agent-msg">Spoken audio briefing generated via speech synthesis.</div>
              <div className="agent-tools">Voice Pipeline · Push-to-talk (⌘;)</div>
            </div>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="hero-center-content">
          <h1 className="hero-title">
            The multi-agent control center<br />
            for <span className="highlight-pill">engineers</span>
          </h1>

          <p className="hero-subtitle">
            Run Claude Code, Codex, Gemini CLI, and OpenCode side by side. Supervised by Amazon Bedrock with human-in-the-loop approval gates.
          </p>

          <div className="hero-actions">
            <button className="hero-cta-button" onClick={onOpenConsole}>
              Launch Conduit Console ↓
            </button>
            <span className="hero-cta-subtext">Real terminals · Full human supervision · MIT License</span>
          </div>
        </div>
      </section>

      {/* Section 2: How the Safety Loop Works */}
      <section id="how-it-works" className="landing-section how-it-works-sec">
        <h2 className="section-title">How the human-in-the-loop safety loop works</h2>

        <div className="how-it-works-grid">
          {/* Step 01 */}
          <div className="how-step-row">
            <div className="how-step-text">
              <span className="step-num">01</span>
              <h3 className="step-title">Watch and classify in real time.</h3>
              <p className="step-desc">
                The daemon strips ANSI from every agent's terminal output and runs fast regex checks (destructive commands, force pushes, rm -rf) plus an AWS Strands Supervisor call on Bedrock every 10–20 seconds.
              </p>
            </div>
            <div className="how-step-preview">
              <div className="preview-container-box">
                <div className="preview-prompt-card">
                  <span className="preview-prompt-text">
                    Supervisor classifies agent output: reports progress, blockers, questions, and flags risky commands.
                  </span>
                  <span className="preview-submit-arrow">⚡</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 02 */}
          <div className="how-step-row">
            <div className="how-step-text">
              <span className="step-num">02</span>
              <h3 className="step-title">Gate & Plan approval.</h3>
              <p className="step-desc">
                Nothing is auto-answered. Risky commands pause the agent and surface an Approval Gate. Supervisor instructions must go through `plan_action` and require your explicit sign-off before anything is sent.
              </p>
            </div>
            <div className="how-step-preview">
              <div className="preview-container-box">
                <div className="preview-result-card">
                  <div className="preview-user-query">
                    claude: git push origin main --force
                  </div>
                  <div className="preview-status-tag" style={{ color: '#dc2626' }}>
                    <span className="check-icon">⚠️</span> APPROVAL GATE REQUIRED
                  </div>
                  <div className="preview-summary-text">
                    Destructive action detected on branch 'main'. The agent is paused until you approve, reject, or type a custom reply.
                  </div>
                  <button className="preview-action-pill" onClick={onOpenConsole}>
                    Review in Console
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Supported AI Agents & Multi-vendor Tools */}
      <section id="agents" className="landing-section tools-sec">
        <h2 className="section-title">Multi-vendor agent support</h2>

        {/* Real Tool & CLI Grid */}
        <div className="tools-logo-cloud">
          <div className="tool-logo-pill" title="Claude Code"><span className="logo-emoji">🤖</span> Claude Code</div>
          <div className="tool-logo-pill" title="Codex CLI"><span className="logo-emoji">💻</span> Codex CLI</div>
          <div className="tool-logo-pill" title="Gemini CLI"><span className="logo-emoji">♊</span> Gemini CLI</div>
          <div className="tool-logo-pill" title="OpenCode"><span className="logo-emoji">🔓</span> OpenCode</div>
          <div className="tool-logo-pill" title="AWS Bedrock"><span className="logo-emoji">☁️</span> AWS Bedrock</div>
          <div className="tool-logo-pill" title="Strands Agents SDK"><span className="logo-emoji">🧬</span> Strands SDK</div>
          <div className="tool-logo-pill" title="xterm.js"><span className="logo-emoji">⌨️</span> xterm.js PTY</div>
          <div className="tool-logo-pill" title="node-pty"><span className="logo-emoji">⚙️</span> node-pty</div>
          <div className="tool-logo-pill" title="MCP Messaging"><span className="logo-emoji">🔌</span> Model Context Protocol</div>
          <div className="tool-logo-pill" title="Project Wiki"><span className="logo-emoji">📚</span> LLM Project Wiki</div>
          <div className="tool-logo-pill" title="WebSocket"><span className="logo-emoji">⚡</span> WebSocket Replay</div>
          <div className="tool-logo-pill" title="Voice"><span className="logo-emoji">🎙️</span> Speech Engine</div>
        </div>

        {/* Features Tabs Showcase */}
        <div className="faster-showcase-wrap" id="features">
          <h2 className="section-title faster-title">
            Built for serious <span className="highlight-pill">engineering workflows</span>
          </h2>

          {/* Pill Tabs */}
          <div className="showcase-pill-tabs">
            <button className="showcase-tab-btn active">Real Terminals</button>
            <button className="showcase-tab-btn">5 Persistent Layouts</button>
            <button className="showcase-tab-btn">Group Chat</button>
            <button className="showcase-tab-btn">MCP Inter-agent Messaging</button>
            <button className="showcase-tab-btn">The Keeper</button>
            <button className="showcase-tab-btn">Voice Control</button>
          </div>

          {/* Showcase Feature Card */}
          <div className="showcase-card-container">
            <div className="showcase-feature-card">
              <div className="feature-header-row">
                <span className="feature-step-tag">01</span>
                <span className="feature-step-name">Side-by-side terminal supervision</span>
                <span className="feature-tools-badge">Single · 2-up · 3-up · Tmux Grid · Freeform Canvas</span>
              </div>
              <p className="feature-step-desc">
                Every agent runs in a real pseudo-terminal you can watch and type into. Scrollback replay allows late browser viewers to reconnect seamlessly with full process output preservation.
              </p>
              <div className="feature-action-row">
                <button className="preview-action-pill" onClick={onOpenConsole}>
                  Open Live Dashboard →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Architecture Overview */}
      <section className="landing-section demo-sec">
        <h2 className="section-title">
          Two brains, two distinct roles.<br />
          Always with human oversight.
        </h2>
        <p className="section-subtitle">
          The Supervisor watches and flags risks on Bedrock. The Keeper answers questions about your whole project via Codex CLI.
        </p>

        <div className="calendar-card-wrap">
          <div className="calendar-card" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* The Supervisor */}
            <div className="cal-host-col" style={{ borderRight: '1px solid rgba(15, 15, 17, 0.06)' }}>
              <div className="cal-host-avatar">🛡️</div>
              <div className="cal-host-meta">
                <span className="cal-host-name">AWS Strands Agents SDK + Bedrock</span>
                <h3 className="cal-meeting-title">The Supervisor</h3>
              </div>
              <p className="cal-meeting-desc">
                Watches agent terminal outputs, classifies progress and blockers, detects destructive commands, and proposes plans via `plan_action`.
              </p>
              <div className="cal-meeting-details">
                <div className="cal-detail-item">🔒 Can act without you? <strong>No — requires approval</strong></div>
                <div className="cal-detail-item">⚡ Engine: Claude 3.5 Sonnet on Amazon Bedrock</div>
                <div className="cal-detail-item">📝 Audit log: Saved to ~/.conduit/audit.jsonl</div>
              </div>
            </div>

            {/* The Keeper */}
            <div className="cal-grid-col">
              <div className="cal-host-avatar">🧠</div>
              <div className="cal-host-meta">
                <span className="cal-host-name">Codex CLI App-Server</span>
                <h3 className="cal-meeting-title">The Keeper</h3>
              </div>
              <p className="cal-meeting-desc">
                The global project orchestrator in the Command Panel (⌘J). Answers questions about the entire repository and relays instructions to specific agents on demand.
              </p>
              <div className="cal-meeting-details">
                <div className="cal-detail-item">💬 Interaction: Command palette & Group Chat</div>
                <div className="cal-detail-item">🎙️ Voice: Spoken summaries & push-to-talk (⌘;)</div>
                <div className="cal-detail-item">🛠️ Scope: Operates only on user explicit instructions</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Real FAQ & Bottom Sign-off */}
      <section id="faq" className="landing-section faq-sec">
        <h2 className="section-title">Frequently asked questions</h2>

        <div className="faq-list">
          {/* FAQ 1 */}
          <div className="faq-item open">
            <div className="faq-question">
              <span>What is Conduit and who is it built for?</span>
              <span className="faq-toggle">×</span>
            </div>
            <div className="faq-answer">
              Conduit is a multi-agent control center for professional software engineers who want to run multiple AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode) side by side in real terminals while retaining full visibility and veto power over actions.
            </div>
          </div>

          {/* FAQ 2 */}
          <div className="faq-item">
            <div className="faq-question">
              <span>How do approval gates protect my codebase?</span>
              <span className="faq-toggle">+</span>
            </div>
            <div className="faq-answer">
              Conduit uses two layers of protection: instant regex pattern detection for dangerous shell commands (like force pushes, rm -rf, drop tables) and periodic Bedrock classification. When a gate triggers, the agent is paused and surfaced in an approval modal—nothing is sent without your confirmation.
            </div>
          </div>

          {/* FAQ 3 */}
          <div className="faq-item">
            <div className="faq-question">
              <span>Can agents collaborate and talk to each other?</span>
              <span className="faq-toggle">+</span>
            </div>
            <div className="faq-answer">
              Yes. Agents in the same project can share context via the Project Wiki (Karpathy's LLM-wiki pattern), access shared folders (`shared_content/`), and communicate directly via MCP tools (`message_agent`, `list_teammates`).
            </div>
          </div>

          {/* FAQ 4 */}
          <div className="faq-item">
            <div className="faq-question">
              <span>Is my data private and can I run it locally?</span>
              <span className="faq-toggle">+</span>
            </div>
            <div className="faq-answer">
              Yes. Conduit runs entirely on your local machine or private EC2 instance. All project data, agent transcripts, and audit logs are stored locally under `~/.conduit/`. HTTP Basic Auth (`CONDUIT_AUTH`) protects the dashboard when deployed remotely.
            </div>
          </div>
        </div>

        {/* Bottom Mascot Parade & Final Hero Sign-off */}
        <div className="footer-signoff-wrap">
          <div className="mascot-parade-row">
            <span className="parade-mascot">🤖</span>
            <span className="parade-mascot">💻</span>
            <span className="parade-mascot">♊</span>
            <span className="parade-mascot">🔓</span>
            <span className="parade-mascot">🛡️</span>
            <span className="parade-mascot">🧠</span>
          </div>
          <h2 className="signoff-title">
            Always in the <span className="highlight-pill">driver's seat.</span>
          </h2>
          <button className="landing-btn-black signoff-btn" onClick={onOpenConsole}>
            Launch Conduit Console <Ic.chevR size={12} />
          </button>
        </div>
      </section>
    </div>
  );
}
