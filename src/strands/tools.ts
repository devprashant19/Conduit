import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const DAEMON_URL = `http://127.0.0.1:${process.env.CONDUIT_DAEMON_PORT || '3210'}`;
const SERVER_URL = `http://127.0.0.1:${process.env.PORT || '3200'}`;

export const getProjectOverview = tool({
  name: 'get_project_overview',
  description: 'Read a project\'s wiki overview — a quick summary of what the project is and its current state.',
  inputSchema: z.object({
    projectId: z.string().describe('The ID of the project to inspect'),
  }),
  callback: async (args: any) => {
    const res = await fetch(`${DAEMON_URL}/org/wiki?project=${encodeURIComponent(args.projectId)}&overview=1`);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  },
});

export const readWiki = tool({
  name: 'read_wiki',
  description: 'Read a project\'s wiki. Omit filename to list pages.',
  inputSchema: z.object({
    projectId: z.string().describe('Project name or id.'),
    filename: z.string().optional().describe('Wiki page filename. Omit to list pages.'),
  }),
  callback: async (args: any) => {
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
  inputSchema: z.object({
    projectId: z.string().describe('The ID of the project'),
    filename: z.string().optional().describe('Specific wiki file to read (optional)'),
  }),
  callback: async (args: any) => {
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
  inputSchema: z.object({
    projectId: z.string().describe('The ID of the project'),
    agentId: z.string().describe('The ID of the agent'),
  }),
  callback: async (args: any) => {
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
  inputSchema: z.object({
    projectId: z.string().describe('The ID of the project'),
    targetAgentId: z.string().describe('The ID of the agent to ask'),
    question: z.string().describe('The question to ask'),
  }),
  callback: async (args: any) => {
    const res = await fetch(`${DAEMON_URL}/org/ask-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: args.projectId, agent: args.targetAgentId, message: args.question }),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  },
});

export const messageAgent = tool({
  name: 'message_agent',
  description: 'Inject a message into an agent\'s terminal from another agent or the supervisor.',
  inputSchema: z.object({
    projectId: z.string().describe('Project ID.'),
    fromAgent: z.string().describe('Name of the sender agent.'),
    toAgent: z.string().describe('Name of the recipient agent.'),
    message: z.string().describe('The message.'),
  }),
  callback: async (args: any) => {
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

export const planAction = tool({
  name: 'plan_action',
  description: 'Propose an action to instruct another agent. You MUST use this tool instead of ask_agent or message_agent when you intend to change/build/deploy something. The human will review your plan.',
  inputSchema: z.object({
    description: z.string().describe('A plain language explanation of what you want to do and why.'),
    targetAgent: z.string().describe('The name or ID of the agent you want to instruct.'),
    targetProject: z.string().describe('The ID of the project.'),
    proposedMessage: z.string().describe('The exact message or instruction you want to send to the agent.'),
  }),
  callback: async (args: any) => {
    const res = await fetch(`${SERVER_URL}/api/projects/${args.targetProject}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || `HTTP ${res.status}` };
    return { success: true, message: 'Plan submitted for human approval. Await their decision.' };
  },
});
