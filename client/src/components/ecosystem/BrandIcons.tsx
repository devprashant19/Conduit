import React from 'react';

// Official, precision SVG brand vector paths
export const BrandIcons = {
  // Coding Agents
  claude: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
    </svg>
  ),
  openai: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zm-1.42-8.528A4.45 4.45 0 0 1 4.53 7.39l-.004.163v5.518a.784.784 0 0 0 .392.68l5.843 3.37-2.02 1.168a.08.08 0 0 1-.07.005L3.83 15.39a4.504 4.504 0 0 1-1.65-5.614zm16.597 3.845l-5.843-3.372 2.02-1.168a.08.08 0 0 1 .07-.005l4.84 2.796a4.494 4.494 0 0 1-.693 8.075v-5.645a.795.795 0 0 0-.394-.681zm2.01-3.044l-.141-.085-4.779-2.76a.776.776 0 0 0-.78 0L9.243 11.1v-2.33a.08.08 0 0 1 .033-.062L14.12 5.82a4.5 4.5 0 0 1 6.666 4.557zm-10.1-4.18l-2.02-1.164a.08.08 0 0 1-.038-.057V1.595a4.5 4.5 0 0 1 7.37 3.385l-.14.08-4.779 2.76a.795.795 0 0 0-.393.681zm1.097 2.365l2.602-1.5 2.607 1.5v2.999l-2.607 1.5-2.602-1.5z" />
    </svg>
  ),
  gemini: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.04 0C11.04 8.28 8.28 11.04 0 11.04C8.28 11.04 11.04 13.8 11.04 22.08C11.04 13.8 13.8 11.04 22.08 11.04C13.8 11.04 11.04 8.28 11.04 0Z" />
    </svg>
  ),
  opencode: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
    </svg>
  ),

  // Developer Ecosystem
  github: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  gitlab: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.6 9.6l-2.2-6.7c-.2-.6-.9-.9-1.5-.6-.3.2-.5.5-.6.8L16.8 9.6H7.2L4.7 3.1c-.2-.7-.9-1-1.6-.7-.3.1-.6.4-.7.7L.2 9.6c-.2.7 0 1.4.5 1.9l11.1 8.2c.3.2.7.2 1 0l10.3-8.2c.6-.5.7-1.2.5-1.9z" />
    </svg>
  ),
  docker: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H2.208a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185M23.79 9.89c-.465-.722-1.38-.992-2.17-.674-.347.14-.65.37-.887.667a4.238 4.238 0 00-2.825-1.077H1.38A1.378 1.378 0 000 10.184v4.542c0 3.328 2.708 6.036 6.036 6.036 4.316 0 8.012-2.846 9.878-6.84 2.826-.145 5.518-1.53 7.037-3.953.13-.207.039-.482-.16-.578z" />
    </svg>
  ),
  vscode: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.89 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zM18 17.525l-7.737-5.525L18 6.475v11.05z" />
    </svg>
  ),
  nodejs: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L1.6 6v12L12 24l10.4-6V6L12 0zm0 2.2l8.5 4.9v9.8L12 21.8 3.5 16.9V7.1L12 2.2z" />
    </svg>
  ),
  npm: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 7.334v9.332h7.999v-6.666h2.668v6.666h13.333V7.334H0zm6.666 8H1.334V8.667h5.333v6.667zm6.667 0H9.333V8.667h3.999v6.667zm9.333 0h-4v-4h-2.667v4h-1.333V8.667h8v6.667z" />
    </svg>
  ),

  // AI & Cloud Infrastructure
  aws: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.57 9.87c0-.62.4-1.02 1.02-1.02.63 0 1.03.4 1.03 1.02v2.79c0 1.82-1.28 3.1-3.1 3.1s-3.1-1.28-3.1-3.1V9.87c0-.62.4-1.02 1.02-1.02.63 0 1.03.4 1.03 1.02v2.79c0 .73.32 1.05 1.05 1.05.72 0 1.05-.32 1.05-1.05V9.87zm14.77 5.76c-.22-.19-.48-.28-.76-.28-.31 0-.58.11-.8.32-.47.45-1.28.79-2.14.79-1.46 0-2.39-.93-2.39-2.39 0-1.48.93-2.4 2.39-2.4.86 0 1.67.34 2.14.79.22.21.49.32.8.32.28 0 .54-.09.76-.28.43-.37.47-.99.1-1.42-.89-.95-2.27-1.5-3.8-1.5-2.6 0-4.43 1.77-4.43 4.49s1.83 4.49 4.43 4.49c1.53 0 2.91-.55 3.8-1.5.37-.43.33-1.05-.1-1.42zm-8.8-6.78c-.62 0-1.02.4-1.02 1.02v4.86c0 .62.4 1.02 1.02 1.02.63 0 1.03-.4 1.03-1.02V9.87c0-.62-.4-1.02-1.03-1.02zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  ),
  bedrock: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
    </svg>
  ),
  strands: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  ),
  mcp: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 7V3h-2v4h-4V3H8v4H6c-1.1 0-2 .9-2 2v5c0 3.31 2.69 6 6 6v2h4v-2c3.31 0 6-2.69 6-6V9c0-1.1-.9-2-2-2h-2zm0 7c0 2.21-1.79 4-4 4s-4-1.79-4-4V9h8v5z" />
    </svg>
  ),

  // Frontend & Runtime
  react: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0-7.5c-4.97 0-9.22 1.4-11.23 3.54-1.97 2.1-1.57 4.77.92 7.02-2.5 2.25-2.9 4.92-.92 7.02 2.01 2.14 6.26 3.54 11.23 3.54 4.97 0 9.22-1.4 11.23-3.54 1.97-2.1 1.57-4.77-.92-7.02 2.5-2.25 2.9-4.92.92-7.02-2.01-2.14-6.26-3.54-11.23-3.54zm0 19.5c-4.42 0-8.21-1.2-9.76-2.85-1.25-1.33-1.02-2.98.67-4.57 1.34 1.43 3.23 2.7 5.48 3.66.98 1.98 2.24 3.22 3.61 3.76zm-5.74-4.8c-1.85-.82-3.41-1.87-4.52-3.06-.92-.99-.92-1.93 0-2.92 1.11-1.19 2.67-2.24 4.52-3.06.66 1.47 1.55 3.02 2.63 4.52-1.08 1.5-1.97 3.05-2.63 4.52zm5.74 3.28c-1.06-.44-2.05-1.42-2.87-2.95 1.83-.49 3.86-.78 5.74-.78 1.88 0 3.91.29 5.74.78-.82 1.53-1.81 2.51-2.87 2.95zm5.74-3.28c-.66-1.47-1.55-3.02-2.63-4.52 1.08-1.5 1.97-3.05 2.63-4.52 1.85.82 3.41 1.87 4.52 3.06.92.99.92 1.93 0 2.92-1.11 1.19-2.67 2.24-4.52 3.06zm-3.61-4.72c-.98-1.98-2.24-3.22-3.61-3.76 4.42 0 8.21 1.2 9.76 2.85 1.25 1.33 1.02 2.98-.67 4.57-1.34-1.43-3.23-2.7-5.48-3.66z" />
    </svg>
  ),
  vite: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.012 3.085L12.593 23.63a.81.81 0 0 1-1.455.01L1.988 3.085a.8.8 0 0 1 .738-1.173h4.63a.8.8 0 0 1 .715.441L12 10.638l3.929-8.285a.8.8 0 0 1 .715-.441h4.63a.8.8 0 0 1 .738 1.173z" />
    </svg>
  ),
  typescript: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.5 0h21A1.5 1.5 0 0 1 24 1.5v21a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 0 22.5v-21A1.5 1.5 0 0 1 1.5 0zm10.26 8.52h-7.8v2.44h2.64v9.84h2.52V10.96h2.64V8.52zm8.68 3.48c-.68-.4-1.52-.64-2.52-.64-1.36 0-2.36.44-2.36 1.48 0 .84.68 1.28 1.96 1.68l.92.28c2.16.64 3.4 1.48 3.4 3.32 0 2.24-1.84 3.56-4.6 3.56-1.52 0-2.8-.36-3.76-.96l.68-2.24c.88.52 2.04.88 3.08.88 1.44 0 2.2-.56 2.2-1.52 0-.84-.68-1.28-2.04-1.72l-.84-.28c-2.08-.64-3.28-1.56-3.28-3.28 0-2.12 1.76-3.4 4.36-3.4 1.36 0 2.48.28 3.28.68l-.48 2.16z" />
    </svg>
  ),
  websocket: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 8.5v7L12 22l10-6.5v-7L12 2zm1 16.5l-6-3.9V10.7l6 3.9v3.9zm-2-6.2L5.4 8.7 11 5v3.6l-1 0.7 1 3zm2-3.6V5l5.6 3.7-5.6 3.6zm1 2.3l6-3.9v3.9l-6 3.9v-3.9z" />
    </svg>
  ),
  xterm: (props: { size?: number }) => (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.11-.9-2-2-2zm0 14H4V8h16v10zm-12-3l3.5-3.5L8 8l1.4-1.4 4.9 4.9-4.9 4.9L8 15zm6 0h4v2h-4v-2z" />
    </svg>
  ),
};

export interface ToolItem {
  id: string;
  name: string;
  iconKey: keyof typeof BrandIcons;
  category: 'agents' | 'developer' | 'infrastructure' | 'runtime';
}

export const ECOSYSTEM_ROWS: Array<{
  id: string;
  direction: 'left' | 'right';
  speedSec: number;
  tools: ToolItem[];
}> = [
  // ROW 1 — CODING AGENTS (← left)
  {
    id: 'row-agents',
    direction: 'left',
    speedSec: 42,
    tools: [
      { id: 'claude', name: 'Claude Code', iconKey: 'claude', category: 'agents' },
      { id: 'codex', name: 'OpenAI Codex', iconKey: 'openai', category: 'agents' },
      { id: 'gemini', name: 'Gemini CLI', iconKey: 'gemini', category: 'agents' },
      { id: 'opencode', name: 'OpenCode', iconKey: 'opencode', category: 'agents' },
      { id: 'claude-dup', name: 'Claude Code', iconKey: 'claude', category: 'agents' },
      { id: 'codex-dup', name: 'Codex CLI', iconKey: 'openai', category: 'agents' },
    ],
  },
  // ROW 2 — DEVELOPER ECOSYSTEM (→ right)
  {
    id: 'row-dev',
    direction: 'right',
    speedSec: 46,
    tools: [
      { id: 'github', name: 'GitHub', iconKey: 'github', category: 'developer' },
      { id: 'gitlab', name: 'GitLab', iconKey: 'gitlab', category: 'developer' },
      { id: 'docker', name: 'Docker', iconKey: 'docker', category: 'developer' },
      { id: 'vscode', name: 'VS Code', iconKey: 'vscode', category: 'developer' },
      { id: 'nodejs', name: 'Node.js', iconKey: 'nodejs', category: 'developer' },
      { id: 'npm', name: 'npm', iconKey: 'npm', category: 'developer' },
    ],
  },
  // ROW 3 — AI / CLOUD INFRASTRUCTURE (← left)
  {
    id: 'row-infra',
    direction: 'left',
    speedSec: 50,
    tools: [
      { id: 'aws', name: 'AWS Cloud', iconKey: 'aws', category: 'infrastructure' },
      { id: 'bedrock', name: 'Amazon Bedrock', iconKey: 'bedrock', category: 'infrastructure' },
      { id: 'strands', name: 'Strands Agents SDK', iconKey: 'strands', category: 'infrastructure' },
      { id: 'mcp', name: 'Model Context Protocol', iconKey: 'mcp', category: 'infrastructure' },
      { id: 'aws-ec2', name: 'Amazon EC2', iconKey: 'aws', category: 'infrastructure' },
      { id: 'bedrock-sup', name: 'Strands Supervisor', iconKey: 'strands', category: 'infrastructure' },
    ],
  },
  // ROW 4 — CONDUIT FRONTEND / RUNTIME STACK (→ right)
  {
    id: 'row-runtime',
    direction: 'right',
    speedSec: 44,
    tools: [
      { id: 'react', name: 'React', iconKey: 'react', category: 'runtime' },
      { id: 'vite', name: 'Vite', iconKey: 'vite', category: 'runtime' },
      { id: 'typescript', name: 'TypeScript', iconKey: 'typescript', category: 'runtime' },
      { id: 'websocket', name: 'WebSocket Replay', iconKey: 'websocket', category: 'runtime' },
      { id: 'xterm', name: 'xterm.js PTY', iconKey: 'xterm', category: 'runtime' },
    ],
  },
];
