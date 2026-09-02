/**
 * Supervisor watcher — the "watchdog" that observes each running agent.
 *
 * Two paths, both on ANSI-stripped text:
 *   fast path  — regex gates (y/n prompts, destructive commands) fire at once
 *   slow path  — batches of output go to the Strands Supervisor on Bedrock,
 *                which classifies them (progress / blocker / question /
 *                risky_action / noise) and speaks a one-line summary
 *
 * Runs inside the daemon (it owns the agents). Codex agents are observed via
 * their structured item stream; PTY agents via raw output.
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import * as runtime from '../daemon/runtime.js';
import { createSupervisorAgent, type SupervisorUpdate } from './agent.js';
import { supervisorDisabled } from './config.js';
import {
  appendGroupChat, updateAgent, getAgent, getProjectData, readRecentAudit,
  type GroupChatEntry,
} from '../storage.js';
import { checkGate, stripAnsi } from '../gatePatterns.js';
import type { DaemonMessage } from '../daemon/protocol.js';

type Broadcast = (msg: DaemonMessage) => void;

interface WatcherState {
  agentId: string;
  projectId: string;
  broadcast: Broadcast;
  /** Stripped text waiting for the next Supervisor call. */
  buffer: string;
  /** Rolling tail of stripped text for cross-chunk prompt detection. */
  tail: string;
  timer: ReturnType<typeof setTimeout> | null;
  isProcessing: boolean;
  lastCallAt: number;
  lastGateReason: string;
  lastGateAt: number;
  /** Last few summaries — gives the (stateless) Supervisor short-term memory. */
  recent: string[];
  teardown: () => void;
}

const watchers = new Map<string, WatcherState>();

const DEBOUNCE_MS = 10_000;          // quiet period before a batch goes to Bedrock
const MIN_CALL_INTERVAL_MS = 20_000; // never call Bedrock more often than this per agent
const MAX_BATCH_CHARS = 12_000;      // tail of the batch that is actually sent
const GATE_REPEAT_MS = 60_000;       // same gate reason within this window is ignored

const logPath = path.join(os.homedir(), '.conduit', 'supervisor-log.jsonl');

/** If Bedrock is unreachable (no creds, no access) back off instead of retrying every batch. */
let supervisorBackoffUntil = 0;
let supervisorWarned = false;

function logUpdate(entry: unknown) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[watcher] Failed to write supervisor-log.jsonl:', err);
  }
}

function supervisorEntry(text: string, classification: GroupChatEntry['classification']): GroupChatEntry {
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    role: 'supervisor',
    sender: 'Supervisor',
    text,
    classification,
  };
}

/** Post a supervisor line to the project's group chat and push it live. */
function postToGroupChat(state: WatcherState, entry: GroupChatEntry) {
  try { appendGroupChat(state.projectId, entry); }
  catch (err) { console.error('[watcher] Failed to append to groupchat:', err); }
  state.broadcast({ kind: 'event', event: 'groupchat:message', payload: { ...entry, projectId: state.projectId } });
}

/**
 * Raise a human-approval gate for an agent. Idempotent: an agent with a
 * pending gate keeps it until the human resolves it.
 */
export function triggerGate(
  projectId: string,
  agentId: string,
  prompt: string,
  source: 'regex' | 'supervisor',
  broadcast: Broadcast,
): boolean {
  const agent = getAgent(projectId, agentId);
  if (!agent) return false;
  if (agent.pendingGate) return false;

  const clean = prompt.trim().slice(-1500);
  updateAgent(projectId, agentId, { pendingGate: { prompt: clean, source } });

  const entry = supervisorEntry(
    source === 'regex'
      ? `[Gate] ${agent.name} needs your decision:\n${clean.slice(-400)}`
      : `[Gate] ${agent.name} is about to do something risky:\n${clean}`,
    'risky_action',
  );
  try { appendGroupChat(projectId, entry); } catch { /* ignore */ }
  broadcast({ kind: 'event', event: 'groupchat:message', payload: { ...entry, projectId } });
  broadcast({ kind: 'event', event: 'gate:triggered', agentId, projectId, prompt: clean, source });
  return true;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isCredentialError(msg: string): boolean {
  return /credential|AccessDenied|UnrecognizedClient|ExpiredToken|not authorized|security token|Region is missing|ENOTFOUND|ECONNREFUSED/i.test(msg);
}

async function processBuffer(state: WatcherState) {
  if (state.isProcessing || !state.buffer.trim()) return;
  if (supervisorDisabled()) { state.buffer = ''; return; }
  if (Date.now() < supervisorBackoffUntil) { state.buffer = ''; return; }

  const sinceLast = Date.now() - state.lastCallAt;
  if (sinceLast < MIN_CALL_INTERVAL_MS) {
    // Too soon — re-arm the timer for the remainder rather than dropping the batch.
    if (!state.timer) {
      state.timer = setTimeout(() => { state.timer = null; void processBuffer(state); }, MIN_CALL_INTERVAL_MS - sinceLast);
    }
    return;
  }

  state.isProcessing = true;
  state.lastCallAt = Date.now();
  let textToAnalyze = state.buffer;
  state.buffer = '';
  if (textToAnalyze.length > MAX_BATCH_CHARS) textToAnalyze = '…' + textToAnalyze.slice(-MAX_BATCH_CHARS);

  const project = getProjectData(state.projectId);
  const agent = project?.agents.find((a) => a.id === state.agentId);
  const projectName = project?.project.name || state.projectId;
  const agentName = agent?.name || state.agentId;

  const audit = readRecentAudit(state.projectId, 8)
    .filter((e) => typeof e.event === 'string' && String(e.event).startsWith('plan_'))
    .map((e) => {
      const plan = e.plan as { description?: string; targetAgent?: string } | undefined;
      return `- ${String(e.event).replace('plan_', '')}: ${plan?.description || ''} (→ ${plan?.targetAgent || '?'})${e.reason ? ` — reason: ${e.reason}` : ''}`;
    });

  const supervisor = createSupervisorAgent((update: SupervisorUpdate) => {
    if (!update || update.classification === 'noise') return;
    const ts = new Date().toISOString();
    const payload = {
      agentId: state.agentId,
      projectId: state.projectId,
      classification: update.classification,
      summary: update.summary,
      ts,
    };
    logUpdate(payload);
    state.recent.push(`[${update.classification}] ${update.summary}`);
    if (state.recent.length > 5) state.recent.shift();

    if (update.classification === 'risky_action') {
      triggerGate(state.projectId, state.agentId, update.summary, 'supervisor', state.broadcast);
    } else {
      postToGroupChat(state, supervisorEntry(`${agentName}: ${update.summary}`, update.classification));
    }
    state.broadcast({ kind: 'event', event: 'supervisor:update', payload });
  });

  const prompt = [
    `Agent: ${agentName} (id ${state.agentId}) on project "${projectName}" (id ${state.projectId}).`,
    state.recent.length ? `Your recent reports for this agent:\n${state.recent.join('\n')}` : '',
    audit.length ? `Recent plan decisions by the human (do not re-propose rejected ones):\n${audit.join('\n')}` : '',
    'Classify the terminal output below and call report_update exactly once.',
    '',
    'Terminal output:',
    textToAnalyze,
  ].filter(Boolean).join('\n\n');

  try {
    await supervisor.invoke(prompt);
    supervisorWarned = false;
  } catch (err) {
    const msg = describeError(err);
    if (isCredentialError(msg)) {
      supervisorBackoffUntil = Date.now() + 10 * 60 * 1000;
      if (!supervisorWarned) {
        supervisorWarned = true;
        console.warn(`[watcher] Supervisor unavailable (${msg}). Bedrock access is off for 10 minutes; set AWS credentials + BEDROCK_MODEL_ID in .env, or CONDUIT_SUPERVISOR=off to silence this.`);
      }
    } else {
      console.error(`[watcher] Supervisor error for ${agentName}:`, msg);
    }
  } finally {
    state.isProcessing = false;
    if (state.buffer.trim() && !state.timer) {
      state.timer = setTimeout(() => { state.timer = null; void processBuffer(state); }, DEBOUNCE_MS);
    }
  }
}

/** Milestones that justify calling the Supervisor right away. */
const MILESTONE_RE = /\b(error|exception|failed|fatal|panic|traceback|completed|finished|all tests pass|deployed)\b/i;

export function attachWatcher(agentId: string, projectId: string, broadcast: Broadcast) {
  if (watchers.has(agentId)) return; // Already watching
  if (!runtime.isAgentRunning(agentId)) return;

  const state: WatcherState = {
    agentId, projectId, broadcast,
    buffer: '', tail: '',
    timer: null, isProcessing: false,
    lastCallAt: 0, lastGateReason: '', lastGateAt: 0,
    recent: [],
    teardown: () => { /* set below */ },
  };
  watchers.set(agentId, state);

  const listener = (raw: string) => {
    const text = stripAnsi(raw);
    if (!text.trim()) return;

    // Rolling tail so a prompt split across chunks is still seen.
    state.tail = (state.tail + text).slice(-3000);

    // Fast path: prompts + destructive commands.
    const gate = checkGate(state.tail.slice(-800));
    if (gate.matches) {
      const now = Date.now();
      const repeat = gate.reason === state.lastGateReason && now - state.lastGateAt < GATE_REPEAT_MS;
      if (!repeat) {
        state.lastGateReason = gate.reason;
        state.lastGateAt = now;
        const context = state.tail.slice(-600).trim();
        triggerGate(projectId, agentId, context, 'regex', broadcast);
      }
    }

    // Slow path: batch for the Supervisor.
    state.buffer += text;
    if (state.buffer.length > MAX_BATCH_CHARS * 2) state.buffer = state.buffer.slice(-MAX_BATCH_CHARS);

    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    if (MILESTONE_RE.test(text)) {
      void processBuffer(state);
    } else {
      state.timer = setTimeout(() => { state.timer = null; void processBuffer(state); }, DEBOUNCE_MS);
    }
  };

  state.teardown = runtime.subscribeOutput(agentId, listener);
}

export function detachWatcher(agentId: string) {
  const state = watchers.get(agentId);
  if (!state) return;
  if (state.timer) clearTimeout(state.timer);
  try { state.teardown(); } catch { /* ignore */ }
  watchers.delete(agentId);
}
