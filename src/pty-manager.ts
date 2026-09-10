import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Agent } from './types.js';
import { updateAgent, getProjectData, sharedDirFor, wikiDirFor } from './storage.js';
import { writeClaudeMcpConfig, removeClaudeMcpConfig } from './mcp-config.js';
import { writeClaudeHookConfig, removeClaudeHookConfig } from './hook-config.js';
import { DAEMON_HOST, DAEMON_PORT } from './daemon/protocol.js';
import { stripAnsi } from './gatePatterns.js';
import {
  CONDUIT_MARKER, CONDUIT_END_MARKER, INSTRUCTION_FILES, stripConduitSection,
} from './instruction-files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename);

/** Base URL the daemon serves hook callbacks on (HTTP on the daemon's port). */
function getHookBaseUrl(): string {
  return `http://${DAEMON_HOST}:${DAEMON_PORT}`;
}

/**
 * Absolute path to the compiled MCP server entry.
 *
 * This module is bundled *into* dist/src/daemon/daemon.mjs, so `__dirname_` is
 * `dist/src/daemon` while the MCP entry is emitted at `dist/src/mcp-server.mjs`.
 * Getting this wrong silently disables agent-to-agent messaging (the config is
 * written, Claude starts, and the MCP server just never loads), so probe the
 * candidates and warn loudly when none exists.
 */
function getMcpServerPath(): string | null {
  const candidates = [
    path.resolve(__dirname_, '..', 'mcp-server.mjs'), // bundled into daemon/
    path.resolve(__dirname_, 'mcp-server.mjs'),       // same-dir builds
    path.resolve(__dirname_, '..', 'mcp-server.js'),
    path.resolve(__dirname_, 'mcp-server.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.warn(
    `[pty-manager] MCP server entry not found (looked in ${path.dirname(candidates[0])}). `
    + 'Agent-to-agent messaging will be unavailable — run `npm run build`.',
  );
  return null;
}

/**
 * Hub URL that the spawned MCP server will call back to. Matches the port
 * that server.ts listens on.
 */
function getHubUrl(): string {
  return process.env.CONDUIT_HUB_URL || `http://localhost:${process.env.PORT || '3200'}`;
}

/**
 * Environment handed to an agent's shell.
 *
 * Strips ELECTRON_RUN_AS_NODE: in the desktop build the daemon runs under it,
 * and inheriting it would make any Electron app the agent launches (VS Code,
 * say) boot headless as Node and appear to do nothing.
 */
function agentEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/** Expand leading ~ to the user's home directory */
function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Quote one argument for the shell we type the CLI command into. cmd.exe on
 * Windows, bash elsewhere. Paths with spaces (project names!) must survive.
 */
function shellQuote(arg: string): string {
  if (process.platform === 'win32') {
    if (arg === '') return '""';
    if (!/[ \t"&|<>()^%]/.test(arg)) return arg;
    return '"' + arg.replace(/"/g, '""') + '"';
  }
  if (arg === '') return "''";
  if (/^[A-Za-z0-9_\-./=:@,+]+$/.test(arg)) return arg;
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Claude Code stores project session transcripts under
 *   ~/.claude/projects/<slug>/<sessionId>.jsonl
 * where <slug> is cwd with every non-alphanumeric character replaced by `-`.
 * Returns true if at least one .jsonl exists for this cwd (→ `claude -c` is safe).
 */
function hasClaudeSessionFor(cwd: string): boolean {
  try {
    const slug = path.resolve(cwd).replace(/[^a-zA-Z0-9]/g, '-');
    const dir = path.join(os.homedir(), '.claude', 'projects', slug);
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((f) => f.endsWith('.jsonl'));
  } catch {
    return false;
  }
}

// Dynamic import for node-pty (optional dependency)
let pty: typeof import('node-pty') | null = null;
try {
  pty = await import('node-pty');
} catch {
  console.warn('node-pty not available — terminal spawning disabled. Install node-pty to enable.');
}

type IPty = import('node-pty').IPty;

interface PtySession {
  pty: IPty;
  agent: Agent;
  listeners: Set<(data: string) => void>;
  buffer: string[];
}

const sessions = new Map<string, PtySession>();
const MAX_BUFFER = 5000;

/**
 * Ensure the shared content directory exists with a README.
 */
function ensureSharedDir(projectName: string): string {
  const sharedPath = sharedDirFor(projectName);
  fs.mkdirSync(sharedPath, { recursive: true });
  const readmePath = path.join(sharedPath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, [
      `# Shared Content — ${projectName}`,
      '',
      'This folder is shared across all agents in this project via Conduit.',
      'Any file you create, edit, or delete here is visible to all agents and the Conduit web UI.',
      '',
      '## Usage',
      '- Read files here for shared context (API specs, design docs, notes)',
      '- Write files here to share information with other agents or the user',
      '- The user can also view and edit these files from the Conduit "Shared Content" tab',
      '',
    ].join('\n'), 'utf-8');
  }
  return sharedPath;
}

/**
 * Build the Conduit instruction section content.
 */
function buildConduitSection(
  sharedPath: string,
  wikiPath: string,
  currentAgent: Agent,
  teammates: Agent[],
): { marker: string; section: string } {
  const marker = CONDUIT_MARKER;
  const hasWiki = fs.existsSync(path.join(wikiPath, '_schema.md'));

  const lines = [
    '',
    marker,
    '## Conduit — Multi-Agent Collaboration',
    '',
    'Shared content directory: `' + sharedPath + '`',
    '- Read/write files here to share information with other agents and the user',
    '',
    'Project wiki directory: `' + wikiPath + '`',
  ];

  if (hasWiki) {
    lines.push(
      '- **Start every session by reading `_index.md`** to understand current project state',
      '- Read `_schema.md` for wiki maintenance conventions',
      '- When asked to "update wiki", follow the schema rules',
      '- Do NOT auto-update wiki while coding — only when explicitly asked',
    );
  } else {
    lines.push(
      '- Wiki not initialized yet. User can initialize it from the Conduit Wiki tab.',
      '- Once initialized, read `_index.md` to understand the project.',
    );
  }

  // Teammates section — only emitted for CLIs that load the Conduit MCP server.
  // Codex agents run on app-server (no per-session MCP yet); Gemini / OpenCode
  // have no MCP hookup either. They still see the shared dir + wiki above.
  const mcpSupported = currentAgent.cli === 'claude';
  if (mcpSupported) {
    lines.push(
      '',
      '### Teammates (other agents in this project)',
      '',
      `You are **${currentAgent.name}**` + (currentAgent.role ? ` (${currentAgent.role})` : '') + '.',
      '',
    );
    if (teammates.length === 0) {
      lines.push('You currently have no teammates. When other agents are added, they will appear here.');
    } else {
      lines.push('Other agents you can message:');
      for (const t of teammates) {
        const role = t.role ? ` — ${t.role}` : '';
        lines.push(`- **${t.name}** (${t.cli})${role}`);
      }
      lines.push(
        '',
        'To send a message to a teammate, use the `message_agent` MCP tool:',
        '- When the user says things like "tell backend I finished the API",',
        '  call `message_agent(target="<teammate name>", message="<what to say>")`.',
        '- The teammate will see your message in their terminal.',
        '- Use `list_teammates` if you need to look up who is available.',
        '- Messages are one-way notifications — do NOT wait for a reply in the same tool call.',
      );
    }
  }

  lines.push('', CONDUIT_END_MARKER, '');
  return { marker, section: lines.join('\n') };
}

/**
 * Write Conduit instructions to a markdown file (CLAUDE.md or AGENTS.md).
 */
function ensureInstructionFile(
  filePath: string,
  projectName: string,
  sharedPath: string,
  wikiPath: string,
  currentAgent: Agent,
  teammates: Agent[],
) {
  const { section } = buildConduitSection(sharedPath, wikiPath, currentAgent, teammates);

  if (fs.existsSync(filePath)) {
    // Replace any previous section (AgentOrg, or an earlier Conduit one) so the
    // file never accumulates copies of itself.
    const existing = stripConduitSection(fs.readFileSync(filePath, 'utf-8'));
    fs.writeFileSync(filePath, existing.trimEnd() + '\n' + section, 'utf-8');
  } else {
    fs.writeFileSync(filePath, '# ' + projectName + '\n' + section, 'utf-8');
  }
}

function getCliCommand(agent: Agent, sharedPath: string, wikiPath: string, mcpConfigPath: string | null, hookConfigPath: string | null, cwd: string): { cmd: string; args: string[] } {
  const args: string[] = [];
  switch (agent.cli) {
    case 'claude':
      // Auto-resume the most recent conversation for this cwd when one exists.
      // Without a prior session `claude -c` errors, so we only add it when we
      // see a matching transcript on disk.
      if (hasClaudeSessionFor(cwd)) args.push('-c');
      if (agent.flags?.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
      if (agent.flags?.remoteControl) args.push('--remote-control');
      args.push('--add-dir', sharedPath);
      args.push('--add-dir', wikiPath);
      if (mcpConfigPath) args.push('--mcp-config', mcpConfigPath);
      // Lifecycle hooks → daemon status engine (additive to user's settings)
      if (hookConfigPath) args.push('--settings', hookConfigPath);
      return { cmd: 'claude', args };
    case 'gemini':
      args.push('--include-directories', sharedPath);
      args.push('--include-directories', wikiPath);
      return { cmd: 'gemini', args };
    case 'opencode':
      return { cmd: 'opencode', args };
    case 'codex':
      // Codex agents run on `codex app-server` (see daemon/codex-agents.ts) —
      // the daemon's runtime router never sends them here. Kept as a fallback
      // so a misrouted start still opens a usable terminal.
      args.push('-s', 'workspace-write');
      args.push('--add-dir', sharedPath);
      args.push('--add-dir', wikiPath);
      return { cmd: 'codex', args };
    case 'gpt':
      return { cmd: 'aider', args: aiderArgs('groq/openai/gpt-oss-120b', cwd) };
    case 'nemotron':
      return { cmd: 'aider', args: aiderArgs('openrouter/nvidia/nemotron-3.5-lightning:free', cwd) };
  }
}

/**
 * Shared aider invocation for the API-backed agent types.
 *
 * `--read AGENTS.md` matters: aider does not pick up AGENTS.md on its own, so
 * without this the Conduit section we just wrote (shared-content path, wiki
 * path) would be invisible to the agent.
 *
 * `--no-auto-commits` is deliberate — aider commits after every edit by
 * default, which would slip changes past the approval gates and into the
 * user's history. `--yes-always` is deliberately NOT set for the same reason:
 * aider's own confirmations are what the regex gate detects.
 */
function aiderArgs(model: string, cwd: string): string[] {
  return [
    '--model', model,
    '--read', path.join(cwd, 'AGENTS.md'),
    '--no-auto-commits',
    '--no-check-update',
  ];
}

export class AgentStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentStartError';
  }
}

export function startAgent(agent: Agent, onStatus: (agentId: string, status: string) => void): boolean {
  if (!pty) {
    throw new AgentStartError(
      'node-pty is not available, so Conduit cannot open terminals. Reinstall dependencies (`npm install`) and make sure your platform build tools are present.',
    );
  }
  if (sessions.has(agent.id)) return true;

  const projectData = getProjectData(agent.projectId);
  if (!projectData) throw new AgentStartError('Project not found.');

  const projectName = projectData.project.name;
  const sharedPath = ensureSharedDir(projectName);
  const wikiPath = wikiDirFor(projectName);
  try { fs.mkdirSync(wikiPath, { recursive: true }); } catch { /* best-effort */ }

  const cwd = expandHome(agent.cwd);
  if (!fs.existsSync(cwd)) {
    throw new AgentStartError(`The working directory for ${agent.name} does not exist: ${cwd}`);
  }

  // Resolve teammates (all other agents in the same project)
  const teammates = projectData.agents.filter(a => a.id !== agent.id);

  // Register MCP server for agent-to-agent messaging (Claude only for now)
  let claudeMcpConfigPath: string | null = null;
  try {
    const mcpServerPath = getMcpServerPath();
    if (agent.cli === 'claude' && mcpServerPath) {
      claudeMcpConfigPath = writeClaudeMcpConfig({
        agent,
        agentCwd: cwd,
        hubUrl: getHubUrl(),
        mcpServerPath,
      });
    }
  } catch (err) {
    console.warn(`[pty-manager] Failed to write MCP config for ${agent.name}:`, err);
    // Non-fatal: agent still starts, just without messaging capability
  }

  // Register lifecycle hooks so the daemon can derive precise status (Claude only)
  let claudeHookConfigPath: string | null = null;
  if (agent.cli === 'claude') {
    try {
      claudeHookConfigPath = writeClaudeHookConfig(agent.id, getHookBaseUrl());
    } catch (err) {
      console.warn(`[pty-manager] Failed to write hook config for ${agent.name}:`, err);
      // Non-fatal: agent still starts, status falls back to running/stopped
    }
  }

  // Write instruction file in agent's cwd so the CLI knows about shared content + memory + teammates
  const instrFile = path.join(cwd, INSTRUCTION_FILES[agent.cli]);
  try {
    ensureInstructionFile(instrFile, projectName, sharedPath, wikiPath, agent, teammates);
  } catch (err) {
    console.warn(`[pty-manager] Could not write ${instrFile}:`, err);
  }

  const { cmd, args } = getCliCommand(agent, sharedPath, wikiPath, claudeMcpConfigPath, claudeHookConfigPath, cwd);
  const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');

  let proc: IPty;
  try {
    proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: agentEnv(),
    });
  } catch (err) {
    console.error(`Failed to spawn PTY for agent ${agent.id}:`, err);
    return false;
  }

  const session: PtySession = {
    pty: proc,
    agent,
    listeners: new Set(),
    buffer: [],
  };
  sessions.set(agent.id, session);

  // Send the CLI command to the shell (quoted — project names may have spaces)
  proc.write(`${cmd} ${args.map(shellQuote).join(' ')}\r`);

  proc.onData((data: string) => {
    session.buffer.push(data);
    if (session.buffer.length > MAX_BUFFER) {
      session.buffer.splice(0, session.buffer.length - MAX_BUFFER);
    }
    for (const listener of session.listeners) {
      listener(data);
    }
  });

  proc.onExit(({ exitCode }) => {
    if (sessions.get(agent.id) === session) sessions.delete(agent.id);
    console.log(`[pty-manager] ${agent.name} exited (code ${exitCode})`);
    try { updateAgent(agent.projectId, agent.id, { status: 'stopped', pid: undefined, pendingGate: undefined }); }
    catch { /* project may have been deleted */ }
    onStatus(agent.id, 'stopped');
  });

  updateAgent(agent.projectId, agent.id, { status: 'running', pid: proc.pid });
  onStatus(agent.id, 'running');
  return true;
}

export function stopAgent(agentId: string): boolean {
  const session = sessions.get(agentId);
  if (!session) return false;
  sessions.delete(agentId);
  try { session.pty.kill(); } catch (err) { console.warn('[pty-manager] kill failed:', err); }
  try { updateAgent(session.agent.projectId, agentId, { status: 'stopped', pid: undefined, pendingGate: undefined }); }
  catch { /* ignore */ }
  return true;
}

/** Send an interrupt (Escape) to the CLI — used when a human rejects an action. */
export function interruptAgent(agentId: string): boolean {
  const session = sessions.get(agentId);
  if (!session) return false;
  session.pty.write('\x1b');
  return true;
}

export function writeToAgent(agentId: string, data: string) {
  const session = sessions.get(agentId);
  if (!session) return;
  session.pty.write(data);
}

/**
 * Inject an agent-to-agent message into the target agent's terminal.
 * The message is formatted so the target's LLM sees it as if the user had
 * just typed it in — a bracketed notification with sender identity.
 *
 * Returns true if delivered to a running PTY, false if the target is not running.
 */
export function injectMessage(targetAgentId: string, fromName: string, message: string): boolean {
  const session = sessions.get(targetAgentId);
  if (!session) return false;

  // Write the banner text first, then send Enter as a SEPARATE keystroke a
  // beat later. Claude Code's TUI treats a CR that arrives in the same burst
  // as the text as a literal newline (it looks like a multi-line paste) — only
  // a standalone CR is read as the Enter key that actually submits the prompt.
  const clean = message.replace(/\r/g, '').trim();
  session.pty.write(`[Message from ${fromName}]: ${clean}`);
  setTimeout(() => {
    const s = sessions.get(targetAgentId);
    if (s) s.pty.write('\r');
  }, 150);
  return true;
}

/**
 * Clean up MCP config for an agent (called on deletion).
 */
export function cleanupMcpConfig(agent: Agent) {
  try {
    if (agent.cli === 'claude') {
      removeClaudeMcpConfig(agent.id);
      removeClaudeHookConfig(agent.id);
    }
  } catch (err) {
    console.warn(`[pty-manager] Failed to clean up MCP config for ${agent.name}:`, err);
  }
}

export function resizeAgent(agentId: string, cols: number, rows: number) {
  const session = sessions.get(agentId);
  if (!session) return;
  session.pty.resize(cols, rows);
}

/**
 * Subscribe to an agent's raw PTY output. By default the scroll buffer is
 * replayed first (so a freshly attached terminal shows history); pass
 * `replay: false` for observers that only want new output (the Supervisor).
 */
export function addOutputListener(agentId: string, listener: (data: string) => void, opts: { replay?: boolean } = {}) {
  const session = sessions.get(agentId);
  if (!session) return;
  if (opts.replay !== false) {
    for (const line of session.buffer) {
      listener(line);
    }
  }
  session.listeners.add(listener);
}

/** The scroll buffer as one string (capped) — for late-attaching viewers. */
export function getBufferText(agentId: string, maxChars = 400_000): string {
  const session = sessions.get(agentId);
  if (!session) return '';
  const text = session.buffer.join('');
  return text.length > maxChars ? text.slice(-maxChars) : text;
}

export function removeOutputListener(agentId: string, listener: (data: string) => void) {
  const session = sessions.get(agentId);
  if (!session) return;
  session.listeners.delete(listener);
}

export function getAgentPreview(agentId: string): string {
  const session = sessions.get(agentId);
  if (!session || session.buffer.length === 0) return '';
  const tail = session.buffer.slice(-30).join('');
  const stripped = stripAnsi(tail);
  const lines = stripped.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  // Skip common noise lines
  const meaningful = lines.filter(l =>
    !l.startsWith('bypass permissions') &&
    !l.startsWith('Remote Control') &&
    !l.startsWith('Auto-update') &&
    !l.startsWith('Spindle') &&
    !l.match(/^\s*[>$%#]\s*$/)
  );
  const last = meaningful.length > 0 ? meaningful[meaningful.length - 1] : '';
  return last.slice(0, 60);
}

export function isAgentRunning(agentId: string): boolean {
  return sessions.has(agentId);
}

export function getRunningAgentIds(): string[] {
  return Array.from(sessions.keys());
}
