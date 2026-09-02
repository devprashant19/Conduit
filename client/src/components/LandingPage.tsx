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

      {/* Section 2: How It Works (Image 2) */}
      <section id="how-it-works" className="landing-section how-it-works-sec">
        <h2 className="section-title">How it works</h2>

        <div className="how-it-works-grid">
          {/* Step 01 */}
          <div className="how-step-row">
            <div className="how-step-text">
              <span className="step-num">01</span>
              <h3 className="step-title">Say what you want done.</h3>
              <p className="step-desc">
                Conduit plans the steps and works on its own. Follow along anytime.
              </p>
            </div>
            <div className="how-step-preview">
              <div className="preview-container-box">
                <div className="preview-prompt-card">
                  <span className="preview-prompt-text">
                    Merge the two lead exports into one clean tracker and flag anything that does not reconcile.
                  </span>
                  <span className="preview-submit-arrow">↑</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 02 */}
          <div className="how-step-row">
            <div className="how-step-text">
              <span className="step-num">02</span>
              <h3 className="step-title">Review and sign-off.</h3>
              <p className="step-desc">
                Finished work comes back to the same chat. Nothing goes out without your OK.
              </p>
            </div>
            <div className="how-step-preview">
              <div className="preview-container-box">
                <div className="preview-result-card">
                  <div className="preview-user-query">
                    Merge the two lead exports into one clean tracker and flag anything that does not reconcile.
                  </div>
                  <div className="preview-status-tag">
                    <span className="check-icon">✓</span> DONE
                  </div>
                  <div className="preview-summary-text">
                    One tracker, 482 rows, dupes collapsed. Six rows would not reconcile, flagged with reasons.
                  </div>
                  <button className="preview-action-pill" onClick={onOpenConsole}>
                    Open the tracker
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Works with your existing tools & 10x Faster Showcase (Image 3) */}
      <section id="tools" className="landing-section tools-sec">
        <h2 className="section-title">Works with your existing tools</h2>

        {/* Integration Logo Grid */}
        <div className="tools-logo-cloud">
          <div className="tool-logo-pill" title="Slack"><span className="logo-emoji">💬</span> Slack</div>
          <div className="tool-logo-pill" title="GitHub"><span className="logo-emoji">🐙</span> GitHub</div>
          <div className="tool-logo-pill" title="Google Drive"><span className="logo-emoji">📁</span> Google Drive</div>
          <div className="tool-logo-pill" title="Gmail"><span className="logo-emoji">✉️</span> Gmail</div>
          <div className="tool-logo-pill" title="Notion"><span className="logo-emoji">📝</span> Notion</div>
          <div className="tool-logo-pill" title="HubSpot"><span className="logo-emoji">🟧</span> HubSpot</div>
          <div className="tool-logo-pill" title="Google Sheets"><span className="logo-emoji">📊</span> Sheets</div>
          <div className="tool-logo-pill" title="Linear"><span className="logo-emoji">📐</span> Linear</div>
          <div className="tool-logo-pill" title="Zoom"><span className="logo-emoji">📹</span> Zoom</div>
          <div className="tool-logo-pill" title="Calendar"><span className="logo-emoji">📅</span> Calendar</div>
          <div className="tool-logo-pill" title="Stripe"><span className="logo-emoji">💳</span> Stripe</div>
          <div className="tool-logo-pill" title="QuickBooks"><span className="logo-emoji">📗</span> QuickBooks</div>
        </div>

        {/* 10x Faster Showcase */}
        <div className="faster-showcase-wrap">
          <h2 className="section-title faster-title">
            Do your best work <span className="highlight-pill">10x faster</span>
          </h2>

          {/* Pill Tabs */}
          <div className="showcase-pill-tabs">
            <button className="showcase-tab-btn active">Data</button>
            <button className="showcase-tab-btn">Email</button>
            <button className="showcase-tab-btn">Research</button>
            <button className="showcase-tab-btn">Sales</button>
            <button className="showcase-tab-btn">Orders & billing</button>
            <button className="showcase-tab-btn">Monitoring</button>
            <button className="showcase-tab-btn">Recruiting</button>
          </div>

          {/* Showcase Feature Card */}
          <div className="showcase-card-container">
            <div className="showcase-feature-card">
              <div className="feature-header-row">
                <span className="feature-step-tag">01</span>
                <span className="feature-step-name">Stalled-thread nudges</span>
                <span className="feature-tools-badge">Gmail · Sheets</span>
              </div>
              <p className="feature-step-desc">
                Find every thread waiting on a reply for <span className="param-pill">[days]+</span> days and draft a polite nudge on each.
              </p>
              <div className="feature-action-row">
                <button className="preview-action-pill" onClick={onOpenConsole}>
                  Run this flow in Console →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Team Demo & Calendar Booking Card (Image 4) */}
      <section className="landing-section demo-sec">
        <h2 className="section-title">
          See what Conduit can do for<br />
          your whole team.
        </h2>
        <p className="section-subtitle">
          Get help with pricing and plans, schedule a walkthrough, explore use-cases for your team, and more.
        </p>

        <div className="calendar-card-wrap">
          <div className="calendar-card">
            {/* Left sidebar: Host details */}
            <div className="cal-host-col">
              <div className="cal-host-avatar">👨‍💻</div>
              <div className="cal-host-meta">
                <span className="cal-host-name">Conduit Founders</span>
                <h3 className="cal-meeting-title">30 min with Conduit team</h3>
              </div>
              <p className="cal-meeting-desc">
                Set up Conduit for your team. Get help with pricing and plans, schedule a demo, explore use-cases, and more.
              </p>
              <div className="cal-meeting-details">
                <div className="cal-detail-item">⏱ 30m</div>
                <div className="cal-detail-item">📹 Google Meet</div>
                <div className="cal-detail-item">🌐 Asia/Kolkata</div>
              </div>
            </div>

            {/* Middle: Month Date Grid */}
            <div className="cal-grid-col">
              <div className="cal-month-header">
                <span className="cal-month-name">September 2026</span>
                <div className="cal-nav-arrows">
                  <span className="arrow">‹</span>
                  <span className="arrow">›</span>
                </div>
              </div>
              <div className="cal-days-header">
                <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
              </div>
              <div className="cal-dates-grid">
                <span className="dim">30</span><span className="dim">31</span>
                <span>1</span><span>2</span><span className="active-date">3</span><span>4</span><span>5</span>
                <span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
                <span>13</span><span>14</span><span>15</span><span>16</span><span>17</span><span>18</span><span>19</span>
                <span>20</span><span>21</span><span>22</span><span>23</span><span>24</span><span>25</span><span>26</span>
                <span>27</span><span>28</span><span>29</span><span>30</span>
              </div>
            </div>

            {/* Right: Time Slots */}
            <div className="cal-slots-col">
              <div className="cal-slots-header">
                <span className="cal-day-label">Thu 3rd</span>
                <div className="time-format-toggle">
                  <span className="active">12h</span>
                  <span>24h</span>
                </div>
              </div>
              <div className="cal-slot-list">
                <button className="cal-slot-btn" onClick={onOpenConsole}>10:30pm</button>
                <button className="cal-slot-btn" onClick={onOpenConsole}>11:00pm</button>
                <button className="cal-slot-btn" onClick={onOpenConsole}>11:30pm</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: FAQ & Bottom Mascot Sign-off (Image 5) */}
      <section id="faq" className="landing-section faq-sec">
        <h2 className="section-title">Frequently asked questions</h2>

        <div className="faq-list">
          {/* FAQ 1 */}
          <div className="faq-item open">
            <div className="faq-question">
              <span>Who is Conduit for?</span>
              <span className="faq-toggle">×</span>
            </div>
            <div className="faq-answer">
              Anyone whose work sprawls across tabs, files, and tools. Founders, chiefs of staff, operations and sales teams, team leads, and product and engineering managers are our power users. We are onboarding more professionals every day. If repetitive computer work eats your week, Conduit is for you.
            </div>
          </div>

          {/* FAQ 2 */}
          <div className="faq-item">
            <div className="faq-question">
              <span>How does Conduit work?</span>
              <span className="faq-toggle">+</span>
            </div>
          </div>

          {/* FAQ 3 */}
          <div className="faq-item">
            <div className="faq-question">
              <span>Does it work with the tools I already use?</span>
              <span className="faq-toggle">+</span>
            </div>
          </div>

          {/* FAQ 4 */}
          <div className="faq-item">
            <div className="faq-question">
              <span>Is my data secure and private?</span>
              <span className="faq-toggle">+</span>
            </div>
          </div>
        </div>

        {/* Bottom Mascot Parade & Final Hero Sign-off */}
        <div className="footer-signoff-wrap">
          <div className="mascot-parade-row">
            <span className="parade-mascot">👾</span>
            <span className="parade-mascot">🐻</span>
            <span className="parade-mascot">🌱</span>
            <span className="parade-mascot">🐰</span>
            <span className="parade-mascot">🌸</span>
            <span className="parade-mascot">🍑</span>
          </div>
          <h2 className="signoff-title">
            Consider it <span className="highlight-pill">done.</span>
          </h2>
          <button className="landing-btn-black signoff-btn" onClick={onOpenConsole}>
            Launch Conduit Console <Ic.chevR size={12} />
          </button>
        </div>
      </section>
    </div>
  );
}
