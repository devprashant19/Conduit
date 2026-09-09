import './env.js'; // .env from the cwd AND ~/.conduit/.env (the desktop app has no repo)
import { loadedEnvFiles, userEnvPath } from './env.js';
import express from 'express';
import fs from 'fs';
import os from 'os';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRouter, createDownloadRouter } from './routes.js';
import * as storage from './storage.js';
import * as activity from './activity.js';
import * as usage from './usage.js';
import { DaemonClient } from './daemon/client.js';
import type { WSClientMessage, WSServerMessage, ActivityEvent } from './types.js';
import { runSmokeTest } from './strands/agent.js';
import { BEDROCK_MODEL_ID, AWS_REGION, supervisorDisabled, supervisorProvider } from './strands/config.js';
import { hasAnthropicCredential, currentModel as anthropicModel } from './strands/anthropic.js';
import { PROVIDERS } from './voice/providers.js';
import { loadConfig as loadVoiceConfig, saveConfig as saveVoiceConfig, hasKey, saveApiKeys } from './voice/config.js';
import { transcribeOpenAI, ttsOpenAI } from './voice/openai.js';
import { transcribeGemini, ttsGemini } from './voice/gemini.js';
import { transcribeGroq } from './voice/groq.js';
import { authMiddleware, isAuthorized, isAuthEnabled } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3200', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.disable('x-powered-by');
app.use(authMiddleware);
app.use(express.json({ limit: '5mb' }));

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// --- Daemon connection — the daemon owns every agent PTY ---
const daemon = new DaemonClient();
daemon.connect();

// Track all connected browser clients
const clients = new Set<WebSocket>();

// agentId → browser sockets currently watching that agent's terminal
const subscribers = new Map<string, Set<WebSocket>>();

function sendTo(ws: WebSocket, msg: WSServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg: WSServerMessage) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function broadcastStatus(agentId: string, status: string) {
  broadcast({ type: 'agent:status', agentId, status });
}

function broadcastContentUpdate(projectId: string, filename: string) {
  broadcast({ type: 'content:updated', projectId, filename });
}

// Terminal output from the daemon → fan out to the browsers watching that agent
daemon.onOutput((agentId, data) => {
  const subs = subscribers.get(agentId);
  if (!subs) return;
  const frame = JSON.stringify({ type: 'terminal:output', agentId, data } satisfies WSServerMessage);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) ws.send(frame);
  }
});

// Agent status changes from the daemon → broadcast to all browsers
daemon.onStatus((agentId, status) => {
  broadcastStatus(agentId, status);
});

// Structured Codex items from the daemon → only the browsers watching that agent
daemon.onCodexItem((agentId, item) => {
  const subs = subscribers.get(agentId);
  if (!subs) return;
  const frame = JSON.stringify({ type: 'codex:item', agentId, item } satisfies WSServerMessage);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) ws.send(frame);
  }
});

// Supervisor updates, group chat messages, approval gates
daemon.onSupervisorUpdate((payload) => {
  broadcast({ type: 'supervisor:update', payload });
});
daemon.onGroupChatMessage((payload) => {
  broadcast({ type: 'groupchat:message', payload });
});
daemon.onGate((ev) => {
  if (ev.kind === 'triggered') {
    broadcast({ type: 'gate:triggered', ...ev.gate });
  } else {
    broadcast({ type: 'gate:resolved', agentId: ev.agentId });
  }
});

// Orchestrator brain events from the daemon → broadcast to all browsers
daemon.onBrain((payload) => {
  broadcast({ type: 'brain:event', payload });
});

// Orchestrator dispatches (ask_agent / broadcast) → record in the activity
// feed so the brain's actions are visible in the Messages panel.
daemon.onDispatch((d) => {
  activity.pushEvent({
    projectId: d.projectId,
    agentName: d.fromName,
    event: 'agent:message',
    detail: `${d.fromName} → ${d.agentName}: ${d.message.slice(0, 120)}`,
    fromAgent: d.fromName,
    toAgent: d.agentName,
    message: d.message,
  });
});

// The brain created/changed a project or agent → start watching any new
// project and tell browsers to reload the sidebar.
daemon.onOrgChanged(() => {
  for (const project of storage.listProjects()) {
    activity.watchProject(project.id, project.name);
  }
  broadcast({ type: 'org:changed' });
});

// Daemon (re)connected → re-attach every terminal a browser is watching and
// let browsers refresh statuses (the daemon replays its status map on hello).
daemon.onConnect(() => {
  for (const agentId of subscribers.keys()) daemon.attachTerminal(agentId);
  broadcast({ type: 'org:changed' });
});

// Wire activity feed to broadcast
activity.setBroadcast((event: ActivityEvent) => {
  broadcast({ type: 'activity', event });
  if (event.event.startsWith('content:')) {
    broadcastContentUpdate(event.projectId, event.detail.split(': ')[1] || '');
  }
});

// First run only: create the demo project so a fresh install has something to
// look at. Guarded by a marker file, so deleting it makes it stay deleted.
{
  const demo = storage.seedDefaultDemoProjectOnce();
  if (demo) console.log(`[server] first run — created demo project "${demo.name}"`);
}

// Start file watchers for all existing projects
for (const project of storage.listProjects()) {
  activity.watchProject(project.id, project.name);
}

// Desktop binaries. The UI links to /downloads/<file>; the handler lives in
// routes.ts and is mounted here (not under /api) so the plain link works.
app.use('/downloads', createDownloadRouter());

// API routes
app.use('/api', createRouter(daemon, broadcast));

// Activity feed REST endpoint
app.get('/api/activity', (req, res) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  res.json(activity.getEvents(projectId));
});

// Usage endpoint
app.get('/api/usage', async (_req, res) => {
  const data = await usage.getUsage();
  res.json(data);
});

// Daemon health endpoint
app.get('/api/daemon/status', (_req, res) => {
  res.json({ connected: daemon.isConnected() });
});

// Server info — the UI shows this in the footer
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    daemon: daemon.isConnected(),
    auth: isAuthEnabled(),
    supervisor: supervisorDisabled() ? 'off' : 'on',
    supervisorProvider: supervisorProvider(),
    anthropicCredential: hasAnthropicCredential(),
    anthropicModel: anthropicModel(),
    bedrockModel: BEDROCK_MODEL_ID,
    region: AWS_REGION,
    // Which .env files were actually read. The packaged desktop app runs from
    // its install directory, so the repo's .env is not one of them — this is
    // how you tell whether your Bedrock/Groq settings reached the process.
    envFiles: loadedEnvFiles(),
    userEnvPath: userEnvPath(),
  });
});

// Strands Agents SDK Smoke Test
app.post('/api/strands/ping', async (req, res) => {
  try {
    const msg = typeof req.body?.message === 'string' && req.body.message.trim()
      ? req.body.message.trim().slice(0, 2000)
      : 'Say hello and confirm you can hear me.';
    const reply = await runSmokeTest(msg);
    res.json({ reply, model: BEDROCK_MODEL_ID, region: AWS_REGION });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), model: BEDROCK_MODEL_ID, region: AWS_REGION });
  }
});

// ─── Voice (STT / TTS) ─────────────────────────────────────────────────

app.get('/api/voice/config', (_req, res) => {
  res.json({
    config: loadVoiceConfig(),
    providers: PROVIDERS,
    keys: { openai: hasKey('openai'), gemini: hasKey('gemini'), groq: hasKey('groq') },
  });
});

app.put('/api/voice/config', (req, res) => {
  try {
    const body = (req.body || {}) as {
      stt?: unknown; tts?: unknown;
      apiKeys?: { openai?: string; gemini?: string; groq?: string };
    };
    // Settings (stt/tts) live in voice.json.
    if (body.stt || body.tts) {
      const cur = loadVoiceConfig();
      saveVoiceConfig({
        stt: { ...cur.stt, ...((body.stt as Partial<typeof cur.stt>) || {}) },
        tts: { ...cur.tts, ...((body.tts as Partial<typeof cur.tts>) || {}) },
      });
    }
    // Secrets (apiKeys) live in api-keys.json — never echoed back.
    if (body.apiKeys && typeof body.apiKeys === 'object') {
      saveApiKeys(body.apiKeys);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Raw audio bytes in, JSON {text} out. Browser sends the recorded blob with
// Content-Type: audio/webm (or similar). express.raw matches audio/* only so
// the global express.json() above isn't disturbed.
app.post(
  '/api/voice/transcribe',
  express.raw({ type: 'audio/*', limit: '25mb' }),
  async (req, res) => {
    try {
      const cfg = loadVoiceConfig();
      const mime = String(req.headers['content-type'] || 'audio/webm');
      const audio = req.body as Buffer;
      if (!audio || audio.length === 0) {
        res.status(400).json({ error: 'no audio body' });
        return;
      }
      // Optional debug: dump the clip so the user can listen and judge mic /
      // STT quality. Off by default; toggled in Voice Settings.
      if (cfg.stt.saveRecordings) {
        try {
          const dir = path.join(os.homedir(), '.conduit', 'voice-debug');
          fs.mkdirSync(dir, { recursive: true });
          const ext = mime.split('/')[1]?.split(';')[0] || 'webm';
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const ts = path.join(dir, `recording-${stamp}.${ext}`);
          const latest = path.join(dir, `latest.${ext}`);
          fs.writeFileSync(ts, audio);
          fs.writeFileSync(latest, audio);
          console.log(`[voice/debug] saved ${audio.length} bytes → ${latest} (and ${path.basename(ts)})`);
        } catch (err) {
          console.warn('[voice/debug] save failed:', err);
        }
      }
      // The browser may pass the language it wants; otherwise use the saved one.
      const language = (typeof req.query.language === 'string' && req.query.language) || cfg.stt.language || undefined;
      let text = '';
      if (cfg.stt.provider === 'groq') {
        text = await transcribeGroq(audio, mime, cfg.stt.model, language);
      } else if (cfg.stt.provider === 'openai') {
        text = await transcribeOpenAI(audio, mime, cfg.stt.model, language);
      } else if (cfg.stt.provider === 'gemini') {
        text = await transcribeGemini(audio, mime, cfg.stt.model, language);
      } else {
        res.status(400).json({ error: 'STT provider is "browser" — transcription happens in the browser, not here' });
        return;
      }
      res.json({ text });
    } catch (err) {
      console.warn('[voice/transcribe]', err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

// Text in, audio bytes out. Optional per-request overrides for voice / model /
// speed (the HUD sends its current config); otherwise the saved settings apply.
app.post('/api/voice/tts', async (req, res) => {
  try {
    const cfg = loadVoiceConfig();
    const text = String(req.body?.text || '').slice(0, 2000);
    if (!text) { res.status(400).json({ error: 'no text' }); return; }
    const provider = (req.body?.provider === 'openai' || req.body?.provider === 'gemini') ? req.body.provider : cfg.tts.provider;
    const model = typeof req.body?.model === 'string' && req.body.model ? req.body.model : cfg.tts.model;
    const voice = typeof req.body?.voice === 'string' && req.body.voice ? req.body.voice : cfg.tts.voice;
    const speed = typeof req.body?.speed === 'number' ? req.body.speed : cfg.tts.speed;
    let out: { audio: Buffer; mime: string };
    if (provider === 'openai') {
      out = await ttsOpenAI(text, model, voice, speed);
    } else if (provider === 'gemini') {
      out = await ttsGemini(text, model, voice);
    } else {
      // Names the provider actually configured. Groq is speech-to-text only
      // in Conduit, so it lands here too and speaks with the browser voice.
      res.status(400).json({ error: `TTS provider is "${provider}" — synthesis happens in the browser, not here` });
      return;
    }
    res.setHeader('Content-Type', out.mime);
    res.setHeader('Cache-Control', 'no-store');
    res.send(out.audio);
  } catch (err) {
    console.warn('[voice/tts]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Codex model list — for the Codex agent view's model picker
app.get('/api/codex/models', async (_req, res) => {
  try {
    res.json(await daemon.request('codex:models'));
  } catch {
    res.json({ models: [] });
  }
});

// Orchestrator brain — conversation snapshot for the Command panel
app.get('/api/brain', async (_req, res) => {
  try {
    const state = await daemon.request('brain:state');
    res.json(state);
  } catch {
    res.status(503).json({ messages: [], status: 'idle', engine: 'codex', currentId: '', conversations: [], error: 'daemon unavailable' });
  }
});

// Unknown API routes are JSON 404s, never the SPA shell.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

usage.startPolling();

// Serve static frontend in production
const clientDist = [
  path.join(__dirname, 'client'),
  path.join(__dirname, '..', 'client'),
  path.join(process.cwd(), 'dist', 'client'),
].find((p) => fs.existsSync(p));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => {
    res.status(503).type('text/plain').send(
      'Conduit UI is not built yet. Run `npm run build` (or use `npm run dev` and open http://localhost:5173).',
    );
  });
}

// Error handler last, so failures inside express.static and the SPA catch-all
// reach it too (Express runs error handlers in registration order).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : String(err);
  if (status >= 500) console.error('[server] route error:', err);
  if (res.headersSent) return;
  res.status(status).json({ error: message });
});

// --- Graceful shutdown ---
// The web server NO LONGER kills agents — the daemon owns them and outlives us.
// We just exit cleanly; agents keep running for the next web start to reattach.
function gracefulShutdown(signal: string) {
  console.log(`[server] ${signal} received — shutting down web server (agents stay alive in daemon)`);
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[server] unhandled rejection:', err);
});

// --- WebSocket handling (browser ↔ web server) ---
function unsubscribeAll(ws: WebSocket) {
  for (const [agentId, subs] of subscribers) {
    if (subs.delete(ws) && subs.size === 0) {
      subscribers.delete(agentId);
      daemon.detachTerminal(agentId);
    }
  }
}

// Same Basic-auth gate for the WebSocket upgrade as for HTTP.
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (!url.startsWith('/ws')) { socket.destroy(); return; }
  if (!isAuthorized(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="Conduit"\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  clients.add(ws);
  sendTo(ws, { type: 'hello', daemon: daemon.isConnected() });

  ws.on('message', (raw) => {
    let msg: WSClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return;

    switch (msg.type) {
      case 'terminal:attach': {
        if (typeof msg.agentId !== 'string') return;
        let subs = subscribers.get(msg.agentId);
        const first = !subs || subs.size === 0;
        if (!subs) {
          subs = new Set();
          subscribers.set(msg.agentId, subs);
        }
        const alreadyWatching = subs.has(ws);
        subs.add(ws);
        if (first) {
          // First viewer: the daemon streams + replays history through our
          // single daemon socket, which fans out to this viewer.
          daemon.attachTerminal(msg.agentId);
        } else if (!alreadyWatching) {
          // Later viewers get a private history snapshot — otherwise every
          // existing viewer would see the scrollback duplicated.
          const agentId = msg.agentId;
          daemon.request('agent:replay', { agentId }).then((r) => {
            if (r.text) sendTo(ws, { type: 'terminal:output', agentId, data: r.text });
            for (const item of r.items || []) sendTo(ws, { type: 'codex:item', agentId, item });
          }).catch(() => { /* daemon down */ });
        }
        break;
      }
      case 'terminal:detach': {
        const subs = subscribers.get(msg.agentId);
        if (subs && subs.delete(ws) && subs.size === 0) {
          subscribers.delete(msg.agentId);
          daemon.detachTerminal(msg.agentId);
        }
        break;
      }
      case 'terminal:input': {
        if (typeof msg.data === 'string') daemon.writeTerminal(msg.agentId, msg.data);
        break;
      }
      case 'terminal:resize': {
        const cols = Number(msg.cols), rows = Number(msg.rows);
        if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
          daemon.resizeTerminal(msg.agentId, Math.floor(cols), Math.floor(rows));
        }
        break;
      }
      case 'codex:send': {
        if (typeof msg.text !== 'string') return;
        daemon.command({
          op: 'codex:send', agentId: msg.agentId, text: msg.text,
          model: msg.model, effort: msg.effort,
        });
        break;
      }
      case 'codex:new-thread': {
        daemon.command({ op: 'codex:new-thread', agentId: msg.agentId });
        break;
      }
      case 'brain:send': {
        if (typeof msg.message === 'string' && msg.message.trim()) daemon.sendBrain(msg.message);
        break;
      }
      case 'brain:new': {
        daemon.newBrainConversation();
        break;
      }
      case 'brain:abort': {
        daemon.abortBrain();
        break;
      }
      case 'brain:switch': {
        if (typeof msg.conversationId === 'string') daemon.switchBrainConversation(msg.conversationId);
        break;
      }
      case 'brain:delete': {
        if (typeof msg.conversationId === 'string') daemon.deleteBrainConversation(msg.conversationId);
        break;
      }
      case 'ping': {
        sendTo(ws, { type: 'pong' });
        break;
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    unsubscribeAll(ws);
  });
  ws.on('error', () => { /* close follows */ });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] port ${PORT} is already in use — is Conduit already running? (set PORT to change it)`);
  } else {
    console.error('[server] error:', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Conduit web server running on http://localhost:${PORT}`);
  console.log(`[server] daemon: ${daemon.isConnected() ? 'connected' : 'connecting…'}`);
  if (isAuthEnabled()) {
    console.log('[server] auth: Basic auth enabled (CONDUIT_AUTH)');
  } else if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.warn('[server] auth: OFF — anyone who can reach this port can type into your agents. Set CONDUIT_AUTH=user:pass before exposing it beyond localhost.');
  }
  if (supervisorDisabled()) {
    console.log('[server] supervisor: off (CONDUIT_SUPERVISOR)');
  } else {
    const provider = supervisorProvider();
    const anthropic = hasAnthropicCredential()
      ? `Anthropic ${anthropicModel()}`
      : 'Anthropic (no credential)';
    const bedrock = `Bedrock ${BEDROCK_MODEL_ID} in ${AWS_REGION}`;
    console.log(`[server] supervisor: ${provider === 'anthropic' ? anthropic
      : provider === 'bedrock' ? bedrock
        : `${bedrock}, falling back to ${anthropic}`}`);
  }
});
