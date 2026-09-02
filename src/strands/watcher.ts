import os from 'os';
import path from 'path';
import fs from 'fs';
import { addOutputListener, removeOutputListener } from '../pty-manager.js';
import { createSupervisorAgent } from './agent.js';
import { appendGroupChat, updateAgent } from '../storage.js';
import { checkGate } from '../gatePatterns.js';

function triggerGate(projectId: string, agentId: string, prompt: string, source: 'regex' | 'supervisor', broadcast: (msg: any) => void) {
  updateAgent(projectId, agentId, { pendingGate: { prompt, source } });
  const ts = new Date().toISOString();
  appendGroupChat(projectId, {
    id: crypto.randomUUID(),
    ts,
    role: 'supervisor',
    sender: 'Supervisor',
    text: `[Gate Triggered] Agent is blocked on a risky action:\n${prompt}`,
    classification: 'risky_action'
  });
  broadcast({
    kind: 'event',
    event: 'gate:triggered',
    agentId,
    projectId,
    prompt,
    source
  });
}

interface WatcherState {
  buffer: string[];
  timer: ReturnType<typeof setTimeout> | null;
  agentId: string;
  projectId: string;
  broadcast: (msg: any) => void;
  isProcessing: boolean;
}

const watchers = new Map<string, WatcherState>();
const DEBOUNCE_MS = 10_000;

const logPath = path.join(os.homedir(), '.conduit', 'supervisor-log.jsonl');

function logUpdate(entry: any) {
  try {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[watcher] Failed to write to supervisor-log.jsonl:', err);
  }
}

async function processBuffer(state: WatcherState) {
  if (state.isProcessing || state.buffer.length === 0) return;
  state.isProcessing = true;

  const textToAnalyze = state.buffer.join('');
  state.buffer = [];

  const agent = createSupervisorAgent((update: any) => {
    if (update.classification !== 'noise') {
      const ts = new Date().toISOString();
      const payload = {
        agentId: state.agentId,
        projectId: state.projectId,
        classification: update.classification,
        summary: update.summary,
        ts,
      };

      logUpdate(payload);
      
      // Append to project groupchat
      try {
        if (update.classification === 'risky_action') {
          triggerGate(state.projectId, state.agentId, update.summary, 'supervisor', state.broadcast);
        } else {
          const entry = {
            id: crypto.randomUUID(),
            ts,
            role: 'supervisor' as const,
            sender: 'Supervisor',
            text: update.summary,
            classification: update.classification
          };
          appendGroupChat(state.projectId, entry);
        }
      } catch (err) {
        console.error('[watcher] Failed to append to groupchat:', err);
      }

      state.broadcast({
        kind: 'event',
        event: 'supervisor:update',
        payload,
      });
    }
  });

  try {
    await agent.invoke(`Given this terminal output from agent ${state.agentId} working on project ${state.projectId}, decide: (a) is this worth telling the human right now, (b) if yes, write one short spoken-style sentence summarizing it, (c) classify as: progress | blocker | question | risky_action | noise. If 'noise', return null and don't surface it. Please call the report_update tool with your findings.\n\nTerminal output:\n${textToAnalyze}`);
  } catch (err) {
    console.error(`[watcher] Supervisor agent error for ${state.agentId}:`, err);
  } finally {
    state.isProcessing = false;
    if (state.buffer.length > 0 && !state.timer) {
      // More output arrived while we were processing
      state.timer = setTimeout(() => {
        state.timer = null;
        processBuffer(state);
      }, DEBOUNCE_MS);
    }
  }
}

export function attachWatcher(agentId: string, projectId: string, broadcast: (msg: any) => void) {
  if (watchers.has(agentId)) return; // Already watching

  const state: WatcherState = {
    buffer: [],
    timer: null,
    agentId,
    projectId,
    broadcast,
    isProcessing: false,
  };
  watchers.set(agentId, state);

  // Regex patterns to match milestones to trigger immediately
  const milestoneRegex = /(error|exception|failed|success|completed|finished|done|warning)/i;

  const listener = (data: string) => {
    // Fast-path regex check
    const gateCheck = checkGate(data);
    if (gateCheck.matches) {
      triggerGate(projectId, agentId, data.trim(), 'regex', broadcast);
      // We can continue processing it or just return. Let's process it so it shows up in terminal too.
    }

    state.buffer.push(data);
    
    // Check milestone
    const triggerImmediate = milestoneRegex.test(data);

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    if (triggerImmediate) {
      processBuffer(state);
    } else {
      state.timer = setTimeout(() => {
        state.timer = null;
        processBuffer(state);
      }, DEBOUNCE_MS);
    }
  };

  addOutputListener(agentId, listener);

  // Save the listener reference so we can remove it later
  (state as any).listener = listener;
}

export function detachWatcher(agentId: string) {
  const state = watchers.get(agentId);
  if (!state) return;
  
  if (state.timer) clearTimeout(state.timer);
  const listener = (state as any).listener;
  if (listener) removeOutputListener(agentId, listener);
  
  watchers.delete(agentId);
}
