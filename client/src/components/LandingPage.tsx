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
          <a href="#use-cases" className="landing-nav-link">Use Cases</a>
          <a href="#how-it-works" className="landing-nav-link">How it works</a>
          <a href="#tools" className="landing-nav-link">Integrations</a>
          <a href="#faq" className="landing-nav-link">FAQ</a>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-btn-black" onClick={onOpenConsole}>
            Launch Console <Ic.chevR size={12} />
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

        {/* Floating Agent Mascot Badges */}
        {/* Top Left: Sprout */}
        <div className="hero-floating-badge badge-top-left">
          <div className="floating-user-bubble">Can you chase the 9 overdue invoices?</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar sprout">🌱</span>
            <div className="agent-text">
              <div className="agent-msg">Drafted reminders for all 9. Review before I send?</div>
              <div className="agent-tools">QuickBooks · Gmail</div>
            </div>
          </div>
        </div>

        {/* Top Right: Bunny */}
        <div className="hero-floating-badge badge-top-right">
          <div className="floating-user-bubble">Triage my inbox before standup</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar bunny">🐰</span>
            <div className="agent-text">
              <div className="agent-msg">42 sorted. Only 3 actually need you.</div>
              <div className="agent-tools">Gmail · Calendar</div>
            </div>
          </div>
        </div>

        {/* Mid Left: Cat / Bear */}
        <div className="hero-floating-badge badge-mid-left">
          <div className="floating-user-bubble">Update the CRM from today's calls</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar bear">🐻</span>
            <div className="agent-text">
              <div className="agent-msg">6 records updated, next steps logged.</div>
              <div className="agent-tools">HubSpot · Docs</div>
            </div>
          </div>
        </div>

        {/* Mid Right: Kitten */}
        <div className="hero-floating-badge badge-mid-right">
          <div className="floating-user-bubble">Pull last week's metrics into the deck</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar kitten">🐱</span>
            <div className="agent-text">
              <div className="agent-msg">Slides 4-7 refreshed with fresh numbers.</div>
              <div className="agent-tools">HubSpot · Sheets · Slides</div>
            </div>
          </div>
        </div>

        {/* Bottom Left: Blob */}
        <div className="hero-floating-badge badge-bot-left">
          <div className="floating-user-bubble">Reconcile the team's May expenses</div>
          <div className="floating-agent-card compact">
            <span className="mascot-avatar blob">🌸</span>
            <div className="agent-text">
              <div className="agent-msg">Matching receipts in QuickBooks…</div>
            </div>
          </div>
        </div>

        {/* Bottom Right: Peach */}
        <div className="hero-floating-badge badge-bot-right">
          <div className="floating-user-bubble">Book travel for the offsite</div>
          <div className="floating-agent-card">
            <span className="mascot-avatar peach">🍑</span>
            <div className="agent-text">
              <div className="agent-msg">Flights + hotel held for your approval.</div>
              <div className="agent-tools">Browser · Gmail · Calendar</div>
            </div>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="hero-center-content">
          <div className="hero-pill-badge">
            Backed by <span className="yc-orange">Y</span> Combinator
          </div>

          <h1 className="hero-title">
            AI teammates to hand off<br />
            your <span className="highlight-pill">busywork</span>
          </h1>

          <p className="hero-subtitle">
            Describe the outcome. Conduit completes the work across your files, browser, and inbox.
          </p>

          <div className="hero-actions">
            <button className="hero-cta-button" onClick={onOpenConsole}>
              Launch Conduit Console ↓
            </button>
            <span className="hero-cta-subtext">Start free. No credit card required.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
