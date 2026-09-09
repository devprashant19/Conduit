# ── Build stage ─────────────────────────────────────────────────────────
FROM node:20 AS builder
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app

# node-pty needs a toolchain to build; curl is used by the Claude Code
# lifecycle hooks; git is what the coding agents actually work with.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ curl git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json .npmrc ./
RUN npm ci --omit=dev && npm install --no-save concurrently

# The coding-agent CLIs Conduit drives. Each one still needs to be logged in:
# mount ~/.claude / ~/.codex from the host (see docker-compose.yml) or run
# `docker compose exec conduit claude login` once.
RUN npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli opencode-ai \
  || echo "WARN: one or more agent CLIs failed to install — agents of that type will not start"

# aider is the engine behind the `gpt` (Groq) and `nemotron` (OpenRouter) agent
# types. It supports Python >=3.10,<3.13, so let uv fetch its own 3.12 rather
# than relying on whatever python3 the base image ships.
ENV UV_INSTALL_DIR=/usr/local/bin
RUN (curl -LsSf https://astral.sh/uv/install.sh | sh \
     && uv tool install --python 3.12 aider-chat \
     && ln -sf /root/.local/bin/aider /usr/local/bin/aider) \
  || echo "WARN: aider failed to install — gpt/nemotron agents will not start"

COPY --from=builder /app/dist ./dist
COPY scripts ./scripts

RUN mkdir -p /root/.conduit
EXPOSE 3200
ENV HOST=0.0.0.0 PORT=3200
CMD ["npm", "run", "start:all"]
