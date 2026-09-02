# Conduit

**The human-driven multi-agent control center for professional engineers.**

Conduit is a web-based dashboard for running and supervising multiple AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode) in parallel — with an AI Supervisor backed by the **AWS Strands Agents SDK** and **Amazon Bedrock** that watches agent outputs, surfaces what matters, and always asks you before it acts.

While autonomous agent platforms hand the steering wheel to AI, Conduit keeps you in the driver's seat: see every agent's screen in one window, get spoken audio updates, approve or reject agent plans, and intervene the moment something goes sideways.

## Project Provenance (Agents for Humans Hackathon)

The following components were built specifically during the submission period for the "Agents for Humans" hackathon (Professional Agents track):

- **Strands Supervisor Agent** — Bedrock-backed autonomous supervisor (`src/strands/agent.ts`) watching terminal output from all coding agents, powered by the AWS Strands Agents SDK
- **Group Chat** — Real-time message stream aggregating Supervisor summaries and human messages across all agents in a project
- **Voice/Audio Pipeline** — Text-to-speech delivery of agent status updates so you can hear what's happening without looking
- **Watchdog / Output Listener** — PTY hooking system (`src/strands/watcher.ts`) capturing and classifying CLI output in real time to trigger safety gates or progress summaries
- **Approval Gates** — Fast-path regex + slow-path Supervisor classification detecting risky agent actions and surfacing a human-approval modal before the agent proceeds
- **Plan-Approve Safety Valve** — "Brain proposes, human decides" system (`PlanModal.tsx`) where the Supervisor must propose any write-intent instruction and wait for an explicit human click before execution
- **Usage Dashboard UI** — Dedicated panel monitoring Claude (AgentCore) and Codex API rate limits and token usage quotas
- **AWS Deployment** — Full containerization (`Dockerfile`, `docker-compose.yml`) for deployment on EC2 with IAM role scoped to Bedrock-only access

> **What pre-existed:** The base project scaffolding (PTY terminal runner, Vite/React client shell, Express server, file storage, project/agent CRUD, shared content, wiki, and MCP messaging) was built prior to the submission window as an internal tool. All Strands/Bedrock integration and every item in the list above was added during the hackathon period.

## Why "human-driven"?

Autonomous agents are seductive in a demo. In practice they drift, burn tokens, and silently break things.

Conduit takes the opposite bet. You run 2–7 agents in parallel doing real work, but **you stay in the loop on every one**. The Strands Supervisor tells you what matters; you decide what happens next.

### The problems it solves

- **Too many terminal windows** — can't tell which agent is doing what
- **No easy way to share context** between agents on the same project
- **No cross-agent coordination** — you end up copy-pasting between windows
- **Agents take destructive actions silently** — you find out too late
- **Can't manage agents from mobile / remote** — stuck at your desk

## Architecture

![Architecture Diagram](architecture.png)

Conduit has three layers:

```
                        You (Browser)
                             │
                    ┌────────▼────────┐
                    │  React Web UI   │  Group Chat · Terminals · Approval Modals
                    │  port :3200     │  Voice/TTS Pipeline
                    └────────┬────────┘
                             │ REST + WebSocket
              ┌──────────────▼────────────────────┐
              │      Express Server (Node.js)      │
              │  PTY Manager · Routes · Storage    │
              └──────┬───────────────┬─────────────┘
                     │               │ HTTP /org/*
              ┌──────▼───────┐  ┌────▼───────────┐
              │ Coding Agent │  │  Conduit Daemon │
              │  PTY Shells  │  │   port :3210    │
              │ (Claude/Codex│  └────────┬────────┘
              │  Gemini/etc) │           │
              └──────────────┘    ┌──────▼──────────────────────┐
                                  │  Strands Supervisor Agent   │
                                  │  (AWS Strands Agents SDK)   │
                                  │  → Amazon Bedrock / Claude  │
                                  └─────────────────────────────┘
```

**AWS pieces:** The Strands Supervisor calls Amazon Bedrock (Claude via `BedrockModel`) for every classification decision. The full app runs on a single EC2 instance (`t3.small`/`t3.medium`) with an IAM role scoped to `bedrock:InvokeModel` only.

## Features

- **Multi-vendor** — Claude Code, Codex CLI, Gemini CLI, OpenCode in one UI
- **Project organization** — Group agents by project, each with its own config
- **Terminal streaming** — Real xterm.js terminals with live PTY via WebSocket
- **Five terminal layouts** — Single, 2-up, 3-up, Grid (recursive splits + drag-to-swap), Canvas (free-form drag & resize)
- **Command palette** — `⌘K` / `Ctrl+K` to jump to agents, switch layouts, change theme, run batch actions
- **Collapsible, resizable sidebar** — Drag the right edge (180–420px), or hit the toggle to hide it completely
- **4 themes** — Dark, Light, Amber, Monochrome
- **Shared content** — Centralized file store with auto `--add-dir` / `--include-directories` for all supported CLIs
- **Agent messaging** — Agents in the same project can message each other via MCP
- **Project Wiki** — Persistent wiki per project, inspired by [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- **Activity feed** — Real-time file watcher on shared content + agent lifecycle + message events
- **Per-agent color identity** — Deterministic hue + monogram for every agent
- **Auto instruction files** — Generates `CLAUDE.md` / `AGENTS.md` in each agent's cwd
- **Start/Stop All** — Batch control per project
- **Usage monitor** — Claude & Codex rate limit tracking (session + week) visible in sidebar
- **Mobile responsive** — Slide-out sidebar, collapsible panels

## Quick Start

```bash
git clone https://github.com/devprashant19/Conduit.git
cd Conduit
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Prerequisites

- Node.js 20+
- `node-pty` requires native build tools:
  - **Windows**: Install Visual Studio Build Tools
  - **macOS**: `xcode-select --install`
  - **Linux**: `sudo apt install build-essential`
- **AWS credentials** with Bedrock access (for the Supervisor Agent) — attach an IAM role or configure `~/.aws/credentials`

### Production

```bash
npm run build
npm run start:all
```

Server runs on `http://localhost:3200` (serves both API and frontend). Daemon runs on `:3210` (internal only).

## Project Wiki

A persistent, structured wiki per project. Instead of agents rediscovering project context from scratch every session, they read and maintain a living wiki.

### How it works

1. Click **Wiki** tab → **Initialize Wiki** to create the wiki structure
2. Tell an agent to read the wiki:
   ```
   Read the project wiki's _index.md to understand the current project state
   ```
3. After an agent completes work, tell it to update the wiki:
   ```
   Update the project wiki with what you just did — follow _schema.md conventions
   ```

### Wiki structure

```
~/.conduit/wiki/[project-name]/
├── _schema.md          # Wiki maintenance rules
├── _index.md           # Page directory with one-line summaries
├── _log.md             # Chronological change log (append-only)
├── overview.md         # Project purpose, tech stack, current state
├── architecture.md     # System design, components, data flow
├── decisions.md        # Architecture decision records (append-only)
├── progress.md         # Done / In Progress / Blocked / Upcoming
├── agents/             # Per-agent work logs
└── raw/                # Immutable source documents
```

## Shared Content

Shared content files are stored in `~/.conduit/shared_content/[project-name]/`. When an agent starts, the directory is automatically passed to the CLI:

| CLI | Flag | Instruction File |
|-----|------|-----------------|
| Claude Code | `--add-dir` | `CLAUDE.md` |
| Codex CLI | `--add-dir` | `AGENTS.md` |
| Gemini CLI | `--include-directories` | `AGENTS.md` |
| OpenCode | via `AGENTS.md` | `AGENTS.md` |

## Agent Messaging

Agents in the same project can send messages to each other via MCP.

### How it works

1. When an agent starts, Conduit registers a session-scoped MCP server with `message_agent(target, message)` and `list_teammates()`.
2. `CLAUDE.md` / `AGENTS.md` is auto-updated with a **Teammates** section.
3. When you say *"tell backend the API is done"*, the agent maps it to `message_agent(target="backend", message="API is done")`.
4. Conduit writes the message into the target agent's PTY.

### Supported CLIs

| CLI | MCP Support | Mechanism |
|-----|-------------|-----------|
| Claude Code | ✅ | `--mcp-config <path>` flag (session-scoped) |
| Codex CLI | ✅ | Per-agent entry in `~/.codex/config.toml` |
| Gemini CLI | ❌ | Not yet |
| OpenCode | ❌ | Not yet |

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, TypeScript |
| Frontend | React, Vite, xterm.js |
| AI Supervisor | AWS Strands Agents SDK + Amazon Bedrock |
| PTY | node-pty |
| Communication | WebSocket (terminal I/O) + REST (CRUD) |
| File watching | chokidar |
| Storage | JSON files (`~/.conduit/`) |
| Build | tsup (backend) + Vite (frontend) |

## Data Storage

```
~/.conduit/
├── projects/
│   └── <project-id>/
│       └── project.json        # Project metadata + agents
├── shared_content/
│   └── <project-name>/         # Shared files between agents
├── wiki/
│   └── <project-name>/         # Project wiki
└── groupchat/
    └── <project-id>/           # Group chat history + audit log
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (backend + frontend with HMR) |
| `npm run build` | Production build |
| `npm run start:all` | Start production daemon + server |
| `npm run dev:server` | Backend only (watch mode) |
| `npm run dev:client` | Frontend only (Vite dev server) |

## Deployment (Single Instance — EC2)

Conduit runs on a single EC2 instance — one container, everything included.

### 1. EC2 Instance Setup

1. **Instance Type**: `t3.small` or `t3.medium` on Amazon Linux 2023 or Ubuntu.
2. **Security Group**:
   - Inbound TCP `3200` (or `80`) from `0.0.0.0/0`
   - Inbound TCP `22` (SSH) from **your IP only**
   - ⚠️ Port `3210` (daemon) must **NOT** be open publicly — it has no authentication
3. **IAM Role** (attach to instance — no static credentials needed):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:[REGION]::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
    }
  ]
}
```

### 2. Deploy

```bash
# Amazon Linux 2023
sudo dnf update -y && sudo dnf install -y docker git
sudo systemctl enable --now docker

# Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

git clone https://github.com/devprashant19/Conduit.git
cd Conduit
sudo docker compose up -d
```

### 3. Verify

Navigate to `http://<EC2_PUBLIC_IP>:3200` from a phone on a different network to confirm there are no localhost-assumption bugs.

Project data is stored in the `conduit-data` Docker volume (`/root/.conduit` inside the container) and survives container restarts.

## License

MIT
