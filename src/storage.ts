import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type { Project, Agent, ProjectData, SharedContent, Plan, ProjectLayout } from './types.js';

export interface GroupChatEntry {
  id: string;
  ts: string;
  role: 'supervisor' | 'user' | 'agent';
  sender: string;
  text: string;
  classification?: 'progress' | 'blocker' | 'question' | 'risky_action' | 'noise';
}


const BASE_DIR = path.join(os.homedir(), '.conduit');
const PROJECTS_DIR = path.join(BASE_DIR, 'projects');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Only accept UUID-shaped project ids in filesystem paths. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function projectDir(projectId: string) {
  if (!SAFE_ID.test(projectId)) throw new Error('Invalid project id');
  return path.join(PROJECTS_DIR, projectId);
}

function projectFile(projectId: string) {
  return path.join(projectDir(projectId), 'project.json');
}

const SHARED_CONTENT_DIR = path.join(BASE_DIR, 'shared_content');
const WIKI_DIR = path.join(BASE_DIR, 'wiki');

/**
 * Project names double as directory names under shared_content/ and wiki/.
 * Strip anything that could escape or break a path: separators, `..`, control
 * chars, and leading dots. Falls back to "project" when nothing is left.
 */
export function safeProjectName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\.\.+/g, '.')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'project';
}

/**
 * Resolve `rel` inside `base` and reject anything that escapes it (path
 * traversal). Returns null when the path is not safely inside `base`.
 */
export function resolveInside(base: string, rel: string): string | null {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) return null;
  if (rel.includes('\0')) return null;
  const normalized = rel.replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) return null;
  const full = path.resolve(base, normalized);
  const root = path.resolve(base);
  if (full === root) return null;
  const relBack = path.relative(root, full);
  if (relBack.startsWith('..') || path.isAbsolute(relBack)) return null;
  return full;
}

function sharedDir(projectName: string) {
  return path.join(SHARED_CONTENT_DIR, safeProjectName(projectName));
}

function wikiDir(projectName: string) {
  return path.join(WIKI_DIR, safeProjectName(projectName));
}

/** Public helpers so other modules never build these paths by hand. */
export function sharedDirFor(projectName: string): string { return sharedDir(projectName); }
export function wikiDirFor(projectName: string): string { return wikiDir(projectName); }

// Initialize storage
ensureDir(PROJECTS_DIR);

/** Marker recording that first-run seeding already happened. */
const SEED_MARKER = path.join(BASE_DIR, '.seeded');

/**
 * Create the demo project once, on genuine first run.
 *
 * Deliberately explicit and idempotent: it is called only from web-server
 * startup, never from a read path. An earlier version ran inside
 * `listProjects()`, which meant deleting your last project silently recreated
 * it, creating your first project left a demo behind, and the web server and
 * daemon could each seed a copy. The marker file makes a deleted demo stay
 * deleted.
 *
 * Returns the created project, or null when seeding was not needed.
 */
export function seedDefaultDemoProjectOnce(): Project | null {
  try {
    if (fs.existsSync(SEED_MARKER)) return null;
    if (listProjects().length > 0) {
      // Existing install predating the marker — record it and leave well alone.
      ensureDir(BASE_DIR);
      fs.writeFileSync(SEED_MARKER, new Date().toISOString(), 'utf-8');
      return null;
    }
    const project = seedDefaultDemoProject();
    ensureDir(BASE_DIR);
    fs.writeFileSync(SEED_MARKER, new Date().toISOString(), 'utf-8');
    return project;
  } catch (err) {
    console.warn('[storage] demo seeding skipped:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function seedDefaultDemoProject(): Project {
  const demoCwd = path.join(os.homedir(), '.conduit', 'demo-workspace');
  ensureDir(demoCwd);

  const project = createProject(
    'Conduit Studio (Demo)',
    demoCwd,
    'Multi-agent demonstration studio orchestrating Claude Code, Codex, and Gemini CLI side-by-side with safety gates.'
  );

  // Seed 3 specialized agents
  createAgent(project.id, 'Claude Architect', 'claude', demoCwd, 'System Architecture & Core Services');
  createAgent(project.id, 'Codex Builder', 'codex', demoCwd, 'Feature Implementation & API Endpoints');
  createAgent(project.id, 'Gemini Reviewer', 'gemini', demoCwd, 'Code Review & Automated Test Suites');

  // Seed sample wiki overview
  const welcomeWiki = `# Conduit Multi-Agent Studio Demo

Welcome to your local Conduit control center.

## Running Agents
- **Claude Architect**: Handles top-level system architecture and database migrations.
- **Codex Builder**: Implements application features and routes.
- **Gemini Reviewer**: Runs unit tests and validates pull request safety.

## Human-in-the-Loop Protection
Every risky operation (e.g. \`rm -rf\`, SQL drops, force pushes) is intercepted by the Supervisor and requires human approval before execution.
`;
  // Only write the welcome page if the wiki index is still the generated stub —
  // never clobber a page the user has edited.
  const existingIndex = getWikiFile(project.id, '_index.md');
  if (!existingIndex || existingIndex.content.trim().startsWith('# Project Wiki Index')) {
    updateWikiFile(project.id, '_index.md', welcomeWiki);
  }

  return project;
}

// --- Projects ---

export function listProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const dirs = fs.readdirSync(PROJECTS_DIR);
  const projects: Project[] = [];
  for (const dir of dirs) {
    const file = path.join(PROJECTS_DIR, dir, 'project.json');
    if (!fs.existsSync(file)) continue;
    try {
      const data: ProjectData = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (data?.project?.id) projects.push(data.project);
    } catch (err) {
      // A single corrupt project.json must not take the whole API down.
      console.error(`[storage] skipping unreadable ${file}:`, err instanceof Error ? err.message : err);
    }
  }

  // NOTE: this is a pure read. First-run demo seeding lives in
  // `seedDefaultDemoProjectOnce()`, called once from web-server startup.
  return projects.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export function getProjectData(projectId: string): ProjectData | null {
  if (!SAFE_ID.test(projectId)) return null;
  const file = projectFile(projectId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`[storage] unreadable ${file}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function saveProjectData(data: ProjectData) {
  ensureDir(projectDir(data.project.id));
  // Write-then-rename so a crash mid-write never leaves a truncated file.
  const file = projectFile(data.project.id);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/** Thrown when a name would collide with an existing project. */
export class DuplicateProjectError extends Error {
  constructor(name: string) {
    super(`A project named "${name}" already exists.`);
    this.name = 'DuplicateProjectError';
  }
}

/** True when another project already uses this (sanitized) name. */
function nameTaken(name: string, exceptId?: string): boolean {
  const norm = safeProjectName(name).toLowerCase();
  return listProjects().some((p) => p.id !== exceptId && p.name.toLowerCase() === norm);
}

export function createProject(name: string, cwd: string, description?: string): Project {
  const safeName = safeProjectName(name);
  // Enforced here, not just in the routes: shared_content/ and wiki/ are keyed
  // by name, so two projects sharing one would share (and delete) each other's
  // data.
  if (nameTaken(safeName)) throw new DuplicateProjectError(safeName);

  const project: Project = {
    id: uuid(),
    name: safeName,
    description,
    cwd,
    createdAt: new Date().toISOString(),
  };
  saveProjectData({ project, agents: [], pendingPlans: [] });
  // Auto-init shared content + wiki
  ensureDir(sharedDir(project.name));
  initializeWiki(project.id);
  return project;
}

export function updateProject(projectId: string, updates: Partial<Pick<Project, 'name' | 'description' | 'cwd'>>): Project | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const next: Partial<Pick<Project, 'name' | 'description' | 'cwd'>> = {};
  if (typeof updates.name === 'string' && updates.name.trim()) next.name = safeProjectName(updates.name);
  if (typeof updates.description === 'string') next.description = updates.description;
  if (typeof updates.cwd === 'string' && updates.cwd.trim()) next.cwd = updates.cwd;

  // Shared content + wiki directories are keyed by name — move them along
  // with a rename so the project doesn't lose its data.
  if (next.name && next.name !== data.project.name) {
    // Refuse a rename onto an existing name: the move below would be skipped
    // and both projects would then share one shared_content/ and wiki/ dir,
    // so deleting either with removeData would destroy the other's files.
    if (nameTaken(next.name, projectId)) throw new DuplicateProjectError(next.name);

    for (const [from, to] of [
      [sharedDir(data.project.name), sharedDir(next.name)],
      [wikiDir(data.project.name), wikiDir(next.name)],
    ]) {
      try {
        if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to);
      } catch (err) {
        console.warn('[storage] could not move project data on rename:', err);
      }
    }
  }
  Object.assign(data.project, next);
  saveProjectData(data);
  return data.project;
}

export function deleteProject(projectId: string, removeData?: boolean): boolean {
  const data = getProjectData(projectId);
  if (!data) return false;

  // Remove shared content and wiki if requested
  if (removeData) {
    const shared = sharedDir(data.project.name);
    if (fs.existsSync(shared)) fs.rmSync(shared, { recursive: true });
    const wiki = wikiDir(data.project.name);
    if (fs.existsSync(wiki)) fs.rmSync(wiki, { recursive: true });
  }

  const dir = projectDir(projectId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  return true;
}

// --- Agents ---

export function listAgents(projectId: string): Agent[] {
  const data = getProjectData(projectId);
  return data?.agents ?? [];
}

export function getAgent(projectId: string, agentId: string): Agent | null {
  const data = getProjectData(projectId);
  return data?.agents.find(a => a.id === agentId) ?? null;
}

export function createAgent(projectId: string, name: string, cli: Agent['cli'], cwd: string, role?: string, flags?: Agent['flags']): Agent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const agent: Agent = {
    id: uuid(),
    projectId,
    name,
    role,
    cli,
    cwd,
    status: 'stopped',
    flags,
  };
  data.agents.push(agent);
  saveProjectData(data);
  return agent;
}

export type AgentUpdate = Partial<Pick<Agent, 'name' | 'role' | 'cli' | 'cwd' | 'status' | 'pid' | 'flags' | 'codexThreadId' | 'pendingGate'>>;

export function updateAgent(projectId: string, agentId: string, updates: AgentUpdate): Agent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const agent = data.agents.find(a => a.id === agentId);
  if (!agent) return null;
  // Only known fields — never let a request body add arbitrary keys.
  const allowed: (keyof AgentUpdate)[] = ['name', 'role', 'cli', 'cwd', 'status', 'pid', 'flags', 'codexThreadId', 'pendingGate'];
  const target = agent as unknown as Record<string, unknown>;
  for (const k of allowed) {
    if (k in updates) {
      const v = updates[k];
      if (v === undefined) delete target[k];
      else target[k] = v;
    }
  }
  saveProjectData(data);
  return agent;
}

export function deleteAgent(projectId: string, agentId: string): boolean {
  const data = getProjectData(projectId);
  if (!data) return false;
  const idx = data.agents.findIndex(a => a.id === agentId);
  if (idx === -1) return false;
  data.agents.splice(idx, 1);
  saveProjectData(data);
  return true;
}

// --- Plans & Layouts ---

export function getProjectLayout(projectId: string): ProjectLayout | null {
  const data = getProjectData(projectId);
  return data?.layout || null;
}

export function saveProjectLayout(projectId: string, layout: ProjectLayout): boolean {
  const data = getProjectData(projectId);
  if (!data) return false;
  data.layout = layout;
  saveProjectData(data);
  return true;
}

export function getPlans(projectId: string): Plan[] {
  const data = getProjectData(projectId);
  return data?.pendingPlans || [];
}

export function createPlan(plan: Omit<Plan, 'id' | 'createdAt'>): Plan | null {
  const data = getProjectData(plan.projectId);
  if (!data) return null;
  const newPlan: Plan = {
    ...plan,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  if (!data.pendingPlans) data.pendingPlans = [];
  data.pendingPlans.push(newPlan);
  saveProjectData(data);
  return newPlan;
}

export function resolvePlan(projectId: string, planId: string): Plan | null {
  const data = getProjectData(projectId);
  if (!data || !data.pendingPlans) return null;
  const idx = data.pendingPlans.findIndex(p => p.id === planId);
  if (idx === -1) return null;
  const [resolved] = data.pendingPlans.splice(idx, 1);
  saveProjectData(data);
  return resolved;
}

// --- Shared Content (stored in ~/.conduit/shared_content/[project_name]/) ---

export function listContent(projectId: string): SharedContent[] {
  const data = getProjectData(projectId);
  if (!data) return [];
  const dir = sharedDir(data.project.name);
  if (!fs.existsSync(dir)) return [];
  // Recurse into subdirectories so nested files are listed with relative paths.
  // Filenames are normalized to forward-slashes for cross-platform consistency.
  const results: SharedContent[] = [];
  const readDir = (d: string, prefix: string) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        readDir(fullPath, relative);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          const content = fs.readFileSync(fullPath, 'utf-8');
          results.push({
            id: relative,
            projectId,
            filename: relative,
            content,
            createdBy: 'user',
            updatedAt: stat.mtime.toISOString(),
          });
        } catch {
          // skip unreadable entries (permission denied, binary, etc.)
        }
      }
    }
  };
  readDir(dir, '');
  return results;
}

export function getContent(projectId: string, filename: string): SharedContent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const filePath = resolveInside(sharedDir(data.project.name), filename);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    id: filename,
    projectId,
    filename,
    content,
    createdBy: 'user',
    updatedAt: stat.mtime.toISOString(),
  };
}

export function createContent(projectId: string, filename: string, content: string, _createdBy: string): SharedContent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const dir = sharedDir(data.project.name);
  ensureDir(dir);
  const filePath = resolveInside(dir, filename);
  if (!filePath) return null;
  // Support nested filenames like "subfolder/file.md" by ensuring parent dir exists
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  const stat = fs.statSync(filePath);
  return {
    id: filename,
    projectId,
    filename,
    content,
    createdBy: _createdBy,
    updatedAt: stat.mtime.toISOString(),
  };
}

export function updateContent(projectId: string, filename: string, content: string): SharedContent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const filePath = resolveInside(sharedDir(data.project.name), filename);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  const stat = fs.statSync(filePath);
  return {
    id: filename,
    projectId,
    filename,
    content,
    createdBy: 'user',
    updatedAt: stat.mtime.toISOString(),
  };
}

export function deleteContent(projectId: string, filename: string): boolean {
  const data = getProjectData(projectId);
  if (!data) return false;
  const filePath = resolveInside(sharedDir(data.project.name), filename);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  fs.unlinkSync(filePath);
  return true;
}

// --- Group Chat ---

export function readGroupChat(projectId: string): GroupChatEntry[] {
  const dir = projectDir(projectId);
  const file = path.join(dir, 'groupchat.jsonl');
  if (!fs.existsSync(file)) return [];
  
  const entries: GroupChatEntry[] = [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch { /* ignore bad lines */ }
  }
  return entries;
}

export function appendGroupChat(projectId: string, entry: GroupChatEntry): void {
  const dir = projectDir(projectId);
  ensureDir(dir);
  const file = path.join(dir, 'groupchat.jsonl');
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf-8');
}

// --- Audit Log ---

export function appendAuditLog(projectId: string, entry: Record<string, unknown>): void {
  const dir = projectDir(projectId);
  ensureDir(dir);
  const file = path.join(dir, 'audit.jsonl');
  fs.appendFileSync(file, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n', 'utf-8');
}

/** Last `limit` audit entries (newest last) — used to give the Supervisor memory
 *  of recently approved / rejected plans. */
export function readRecentAudit(projectId: string, limit = 10): Array<Record<string, unknown>> {
  try {
    const file = path.join(projectDir(projectId), 'audit.jsonl');
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim());
    const out: Array<Record<string, unknown>> = [];
    for (const line of lines.slice(-limit)) {
      try { out.push(JSON.parse(line)); } catch { /* skip */ }
    }
    return out;
  } catch {
    return [];
  }
}

// --- Project Wiki (stored in ~/.conduit/memory/[project_name]/) ---

const WIKI_SCHEMA = `# Project Wiki Schema

## Purpose
This is the project's persistent knowledge base, maintained by AI agents via Conduit.
It accumulates and organizes knowledge over time — architecture decisions, API specs,
progress tracking, and cross-referenced documentation.

## Structure

### Core Pages
- **overview.md** — Project purpose, tech stack, current state. The "executive summary" — always keep under 200 lines.
- **architecture.md** — System design, components, data flow, infrastructure.
- **api-endpoints.md** — All API endpoints with request/response formats.
- **data-model.md** — Database schema, models, relationships.
- **decisions.md** — Architecture and design decisions with rationale. Append-only — never delete entries.
- **progress.md** — What's done, what's in progress, what's blocked.

### Agent Logs
- **agents/[agent-name].md** — Per-agent work log: what this agent has accomplished, current focus, blockers.

### Raw Sources (optional)
- **raw/** — Original documents, specs, or references. Immutable — agents read but never modify these.

## Maintenance Rules

When asked to "update wiki" or "write to wiki":

1. Read \`_index.md\` first to find relevant existing pages
2. Update ALL affected pages, not just one. A single change might touch 3-5 pages.
3. Add \`[[cross-references]]\` to related pages using markdown links
4. Always append an entry to \`_log.md\` with format: \`## [YYYY-MM-DD] action | Summary\`
5. Update \`_index.md\` if you created or deleted pages
6. Never delete content from \`decisions.md\` — only append
7. When new information contradicts existing content, note the contradiction and update

## Operations

### Ingest
When processing new information: read it, extract key points, update relevant pages,
add cross-references, update index, append to log.

### Query
When answering questions about the project: read \`_index.md\` first, then drill into
relevant pages. Cite which pages you referenced.

### Lint
Periodically check for: contradictions between pages, stale information, orphan pages
with no inbound links, important concepts missing their own page, gaps that need filling.
`;

const WIKI_INDEX = `# Project Wiki Index

> Auto-maintained by AI agents. See \`_schema.md\` for conventions.

## Core
- [Overview](overview.md) — Project purpose, tech stack, current state
- [Architecture](architecture.md) — System design and components
- [API Endpoints](api-endpoints.md) — REST/GraphQL endpoint reference
- [Data Model](data-model.md) — Database schema and relationships
- [Decisions](decisions.md) — Architecture decision records
- [Progress](progress.md) — Current status and roadmap

## Agents
<!-- Agent pages will be listed here as they are created -->
`;

const WIKI_LOG = `# Project Wiki Log

> Chronological record of wiki updates. Append-only.
> Format: ## [YYYY-MM-DD] action | Summary

`;

const WIKI_OVERVIEW = `# Project Overview

> This page should be the first thing a new agent reads to understand the project.
> Keep it under 200 lines. Update it as the project evolves.

## Purpose
<!-- What does this project do? Who is it for? -->

## Tech Stack
<!-- Languages, frameworks, databases, infrastructure -->

## Current State
<!-- What's working? What's in progress? What's the immediate priority? -->

## Key Links
<!-- Repository, deployment, documentation, etc. -->
`;

export function isWikiInitialized(projectId: string): boolean {
  const data = getProjectData(projectId);
  if (!data) return false;
  const dir = wikiDir(data.project.name);
  return fs.existsSync(path.join(dir, '_schema.md'));
}

export function initializeWiki(projectId: string): boolean {
  const data = getProjectData(projectId);
  if (!data) return false;
  const dir = wikiDir(data.project.name);
  ensureDir(dir);
  ensureDir(path.join(dir, 'agents'));
  ensureDir(path.join(dir, 'raw'));

  const files: Record<string, string> = {
    '_schema.md': WIKI_SCHEMA,
    '_index.md': WIKI_INDEX,
    '_log.md': WIKI_LOG,
    'overview.md': WIKI_OVERVIEW,
    'architecture.md': [
      '# Architecture',
      '',
      '## System Overview',
      '<!-- High-level description: what are the main components and how do they interact? -->',
      '',
      '## Component Diagram',
      '```',
      '┌──────────┐     ┌──────────┐     ┌──────────┐',
      '│ Frontend  │────>│ Backend  │────>│ Database │',
      '└──────────┘     └──────────┘     └──────────┘',
      '```',
      '<!-- Replace with your actual architecture -->',
      '',
      '## Components',
      '',
      '### Frontend',
      '<!-- Framework, structure, key patterns -->',
      '',
      '### Backend',
      '<!-- Framework, API layer, business logic -->',
      '',
      '### Database',
      '<!-- Type, schema overview, key tables -->',
      '',
      '## Data Flow',
      '<!-- How does data flow through the system? Key request paths? -->',
      '',
      '## Infrastructure',
      '<!-- Hosting, CI/CD, environment setup -->',
      '',
    ].join('\n'),
    'api-endpoints.md': [
      '# API Endpoints',
      '',
      '## Base URL',
      '<!-- e.g. http://localhost:3000/api -->',
      '',
      '## Endpoints',
      '',
      '| Method | Path | Description | Auth |',
      '|--------|------|-------------|------|',
      '| GET | /example | Description | No |',
      '| POST | /example | Description | Yes |',
      '',
      '## Authentication',
      '<!-- How does auth work? Token format? -->',
      '',
      '## Error Format',
      '<!-- Standard error response structure -->',
      '',
    ].join('\n'),
    'data-model.md': [
      '# Data Model',
      '',
      '## Entity Relationship',
      '<!-- Key entities and their relationships -->',
      '',
      '## Models',
      '',
      '### Example Model',
      '| Field | Type | Description |',
      '|-------|------|-------------|',
      '| id | string | Primary key |',
      '| created_at | datetime | Creation timestamp |',
      '',
      '## Migrations',
      '<!-- Notable migration history -->',
      '',
    ].join('\n'),
    'decisions.md': [
      '# Architecture Decisions',
      '',
      '> Append-only — never delete entries. New decisions go at the bottom.',
      '',
      '<!-- Template for new entries:',
      '## [YYYY-MM-DD] Decision Title',
      '**Context:** Why did this come up?',
      '**Decision:** What did we choose?',
      '**Alternatives considered:** What else was on the table?',
      '**Rationale:** Why this over the alternatives?',
      '-->',
      '',
    ].join('\n'),
    'progress.md': [
      '# Progress',
      '',
      '> Updated by agents when tasks are completed or started.',
      '> Move items between sections as status changes.',
      '',
      '## Done',
      '<!-- - [YYYY-MM-DD] What was completed -->',
      '',
      '## In Progress',
      '<!-- - What is currently being worked on (and by which agent) -->',
      '',
      '## Blocked',
      '<!-- - What is stuck and why -->',
      '',
      '## Upcoming',
      '<!-- - What needs to be done next -->',
      '',
    ].join('\n'),
  };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }
  return true;
}

export function listWikiFiles(projectId: string): SharedContent[] {
  const data = getProjectData(projectId);
  if (!data) return [];
  const dir = wikiDir(data.project.name);
  if (!fs.existsSync(dir)) return [];

  const results: SharedContent[] = [];
  const readDir = (d: string, prefix: string) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        const sub = prefix ? prefix + '/' + entry.name : entry.name;
        readDir(path.join(d, entry.name), sub);
      } else {
        const filePath = path.join(d, entry.name);
        const filename = prefix ? prefix + '/' + entry.name : entry.name;
        const stat = fs.statSync(filePath);
        results.push({
          id: filename,
          projectId,
          filename,
          content: '',
          createdBy: 'system',
          updatedAt: stat.mtime.toISOString(),
        });
      }
    }
  };
  readDir(dir, '');
  return results;
}

export function getWikiFile(projectId: string, filename: string): SharedContent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const filePath = resolveInside(wikiDir(data.project.name), filename);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const stat = fs.statSync(filePath);
  return {
    id: filename,
    projectId,
    filename,
    content: fs.readFileSync(filePath, 'utf-8'),
    createdBy: 'system',
    updatedAt: stat.mtime.toISOString(),
  };
}

export function updateWikiFile(projectId: string, filename: string, content: string): SharedContent | null {
  const data = getProjectData(projectId);
  if (!data) return null;
  const filePath = resolveInside(wikiDir(data.project.name), filename);
  if (!filePath) return null;
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
  const stat = fs.statSync(filePath);
  return {
    id: filename,
    projectId,
    filename,
    content,
    createdBy: 'user',
    updatedAt: stat.mtime.toISOString(),
  };
}

export { SHARED_CONTENT_DIR, WIKI_DIR };
