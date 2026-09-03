import React, { useState } from 'react';
import Ic from './Icons';
import ConduitAgentDemo from './ConduitAgentDemo';
import ToolEcosystemSection from './ecosystem/ToolEcosystemSection';
import WorkflowShowcaseSection from './WorkflowShowcaseSection';
import { BrandIcons } from './ecosystem/BrandIcons';
import DownloadModal from './DownloadModal';

interface LandingPageProps {
  onOpenConsole: () => void;
}

export default function LandingPage({ onOpenConsole }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  return (
    <div className="landing-page">
      {/* Top Floating Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <span className="brand-title">CONDUIT</span>
        </div>
        <div className="landing-nav-links">
          <a href="#how-it-works" className="landing-nav-link">How it works</a>
          <a href="#ecosystem" className="landing-nav-link">Ecosystem</a>
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

        {/* Floating Real Agent Cards (Phase 2: Enlarged, Authentic Icons & Status Chips) */}
        {/* Top Left: Claude Code */}
        <div className="hero-floating-badge badge-top-left">
          <div className="floating-user-bubble">
            <span className="user-bubble-avatar"><Ic.user size={12} /></span>
            <span className="user-bubble-text">Fix the race condition in the WebSocket handler</span>
          </div>
          <div className="floating-agent-card">
            <div className="card-top-identity">
              <div className="agent-brand-avatar claude">
                <BrandIcons.claude size={15} />
              </div>
              <span className="agent-title-text">Claude Code</span>
              <span className="agent-status-badge running">
                <span className="badge-dot" /> Running
              </span>
            </div>
            <p className="agent-explanation-text">
              I'll analyze the WebSocket handler and fix the race condition. Let me check the relevant files and review the implementation.
            </p>
            <div className="agent-card-tags">
              <span className="meta-tag">claude-3-5-sonnet</span>
              <span className="meta-tag">node-pty</span>
            </div>
          </div>
        </div>

        {/* Top Right: The Keeper (Codex CLI) */}
        <div className="hero-floating-badge badge-top-right">
          <div className="floating-user-bubble">
            <span className="user-bubble-avatar"><Ic.user size={12} /></span>
            <span className="user-bubble-text">The Keeper, what are all running agents working on?</span>
          </div>
          <div className="floating-agent-card">
            <div className="card-top-identity">
              <div className="agent-brand-avatar codex">
                <BrandIcons.openai size={15} />
              </div>
              <span className="agent-title-text">The Keeper</span>
              <span className="agent-status-badge codex">
                <span className="badge-dot" /> Orchestrating
              </span>
            </div>
            <p className="agent-explanation-text">
              Agent 1 is refactoring CSS in client. Agent 2 is executing migration scripts on the staging database.
            </p>
            <div className="agent-card-tags">
              <span className="meta-tag">codex-app-server</span>
              <span className="meta-tag">⌘J Panel</span>
            </div>
          </div>
        </div>

        {/* Mid Left: Approval Gate (Bedrock Supervisor) */}
        <div className="hero-floating-badge badge-mid-left">
          <div className="floating-user-bubble">
            <span className="user-bubble-avatar"><Ic.user size={12} /></span>
            <span className="user-bubble-text">Run database migration on staging</span>
          </div>
          <div className="floating-agent-card gated">
            <div className="card-top-identity">
              <div className="agent-brand-avatar supervisor">
                <Ic.logo size={14} />
              </div>
              <span className="agent-title-text">Approval Gate</span>
              <span className="agent-status-badge halted">
                <span className="badge-dot" /> Halted (Risk)
              </span>
            </div>
            <p className="agent-explanation-text">
              Destructive SQL operation detected: <code>DROP TABLE session_cache;</code> Execution paused until human confirms.
            </p>
            <div className="agent-card-tags">
              <span className="meta-tag">bedrock-supervisor</span>
              <span className="meta-tag">safety-gate</span>
            </div>
          </div>
        </div>

        {/* Mid Right: Gemini CLI */}
        <div className="hero-floating-badge badge-mid-right">
          <div className="floating-user-bubble">
            <span className="user-bubble-avatar"><Ic.user size={12} /></span>
            <span className="user-bubble-text">Generate comprehensive test coverage for auth routes</span>
          </div>
          <div className="floating-agent-card">
            <div className="card-top-identity">
              <div className="agent-brand-avatar gemini">
                <BrandIcons.gemini size={15} />
              </div>
              <span className="agent-title-text">Gemini CLI</span>
              <span className="agent-status-badge running">
                <span className="badge-dot" /> Verified
              </span>
            </div>
            <p className="agent-explanation-text">
              Generated 18 test suites covering cookie validation, expiration edge-cases, and CSRF token verification.
            </p>
            <div className="agent-card-tags">
              <span className="meta-tag">gemini-2.5-flash</span>
              <span className="meta-tag">pty-shell</span>
            </div>
          </div>
        </div>

        {/* Bottom Left: OpenCode Wiki Sync */}
        <div className="hero-floating-badge badge-bot-left">
          <div className="floating-user-bubble">
            <span className="user-bubble-avatar"><Ic.user size={12} /></span>
            <span className="user-bubble-text">Sync project wiki with new architectural changes</span>
          </div>
          <div className="floating-agent-card">
            <div className="card-top-identity">
              <div className="agent-brand-avatar opencode">
                <BrandIcons.opencode size={15} />
              </div>
              <span className="agent-title-text">OpenCode</span>
              <span className="agent-status-badge synced">
                <span className="badge-dot" /> Synced
              </span>
            </div>
            <p className="agent-explanation-text">
              Updated <code>wiki/auth-spec.md</code> and synchronized shared context using the LLM wiki pattern.
            </p>
            <div className="agent-card-tags">
              <span className="meta-tag">wiki-engine</span>
              <span className="meta-tag">shared_content/</span>
            </div>
          </div>
        </div>

        {/* Bottom Right: Voice Pipeline */}
        <div className="hero-floating-badge badge-bot-right">
          <div className="floating-user-bubble">
            <span className="user-bubble-avatar"><Ic.user size={12} /></span>
            <span className="user-bubble-text">"Jarvis, summarize blocker on agent 2"</span>
          </div>
          <div className="floating-agent-card">
            <div className="card-top-identity">
              <div className="agent-brand-avatar voice">
                <Ic.mic size={13} />
              </div>
              <span className="agent-title-text">Voice Pipeline</span>
              <span className="agent-status-badge voice">
                <span className="badge-dot" /> TTS Audio
              </span>
            </div>
            <p className="agent-explanation-text">
              "Codex is waiting for DB migration approval. Remaining agents are operating normally without blockers."
            </p>
            <div className="agent-card-tags">
              <span className="meta-tag">web-speech-api</span>
              <span className="meta-tag">hotkey: ⌘;</span>
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
            <button className="hero-cta-button" onClick={() => setIsDownloadOpen(true)}>
              Download ↓
            </button>
            <span className="hero-cta-subtext">Real terminals · Full human supervision · MIT License</span>
          </div>
        </div>
      </section>

      {/* Interactive Product Demonstration Showcase (Conduit Live Story) */}
      <section className="landing-section demo-showcase-section">
        <div className="demo-showcase-header">
          <span className="demo-eyebrow">THE HUMAN-DRIVEN MULTI-AGENT CONTROL CENTER</span>
          <h2 className="demo-showcase-heading">
            Your agents work.<br />
            You stay in control.
          </h2>
          <p className="demo-showcase-desc">
            Coordinate Claude, Codex, Gemini, and OpenCode from one unified workspace while Conduit's Supervisor continuously monitors terminal output for blockers and dangerous commands.
          </p>
        </div>

        {/* The Animated Conduit Workspace */}
        <ConduitAgentDemo onOpenConsole={onOpenConsole} />
      </section>

      {/* Tool Ecosystem Section: Works With the Tools Engineers Already Use */}
      <ToolEcosystemSection />

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
                  <span className="preview-submit-arrow"><Ic.bolt size={13} /></span>
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
                  <div className="preview-status-tag" style={{ color: '#0f0f11' }}>
                    <span className="check-icon" style={{ display: 'inline-flex', alignItems: 'center' }}><Ic.logo size={12} /></span> APPROVAL GATE REQUIRED
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

      {/* Features Tabs Showcase — Animated Living Product Showcase */}
      <WorkflowShowcaseSection onOpenConsole={onOpenConsole} />

      {/* Section 5: Real FAQ */}
      <section id="faq" className="landing-section faq-sec">
        <h2 className="section-title">Frequently asked questions</h2>

        <div className="faq-list">
          {/* FAQ 1 */}
          <div className={'faq-item' + (openFaq === 0 ? ' open' : '')} onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}>
            <div className="faq-question">
              <span>What is Conduit and who is it built for?</span>
              <span className="faq-toggle">{openFaq === 0 ? '×' : '+'}</span>
            </div>
            {openFaq === 0 && (
              <div className="faq-answer">
                Conduit is a multi-agent control center for professional software engineers who want to run multiple AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode) side by side in real terminals while retaining full visibility and veto power over actions.
              </div>
            )}
          </div>

          {/* FAQ 2 */}
          <div className={'faq-item' + (openFaq === 1 ? ' open' : '')} onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}>
            <div className="faq-question">
              <span>How do approval gates protect my codebase?</span>
              <span className="faq-toggle">{openFaq === 1 ? '×' : '+'}</span>
            </div>
            {openFaq === 1 && (
              <div className="faq-answer">
                Conduit uses two layers of protection: instant regex pattern detection for dangerous shell commands (like force pushes, rm -rf, drop tables) and periodic Bedrock classification. When a gate triggers, the agent is paused and surfaced in an approval modal—nothing is sent without your confirmation.
              </div>
            )}
          </div>

          {/* FAQ 3 */}
          <div className={'faq-item' + (openFaq === 2 ? ' open' : '')} onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}>
            <div className="faq-question">
              <span>Can agents collaborate and talk to each other?</span>
              <span className="faq-toggle">{openFaq === 2 ? '×' : '+'}</span>
            </div>
            {openFaq === 2 && (
              <div className="faq-answer">
                Yes. Agents in the same project can share context via the Project Wiki (Karpathy's LLM-wiki pattern), access shared folders (`shared_content/`), and communicate directly via MCP tools (`message_agent`, `list_teammates`).
              </div>
            )}
          </div>

          {/* FAQ 4 */}
          <div className={'faq-item' + (openFaq === 3 ? ' open' : '')} onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}>
            <div className="faq-question">
              <span>Is my data private and can I run it locally?</span>
              <span className="faq-toggle">{openFaq === 3 ? '×' : '+'}</span>
            </div>
            {openFaq === 3 && (
              <div className="faq-answer">
                Yes. Conduit runs entirely on your local machine or private cloud instance. All project data, agent transcripts, and audit logs are stored locally under `~/.conduit/`. HTTP Basic Auth (`CONDUIT_AUTH`) protects the dashboard when deployed remotely.
              </div>
            )}
          </div>

          {/* FAQ 5 */}
          <div className={'faq-item' + (openFaq === 4 ? ' open' : '')} onClick={() => setOpenFaq(openFaq === 4 ? null : 4)}>
            <div className="faq-question">
              <span>What platforms is Conduit available on?</span>
              <span className="faq-toggle">{openFaq === 4 ? '×' : '+'}</span>
            </div>
            {openFaq === 4 && (
              <div className="faq-answer">
                The standalone Windows desktop application (`Conduit.exe`) is available for immediate download. Native packages for macOS (Apple Silicon / Intel) and Linux (AppImage / Debian) are currently in build and coming soon. You can also run Conduit on Linux/macOS directly from source with Node 20+.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Desktop App Download Modal Popup */}
      <DownloadModal isOpen={isDownloadOpen} onClose={() => setIsDownloadOpen(false)} />
    </div>
  );
}
