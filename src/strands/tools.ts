import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const DAEMON_URL = `http://127.0.0.1:${process.env.CONDUIT_DAEMON_PORT || '3210'}`;
const SERVER_URL = `http://127.0.0.1:${process.env.PORT || '3200'}`;

export const getProjectOverview = tool({
  name: 'get_project_overview',
  description: 'Read a project\'s wiki overview — a quick summary of what the project is and its current state.',
  schema: z.object({
    projectId: z.string().describe('Project name or id.'),
  }),
  handler: async (args) => {
    const res = await fetch(`${DAEMON_URL}/org/wiki?project=${encodeURIComponent(args.projectId)}&overview=1`);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  },
});

export const readWiki = tool({
  name: 'read_wiki',
  description: 'Read a project\'s wiki. Omit filename to list pages.',
  schema: z.object({
    projectId: z.string().describe('Project name or id.'),
    filename: z.string().optional().describe('Wiki page filename. Omit to list pages.'),
  }),
  handler: async (args) => {
    let url = `${DAEMON_URL}/org/wiki?project=${encodeURIComponent(args.projectId)}`;
    if (args.filename) url += `&page=${encodeURIComponent(args.filename)}`;
    const res = await fetch(url);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  },
});

export const readShared = tool({
  name: 'read_shared',
  description: 'Read a project\'s shared content files. Omit filename to list files.',
  schema: z.object({
    projectId: z.string().describe('Project name or id.'),
    filename: z.string().optional().describe('Shared file path. Omit to list files.'),
  }),
  handler: async (args) => {
    let url = `${DAEMON_URL}/org/shared?project=${encodeURIComponent(args.projectId)}`;
    if (args.filename) url += `&file=${encodeURIComponent(args.filename)}`;
    const res = await fetch(url);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  },
});

export const getAgentStatus = tool({
  name: 'get_agent_status',
  description: 'Get the live status of a single agent in a project.',
  schema: z.object({
    projectId: z.string().describe('Project name or id.'),
    agentId: z.string().describe('Agent name or id.'),
  }),
  handler: async (args) => {
    const res = await fetch(`${DAEMON_URL}/org/snapshot`);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const snap = await res.json();
    const proj = snap.projects.find((p: any) => p.id === args.projectId || p.name === args.projectId);
    if (!proj) return { error: 'Project not found' };
    const ag = proj.agents.find((a: any) => a.id === args.agentId || a.name === args.agentId);
    if (!ag) return { error: 'Agent not found' };
    return { status: ag.status, cli: ag.cli, role: ag.role };
  },
});

export const askAgent = tool({
  name: 'ask_agent',
  description: 'Send a question/instruction to one agent and wait for its reply.',
  schema: z.object({
    projectId: z.string().describe('Project name or id.'),
    agentId: z.string().describe('Agent name or id.'),
    message: z.string().describe('What to ask or tell the agent.'),
  }),
  handler: async (args) => {
    const res = await fetch(`${DAEMON_URL}/org/ask-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: args.projectId, agent: args.agentId, message: args.message }),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  },
});

export const messageAgent = tool({
  name: 'message_agent',
  description: 'Inject a message into an agent\'s terminal from another agent or the supervisor.',
  schema: z.object({
    projectId: z.string().describe('Project ID.'),
    fromAgent: z.string().describe('Name of the sender agent.'),
    toAgent: z.string().describe('Name of the recipient agent.'),
    message: z.string().describe('The message.'),
  }),
  handler: async (args) => {
    const res = await fetch(`${DAEMON_URL}/org/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: args.projectId,
        agent: args.toAgent,
        fromName: args.fromAgent,
        message: args.message,
      }),
    });
    
    // We should read the response
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || `HTTP ${res.status}` };
    return json;
  },
});
