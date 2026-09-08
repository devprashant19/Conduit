import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import AgentGrid, { type GridLayout } from './components/AgentGrid';
import SharedContentView from './components/SharedContent';
import ActivityFeed from './components/ActivityFeed';
import ProjectWiki from './components/ProjectWiki';
import MessagesPanel from './components/MessagesPanel';
import GroupChat from './components/GroupChat';
import CommandPalette from './components/CommandPalette';
import CommandPanel from './components/CommandPanel';
import NotificationCenter from './components/NotificationCenter';
import JarvisHud from './components/JarvisHud';
import CreateProjectModal from './components/CreateProjectModal';
import CreateAgentModal from './components/CreateAgentModal';
import GateModal from './components/GateModal';
import PlanModal from './components/PlanModal';
import UsagePanel from './components/UsagePanel';
import Ic, { MOD } from './components/Icons';
import { useWebSocket } from './hooks/useWebSocket';
import { useSpeechInput } from './hooks/useSpeechInput';
import { useWakeWord } from './hooks/useWakeWord';
import { useVoiceConfig } from './hooks/useVoiceConfig';
import SettingsModal from './components/SettingsModal';
import LandingPage from './components/LandingPage';
import ConduitOnboardingTour from './components/onboarding/ConduitOnboardingTour';
import DownloadModal from './components/DownloadModal';
import logoDark from './assets/logo_dark_sm.jpg';
import logoLight from './assets/logo_light_sm.jpg';
import * as api from './api';
import type { Project, Agent, Plan } from './api';

type MainTab = 'terminals' | 'messages' | 'groupchat' | 'shared' | 'wiki' | 'activity' | 'usage';

const LAYOUT_ICONS: { v: GridLayout; Icon: (p: { size?: number }) => JSX.Element; title: string }[] = [
  { v: 'single', Icon: Ic.single, title: 'Single' },
  { v: '2up', Icon: Ic.twoup, title: '2-up' },
  { v: '3up', Icon: Ic.threeup, title: '3-up' },
  { v: 'grid', Icon: Ic.grid, title: 'Grid (splits & resize)' },
  { v: 'canvas', Icon: Ic.canvas, title: 'Canvas (drag & resize)' },
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Map<string, Agent[]>>(new Map());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('terminals');
  const [inConsole, setInConsole] = useState<boolean>(() => {
    return window.location.hash === '#console';
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  // Orchestrator-brain completion cue — shown when the brain finishes a task
  // while the Command panel is closed.
  const [brainDone, setBrainDone] = useState(false);
  const [brainWorking, setBrainWorking] = useState(false);
  const [brainReply, setBrainReply] = useState<{ text: string; ts: number } | null>(null);
  const [quickCmd, setQuickCmd] = useState('');
  const [wakeEnabled, setWakeEnabled] = useState(
    () => localStorage.getItem('conduit:wake') === '1',
  );
  const [wakePhrase, setWakePhrase] = useState(
    () => localStorage.getItem('conduit:wake-phrase') || 'jarvis',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voice = useVoiceConfig();
  const [notifSeen, setNotifSeen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const commandOpenRef = useRef(commandOpen);
  useEffect(() => { commandOpenRef.current = commandOpen; }, [commandOpen]);
  const brainBusyRef = useRef(false);
  const brainConvIdRef = useRef('');
  const selectedProjectRef = useRef<string | null>(null);

  // Transient error toast (start/stop failures etc.)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const showError = (err: unknown) => setToast(err instanceof Error ? err.message : String(err));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [layout, setLayout] = useState<GridLayout>(() => {
    const saved = localStorage.getItem('conduit:layout') as GridLayout | null;
    // Migrate the old 'focus' value away
    if (saved === 'focus' as GridLayout) return 'canvas' as GridLayout;
    return saved || '3up';
  });
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [activeGateAgent, setActiveGateAgent] = useState<{ projectId: string; agentId: string } | null>(null);
  // Pending Supervisor plans, oldest first. The modal shows the head of the queue.
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planDismissed, setPlanDismissed] = useState<Set<string>>(new Set());
  const activePlan = plans.find((p) => !planDismissed.has(p.id)) || null;
  const [contentRefresh, setContentRefresh] = useState(0);

  // Sidebar collapse + resize state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    localStorage.getItem('conduit:sidebar-collapsed') === '1'
  );
  const [sidebarW, setSidebarW] = useState<number>(() => {
    const n = parseInt(localStorage.getItem('conduit:sidebar-w') || '', 10);
    return Number.isFinite(n) && n > 0 ? n : 232;
  });
  useEffect(() => {
    localStorage.setItem('conduit:sidebar-collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem('conduit:sidebar-w', String(sidebarW));
  }, [sidebarW]);

  const sidebarDragCancel = useRef<(() => void) | null>(null);
  useEffect(() => () => { sidebarDragCancel.current?.(); }, []);
  const onSidebarResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarW;
    const move = (ev: MouseEvent) => {
      const w = Math.max(180, Math.min(420, startW + (ev.clientX - startX)));
      setSidebarW(w);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('blur', up);
      document.body.style.cursor = '';
      sidebarDragCancel.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', up);
    document.body.style.cursor = 'col-resize';
    sidebarDragCancel.current = up;
  };


  useEffect(() => {
    localStorage.setItem('conduit:layout', layout);
  }, [layout]);

  // WebSocket
  const ws = useWebSocket((msg) => {
    if (msg.type === 'content:updated') {
      setContentRefresh((n) => n + 1);
    }
    if (msg.type === 'org:changed' || msg.type === 'ws:open') {
      // Something changed a project or agent (or we just reconnected) —
      // refresh the sidebar and every loaded agent list.
      loadProjects();
      setAgents((prev) => {
        for (const pid of prev.keys()) loadAgents(pid);
        return prev;
      });
      const pid = selectedProjectRef.current;
      if (pid) loadPlans(pid);
    }
    if (msg.type === 'brain:event') {
      // The single reliable brain-event sink — ws.onmessage. The Jarvis HUD
      // reads brain state from here via props (its own listener can't attach
      // before the socket exists).
      const p = (msg as { payload?: any }).payload;
      if (p?.kind === 'status') {
        if (p.status === 'thinking') {
          brainBusyRef.current = true;
          setBrainWorking(true);
        } else if (p.status === 'idle' && brainBusyRef.current) {
          brainBusyRef.current = false;
          setBrainWorking(false);
          if (!commandOpenRef.current) setBrainDone(true);
        }
      } else if (p?.kind === 'append' && p.message?.role === 'assistant') {
        setBrainReply({ text: String(p.message.text || ''), ts: Date.now() });
      } else if (p?.kind === 'state') {
        // Conversation switch (new / picked from history) — drop the stale
        // reply so the HUD doesn't show or re-speak a message that belongs
        // to a different conversation.
        const cid = p.state?.currentId;
        if (cid && cid !== brainConvIdRef.current) {
          brainConvIdRef.current = cid;
          setBrainReply(null);
        }
      }
    }
    if (msg.type === 'agent:status' && typeof msg.agentId === 'string' && typeof msg.status === 'string') {
      const { agentId, status } = msg;
      setAgents((prev) => {
        const next = new Map(prev);
        for (const [pid, list] of next) {
          const updated = list.map((a) =>
            a.id === agentId
              ? { ...a, status: status as Agent['status'], pendingGate: status === 'stopped' ? undefined : a.pendingGate }
              : a
          );
          next.set(pid, updated);
        }
        return next;
      });
      if (status === 'stopped') setActiveGateAgent((cur) => (cur?.agentId === agentId ? null : cur));
    }
    if (msg.type === 'gate:triggered') {
      const p = msg as unknown as { projectId: string; agentId: string; prompt: string; source: 'regex' | 'supervisor'; options?: string[] };
      setAgents((prev) => {
        const next = new Map(prev);
        const list = next.get(p.projectId) || [];
        next.set(p.projectId, list.map((a) =>
          a.id === p.agentId ? { ...a, pendingGate: { prompt: p.prompt, source: p.source, options: p.options } } : a
        ));
        return next;
      });
      setActiveGateAgent((cur) => cur ?? { projectId: p.projectId, agentId: p.agentId });
    }
    if (msg.type === 'gate:resolved') {
      const agentId = String(msg.agentId);
      setAgents((prev) => {
        const next = new Map(prev);
        for (const [pid, list] of next) {
          next.set(pid, list.map((a) => a.id === agentId ? { ...a, pendingGate: undefined } : a));
        }
        return next;
      });
      setActiveGateAgent((cur) => (cur?.agentId === agentId ? null : cur));
    }
    if (msg.type === 'plan:created') {
      const plan = msg.plan as Plan;
      if (plan?.id) setPlans((prev) => prev.some((p) => p.id === plan.id) ? prev : [...prev, plan]);
    }
    if (msg.type === 'plan:resolved') {
      const planId = String(msg.planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    }
  });

  const loadProjects = useCallback(async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (err) {
      showError(err);
    }
  }, []);

  const loadAgents = useCallback(async (projectId: string) => {
    try {
      const list = await api.listAgents(projectId);
      setAgents((prev) => new Map(prev).set(projectId, list));
    } catch { /* project may have been deleted */ }
  }, []);

  const loadPlans = useCallback(async (projectId: string) => {
    try {
      const list = await api.listPlans(projectId);
      setPlans((prev) => {
        const others = prev.filter((p) => p.projectId !== projectId);
        return [...others, ...list];
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Open a gate modal for any agent that already has one pending (e.g. after
  // a page reload) — the live gate:triggered event covers the rest.
  useEffect(() => {
    if (activeGateAgent) return;
    for (const [pid, list] of agents) {
      const gated = list.find((a) => a.pendingGate && a.status !== 'stopped');
      if (gated) { setActiveGateAgent({ projectId: pid, agentId: gated.id }); return; }
    }
  }, [agents, activeGateAgent]);

  // Opening the Command panel clears the brain-completion cue.
  useEffect(() => {
    if (commandOpen) setBrainDone(false);
  }, [commandOpen]);

  useEffect(() => {
    selectedProjectRef.current = selectedProjectId;
    if (selectedProjectId) {
      loadAgents(selectedProjectId);
      loadPlans(selectedProjectId);
    }
  }, [selectedProjectId, loadAgents, loadPlans]);

  // Load agents for ALL projects so sidebar can show running counts
  useEffect(() => {
    projects.forEach((p) => {
      if (!agents.has(p.id)) loadAgents(p.id);
    });
    // Auto-select first project if none selected so the studio is never blank
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, selectedProjectId]);

  // If the selected project disappears (deleted elsewhere), deselect it.
  useEffect(() => {
    if (selectedProjectId && projects.length && !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id || null);
      setSelectedAgentId(null);
    }
  }, [projects, selectedProjectId]);

  const projectAgents = selectedProjectId ? agents.get(selectedProjectId) || [] : [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const runningCount = projectAgents.filter((a) => a.status === 'running').length;
  const awaitingCount = projectAgents.filter((a) => a.status === 'awaiting_input').length;
  const idleCount = projectAgents.filter((a) => a.status === 'idle').length;
  const stoppedCount = projectAgents.filter((a) => a.status === 'stopped').length;
  // "alive" = process exists (running / awaiting / idle) — used for Stop-all gating
  const aliveCount = runningCount + awaitingCount + idleCount;

  // Notification center — every agent across all projects that needs you now.
  const awaitingNotifs = useMemo(() => {
    const out: { agentId: string; agentName: string; projectId: string; projectName: string }[] = [];
    for (const p of projects) {
      for (const a of agents.get(p.id) || []) {
        if (a.status === 'awaiting_input') {
          out.push({ agentId: a.id, agentName: a.name, projectId: p.id, projectName: p.name });
        }
      }
    }
    return out;
  }, [projects, agents]);
  const notifUnread = awaitingNotifs.filter((n) => !notifSeen.has(n.agentId)).length;

  // Conduit-wide running / idle counts for the Keeper HUD.
  const globalCounts = useMemo(() => {
    let running = 0;
    let idle = 0;
    for (const list of agents.values()) {
      for (const a of list) {
        if (a.status === 'running') running++;
        else if (a.status === 'idle') idle++;
      }
    }
    return { running, idle };
  }, [agents]);

  // Drop seen ids whose agent no longer needs you — so it re-badges next time.
  useEffect(() => {
    const ids = new Set(awaitingNotifs.map((n) => n.agentId));
    setNotifSeen((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [awaitingNotifs]);

  // Keyboard shortcuts: ⌘K/Ctrl+K (palette), ⌘1–5 (focus agent)
  // `capture: true` fires in the capture phase so it preempts xterm's textarea
  // even when an xterm instance has focus. preventDefault + stopPropagation
  // then prevents the key from reaching xterm at all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); e.stopPropagation();
        setPaletteOpen(true); return;
      }
      if (mod && e.key === '/') {
        e.preventDefault(); e.stopPropagation();
        setPaletteOpen(true); return;
      }
      if (mod && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault(); e.stopPropagation();
        setCommandOpen((o) => !o); return;
      }
      // ⌘; / Ctrl+; — toggle voice recording to the Keeper (auto-sends on
      // final result via the header quick-command's speech callback).
      if (mod && e.key === ';') {
        e.preventDefault(); e.stopPropagation();
        quickSpeechRef.current?.toggle();
        return;
      }
      if (mod && /^[1-9]$/.test(e.key)) {
        e.preventDefault(); e.stopPropagation();
        const i = parseInt(e.key, 10) - 1;
        const a = projectAgents[i];
        if (a) setSelectedAgentId(a.id);
        return;
      }
      if (e.key === 'Escape') { setPaletteOpen(false); setCommandOpen(false); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [projectAgents]);

  // Handlers
  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSelectedAgentId(null);
  };

  const handleSelectAgent = (projectId: string, agentId: string) => {
    setSelectedProjectId(projectId);
    setSelectedAgentId(agentId);
    setMainTab('terminals');
  };

  const handleCreateProject = async (data: { name: string; cwd: string; description?: string }) => {
    try {
      const project = await api.createProject(data);
      setShowNewProject(false);
      await loadProjects();
      setSelectedProjectId(project.id);
    } catch (err) {
      showError(err);
      throw err;
    }
  };

  const handleCreateAgent = async (data: { name: string; cli: string; cwd?: string; role?: string; flags?: Agent['flags'] }) => {
    if (!selectedProjectId) return;
    try {
      await api.createAgent(selectedProjectId, data);
      setShowNewAgent(false);
      await loadAgents(selectedProjectId);
    } catch (err) {
      showError(err);
      throw err;
    }
  };

  const handleStartAgent = async (agent: Agent) => {
    try {
      await api.startAgent(agent.projectId, agent.id);
    } catch (err) {
      showError(err);
    }
    await loadAgents(agent.projectId);
  };
  const handleStopAgent = async (agent: Agent) => {
    try {
      await api.stopAgent(agent.projectId, agent.id);
    } catch (err) {
      showError(err);
    }
    await loadAgents(agent.projectId);
  };
  const handleRestartAgent = async (agent: Agent) => {
    try {
      await api.restartAgent(agent.projectId, agent.id);
    } catch (err) {
      showError(err);
    }
    // The daemon restarts asynchronously; refresh once it has had a moment.
    setTimeout(() => loadAgents(agent.projectId), 1000);
  };
  const handleDeleteAgent = async (agent: Agent) => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    try {
      await api.deleteAgent(agent.projectId, agent.id);
    } catch (err) {
      showError(err);
    }
    if (selectedAgentId === agent.id) setSelectedAgentId(null);
    if (activeGateAgent?.agentId === agent.id) setActiveGateAgent(null);
    await loadAgents(agent.projectId);
  };

  const handleResolveGate = async (decision: 'approve' | 'reject' | 'custom', customInput?: string) => {
    if (!activeGateAgent) return;
    const { projectId, agentId } = activeGateAgent;
    try {
      await api.resolveGate(projectId, agentId, decision, customInput);
    } catch (err) {
      // A 409 means the gate was already cleared elsewhere — just close.
      if (!(err instanceof Error && /No pending gate/.test(err.message))) throw err;
    }
    setActiveGateAgent(null);
    setAgents((prev) => {
      const next = new Map(prev);
      const list = next.get(projectId) || [];
      next.set(projectId, list.map((a) => a.id === agentId ? { ...a, pendingGate: undefined } : a));
      return next;
    });
  };

  const handleResolvePlan = async (decision: 'approve' | 'reject', reason?: string) => {
    if (!activePlan) return;
    const plan = activePlan;
    const r = await api.resolvePlan(plan.projectId, plan.id, decision, reason);
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    if (decision === 'approve' && !r.delivered) setToast(r.note || 'The target agent is not running — nothing was sent.');
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!confirm(`Delete project "${project?.name}"? Running agents will be stopped.`)) return;
    const removeData = confirm('Also remove shared content and wiki data?');
    try {
      await api.deleteProject(selectedProjectId, removeData);
    } catch (err) {
      showError(err);
      return;
    }
    setSelectedProjectId(null);
    setSelectedAgentId(null);
    await loadProjects();
  };

  const handleStartAll = async (projectId?: string) => {
    const pid = projectId || selectedProjectId;
    if (!pid) return;
    const list = agents.get(pid) || [];
    const stopped = list.filter((a) => a.status === 'stopped');
    const results = await Promise.allSettled(stopped.map((a) => api.startAgent(pid, a.id)));
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length) showError(failed[0].reason);
    await loadAgents(pid);
  };

  const handleStopAll = async (projectId?: string) => {
    const pid = projectId || selectedProjectId;
    if (!pid) return;
    const list = agents.get(pid) || [];
    // Stop everything that is alive — running, awaiting_input, or idle
    const alive = list.filter((a) => a.status !== 'stopped');
    await Promise.allSettled(alive.map((a) => api.stopAgent(pid, a.id)));
    await loadAgents(pid);
  };

  // Fire a one-off command at the orchestrator brain straight from the header,
  // without opening the Command drawer.
  const fireQuickCmd = (textArg?: string) => {
    const text = (textArg ?? quickCmd).trim();
    if (!text || brainWorking) return;
    if (!ws.send({ type: 'brain:send', message: text })) {
      setToast('Not connected to Conduit yet — try again in a moment.');
      return;
    }
    setQuickCmd('');
    brainBusyRef.current = true;
    setBrainWorking(true);
  };

  // Voice input for the header quick-command box — speak, and on a final
  // result fire it automatically (no manual send).
  const quickSpeech = useSpeechInput(
    (text, final) => { setQuickCmd(text); if (final && text.trim()) fireQuickCmd(text); },
    { provider: voice.cfg.stt.provider, language: voice.cfg.stt.language },
  );
  // Keep toggle reachable from the global keydown listener without forcing it
  // to re-bind on every render.
  const quickSpeechRef = useRef(quickSpeech);
  useEffect(() => { quickSpeechRef.current = quickSpeech; });

  // Always-on wake word — "<phrase>, <command>" drives the brain hands-free.
  // Push-to-talk and the wake word share the browser's single recogniser, so
  // the wake word pauses while the user is actively recording.
  const wake = useWakeWord({
    enabled: wakeEnabled && !quickSpeech.listening,
    phrase: wakePhrase,
    language: voice.cfg.stt.language,
    onWake: () => { setToast(`Listening — say your command for The Keeper.`); },
    onCommand: (text) => fireQuickCmd(text),
  });
  useEffect(() => {
    localStorage.setItem('conduit:wake', wakeEnabled ? '1' : '0');
  }, [wakeEnabled]);
  useEffect(() => {
    localStorage.setItem('conduit:wake-phrase', wakePhrase);
  }, [wakePhrase]);

  const logoImg = logoDark;

  const [tourForceStart, setTourForceStart] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const ensureDemoWorkspace = useCallback(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
      loadAgents(projects[0].id);
    }
  }, [projects, selectedProjectId, loadAgents]);

  const handleViewChange = useCallback((v: 'landing' | 'console') => {
    if (v === 'landing') {
      window.location.hash = '';
      setInConsole(false);
    } else {
      window.location.hash = '#console';
      setInConsole(true);
      ensureDemoWorkspace();
    }
  }, [ensureDemoWorkspace]);

  const handleStartTour = useCallback(() => {
    handleViewChange('landing');
    setTourForceStart(true);
  }, [handleViewChange]);

  const appCls = ['app'];
  if (sidebarCollapsed) appCls.push('sb-hidden');

  return (
    <>
      {!inConsole ? (
        <LandingPage
          onOpenConsole={() => {
            window.location.hash = '#console';
            setInConsole(true);
            ensureDemoWorkspace();
          }}
          onStartTour={handleStartTour}
        />
      ) : (
        <div className={appCls.join(' ')} style={{ '--sidebar-w': sidebarW + 'px' } as React.CSSProperties}>
      <div className="ambient-mesh" aria-hidden="true" />
      <header className="header">
        <div className="header-l">
          <button
            className="hbtn mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ padding: '0 6px' }}
          >
            <Ic.menu size={16} />
          </button>
          <button
            className="hbtn sb-toggle desktop-only"
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            onClick={() => setSidebarCollapsed((c) => !c)}
          >
            {sidebarCollapsed ? <Ic.panelLeftOpen size={14} /> : <Ic.panelLeft size={14} />}
          </button>
          <div className="brand">
            <div className="brand-mark">
              <img src={logoImg} alt="Conduit" />
            </div>
            <span>Conduit</span>
          </div>
          {selectedProject && (
            <div className="breadcrumb" data-tour="workspace">
              <span className="sep">/</span>
              <span className="proj">{selectedProject.name}</span>
              <span className="proj-meta">{selectedProject.cwd}</span>
            </div>
          )}
        </div>
        <div className="header-r">
          <button className="hbtn kbd" onClick={() => setPaletteOpen(true)}>
            <Ic.search size={12} />
            <span>Search</span>
            <kbd>{MOD}K</kbd>
          </button>
          <div className={'cmd-quick' + (brainWorking ? ' working' : '')} data-tour="keeper">
            <button
              className="cmd-quick-mark"
              title="Open Command (⌘J)"
              onClick={() => setCommandOpen(true)}
            >
              <Ic.logo size={13} />
              {brainDone && <span className="cmd-trigger-dot" />}
            </button>
            <input
              className="cmd-quick-input"
              value={quickCmd}
              onChange={(e) => setQuickCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); fireQuickCmd(); }
              }}
              placeholder={brainWorking ? 'The Keeper is working…' : 'Ask The Keeper…'}
              disabled={brainWorking}
            />
            {quickSpeech.supported && (
              <button
                className={'cmd-quick-mic' + (quickSpeech.listening ? ' on' : '')}
                title={quickSpeech.error || (quickSpeech.listening ? 'Stop listening' : 'Voice input')}
                onClick={quickSpeech.toggle}
              >
                <Ic.mic size={13} />
              </button>
            )}
            <kbd>{MOD}J</kbd>
          </div>
          <NotificationCenter
            notifs={awaitingNotifs}
            unread={notifUnread}
            onOpen={() => setNotifSeen(new Set(awaitingNotifs.map((n) => n.agentId)))}
            onSelect={handleSelectAgent}
          />
          <div className="layout-seg" role="tablist" aria-label="Layout">
            {LAYOUT_ICONS.map(({ v, Icon, title }) => (
              <button
                key={v}
                className={layout === v ? 'active' : ''}
                title={title}
                onClick={() => setLayout(v)}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
          <button
            className="hbtn"
            title="Website & Overview"
            onClick={() => {
              window.location.hash = '';
              setInConsole(false);
            }}
            style={{ fontWeight: 600, color: 'var(--text-0)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Website
          </button>
          <button
            className="hbtn"
            title="Product Tour (2-Phase Onboarding)"
            onClick={handleStartTour}
            style={{ fontWeight: 600, color: 'var(--text-1)' }}
          >
            Tour
          </button>
          <button
            className="hbtn"
            title="Voice settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Ic.settings size={13} />
          </button>
          {selectedProject && (
            <button className="hbtn danger" title="Delete project" onClick={handleDeleteProject}>
              <Ic.x size={12} />
            </button>
          )}
        </div>
      </header>

      <Sidebar
        projects={projects}
        agents={agents}
        selectedProjectId={selectedProjectId}
        selectedAgentId={selectedAgentId}
        onSelectProject={handleSelectProject}
        onSelectAgent={handleSelectAgent}
        onNewProject={() => setShowNewProject(true)}
        onNewAgent={() => setShowNewAgent(true)}
        onDeleteAgent={handleDeleteAgent}
        onStartAll={handleStartAll}
        onStopAll={handleStopAll}
        onExpandProject={loadAgents}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="sb-resizer" onMouseDown={onSidebarResizeDown} title="Drag to resize sidebar" />

      <section className="gr" data-tour="agents">
        <div className="canvas-frame" aria-hidden="true" />
        {selectedProjectId ? (
          <>
            <div className="gr-subbar">
              <div className="gr-tabs">
                <button
                  className={'gr-tab' + (mainTab === 'terminals' ? ' active' : '')}
                  onClick={() => setMainTab('terminals')}
                >
                  <Ic.terminal size={12} /> Terminals
                  <span className="count">{projectAgents.length}</span>
                </button>
                <button
                  className={'gr-tab' + (mainTab === 'messages' ? ' active' : '')}
                  onClick={() => setMainTab('messages')}
                >
                  <Ic.message size={12} /> MCP Messages
                </button>
                <button
                  className={'gr-tab' + (mainTab === 'groupchat' ? ' active' : '')}
                  onClick={() => setMainTab('groupchat')}
                >
                  <Ic.message size={12} /> Group Chat
                </button>
                <button
                  className={'gr-tab' + (mainTab === 'shared' ? ' active' : '')}
                  onClick={() => setMainTab('shared')}
                >
                  <Ic.folder size={12} /> Shared
                </button>
                <button
                  className={'gr-tab' + (mainTab === 'wiki' ? ' active' : '')}
                  onClick={() => setMainTab('wiki')}
                >
                  <Ic.book size={12} /> Wiki
                </button>
                <button
                  className={'gr-tab' + (mainTab === 'activity' ? ' active' : '')}
                  onClick={() => setMainTab('activity')}
                >
                  <Ic.activity size={12} /> Activity
                </button>
                <button
                  className={'gr-tab' + (mainTab === 'usage' ? ' active' : '')}
                  onClick={() => setMainTab('usage')}
                >
                  <Ic.activity size={12} /> Usage
                </button>
              </div>
              <div className="gr-subbar-r">
                {mainTab === 'terminals' && projectAgents.length > 0 && (
                  <>
                    <button
                      className="batch-btn"
                      onClick={() => handleStartAll()}
                      disabled={stoppedCount === 0}
                    >
                      <Ic.play size={10} /> Start all
                    </button>
                    <button
                      className="batch-btn"
                      onClick={() => handleStopAll()}
                      disabled={aliveCount === 0}
                    >
                      <Ic.stop size={9} /> Stop all
                    </button>
                  </>
                )}
                <button className="batch-btn primary" onClick={() => setShowNewAgent(true)}>
                  <Ic.plus size={11} /> New agent
                </button>
              </div>
            </div>

            {mainTab === 'terminals' && (
              <AgentGrid
                key={selectedProjectId}
                agents={projectAgents}
                layout={layout}
                focusedId={selectedAgentId}
                onFocus={setSelectedAgentId}
                onStart={handleStartAgent}
                onStop={handleStopAgent}
                onRestart={handleRestartAgent}
                onDelete={handleDeleteAgent}
                ws={ws}
                projectId={selectedProjectId}
              />
            )}
            {mainTab === 'messages' && (
              <MessagesPanel key={selectedProjectId} projectId={selectedProjectId} agents={projectAgents} ws={ws} />
            )}
            {mainTab === 'groupchat' && (
              <GroupChat key={selectedProjectId} projectId={selectedProjectId} agents={projectAgents} ws={ws} />
            )}
            {mainTab === 'shared' && (
              <SharedContentView key={selectedProjectId} projectId={selectedProjectId} refreshTrigger={contentRefresh} />
            )}
            {mainTab === 'wiki' && <ProjectWiki key={selectedProjectId} projectId={selectedProjectId} />}
            {mainTab === 'activity' && <ActivityFeed key={selectedProjectId} projectId={selectedProjectId} ws={ws} />}
            {mainTab === 'usage' && <UsagePanel />}
          </>
        ) : (
          <div className="panel-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div>Select or create a project to get started</div>
            <button className="batch-btn primary" onClick={() => setShowNewProject(true)}>
              <Ic.plus size={11} /> New Project
            </button>
          </div>
        )}
      </section>

      <footer className="st">
        <div className="st-l" data-tour="supervisor">
          {selectedProjectId && (
            <>
              <span className="st-item">
                <span className="sdot running" style={{ width: 6, height: 6 }} /> {runningCount} running
              </span>
              {awaitingCount > 0 && (
                <span className="st-item" style={{ color: 'var(--attn)' }}>
                  <span className="sdot awaiting_input" style={{ width: 6, height: 6 }} /> {awaitingCount} awaiting you
                </span>
              )}
              {idleCount > 0 && (
                <span className="st-item" style={{ color: 'var(--text-2)' }}>
                  <span className="sdot idle" style={{ width: 6, height: 6 }} /> {idleCount} idle
                </span>
              )}
              <span className="st-item" style={{ color: 'var(--text-2)' }}>
                <span className="sdot stopped" style={{ width: 6, height: 6 }} /> {stoppedCount} stopped
              </span>
            </>
          )}
        </div>
        <div className="st-r">
          <span className="st-kbd"><kbd>{MOD}K</kbd> palette</span>
          <span className="st-kbd"><kbd>{MOD}J</kbd> command</span>
          <span className="st-kbd"><kbd>{MOD};</kbd> voice</span>
          <span className="st-kbd"><kbd>{MOD}1-9</kbd> agent</span>
          <span className={'st-item ' + (ws.connected ? 'ok' : 'err')} title={ws.connected ? 'Live connection to the Conduit server' : 'Reconnecting to the Conduit server…'}>
            <span className={'sdot ' + (ws.connected ? 'running' : 'stopped')} style={{ width: 6, height: 6 }} />
            {ws.connected ? 'connected' : 'reconnecting…'}
          </span>
          {ws.connected && !ws.daemon && (
            <span className="st-item err" title="The agent daemon is not reachable. Start it with: npm run daemon">
              daemon offline
            </span>
          )}
        </div>
      </footer>

      {toast && (
        <div className="toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        agents={projectAgents}
        onSelectAgent={setSelectedAgentId}
        onLayout={setLayout}
        onNewProject={() => setShowNewProject(true)}
        onNewAgent={() => setShowNewAgent(true)}
        onStartAll={selectedProjectId ? () => handleStartAll() : undefined}
        onStopAll={selectedProjectId ? () => handleStopAll() : undefined}
        onStartTour={handleStartTour}
      />

      <CommandPanel
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        ws={ws}
        sttCfg={{ provider: voice.cfg.stt.provider, language: voice.cfg.stt.language }}
      />

      {!commandOpen && (
        <JarvisHud
          send={(m) => { ws.send(m); }}
          working={brainWorking}
          lastReply={brainReply}
          onClearReply={() => setBrainReply(null)}
          sttCfg={{ provider: voice.cfg.stt.provider, language: voice.cfg.stt.language }}
          ttsCfg={{ ...voice.cfg.tts, language: voice.cfg.stt.language }}
          headerListening={quickSpeech.listening}
          wake={{
            enabled: wakeEnabled,
            supported: wake.supported,
            armed: wake.armed,
            phrase: wakePhrase,
            onToggle: () => setWakeEnabled((v) => !v),
            onPhraseChange: setWakePhrase,
          }}
          awaiting={awaitingNotifs}
          running={globalCounts.running}
          idle={globalCounts.idle}
          onSelectAgent={handleSelectAgent}
          onOpenFull={() => setCommandOpen(true)}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={voice.refresh}
        onRestartTour={handleStartTour}
      />

      {showNewProject && (
        <CreateProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={handleCreateProject}
        />
      )}
      {showNewAgent && selectedProject && (
        <CreateAgentModal
          projectCwd={selectedProject.cwd}
          onClose={() => setShowNewAgent(false)}
          onCreate={handleCreateAgent}
        />
      )}
      {activeGateAgent && (() => {
        const gatedAgent = agents.get(activeGateAgent.projectId)?.find(a => a.id === activeGateAgent.agentId);
        return (
          <GateModal
            project={projects.find(p => p.id === activeGateAgent.projectId)}
            agent={gatedAgent}
            gate={gatedAgent?.pendingGate}
            onClose={() => setActiveGateAgent(null)}
            onResolve={handleResolveGate}
          />
        );
      })()}
      {activePlan && (
        <PlanModal
          key={activePlan.id}
          project={projects.find(p => p.id === activePlan.projectId)}
          plan={activePlan}
          queued={plans.filter((p) => !planDismissed.has(p.id)).length - 1}
          onClose={() => setPlanDismissed((prev) => new Set(prev).add(activePlan.id))}
          onResolve={handleResolvePlan}
        />
      )}
      </div>
      )}

      <ConduitOnboardingTour
        forceStart={tourForceStart}
        onClose={() => setTourForceStart(false)}
        onViewChange={handleViewChange}
        onTabChange={(t) => setMainTab(t)}
        onEnsureDemoWorkspace={ensureDemoWorkspace}
        onOpenDownloadModal={() => setIsDownloadOpen(true)}
        onCloseDownloadModal={() => setIsDownloadOpen(false)}
      />
      <DownloadModal isOpen={isDownloadOpen} onClose={() => setIsDownloadOpen(false)} />
    </>
  );
}
