const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error('Cannot reach the Conduit server — is it running?');
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Projects
export const listProjects = () => request<Project[]>('/projects');
export const createProject = (data: { name: string; cwd: string; description?: string }) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Pick<Project, 'name' | 'description' | 'cwd'>>) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: string, removeData?: boolean) =>
  request<void>(`/projects/${id}?removeData=${removeData ? 'true' : 'false'}`, { method: 'DELETE' });

// Agents
export const listAgents = (projectId: string) =>
  request<Agent[]>(`/projects/${projectId}/agents`);
export const createAgent = (projectId: string, data: { name: string; cli: string; cwd?: string; role?: string; flags?: Agent['flags'] }) =>
  request<Agent>(`/projects/${projectId}/agents`, { method: 'POST', body: JSON.stringify(data) });
export const deleteAgent = (projectId: string, agentId: string) =>
  request<void>(`/projects/${projectId}/agents/${agentId}`, { method: 'DELETE' });
export const startAgent = (projectId: string, agentId: string) =>
  request<{ status: string }>(`/projects/${projectId}/agents/${agentId}/start`, { method: 'POST' });
export const stopAgent = (projectId: string, agentId: string) =>
  request<{ status: string }>(`/projects/${projectId}/agents/${agentId}/stop`, { method: 'POST' });
export const restartAgent = (projectId: string, agentId: string) =>
  request<{ status: string }>(`/projects/${projectId}/agents/${agentId}/restart`, { method: 'POST' });

// Approval gates + plans
export const resolveGate = (projectId: string, agentId: string, decision: 'approve' | 'reject' | 'custom', customInput?: string) =>
  request<{ success: boolean; action: string }>(`/projects/${projectId}/agents/${agentId}/gate/resolve`, {
    method: 'POST', body: JSON.stringify({ decision, customInput }),
  });
export const listPlans = (projectId: string) => request<Plan[]>(`/projects/${projectId}/plans`);
export const resolvePlan = (projectId: string, planId: string, decision: 'approve' | 'reject', reason?: string) =>
  request<{ success: boolean; delivered: boolean; note?: string }>(`/projects/${projectId}/plans/${planId}/resolve`, {
    method: 'POST', body: JSON.stringify({ decision, reason }),
  });

// Group chat + messages + activity
export const listGroupChat = (projectId: string) =>
  request<{ messages: GroupChatMsg[] }>(`/projects/${projectId}/groupchat`);
export const sendGroupChat = (projectId: string, message: string) =>
  request<GroupChatMsg & { delivered: string[]; skipped: string[] }>(`/projects/${projectId}/groupchat`, {
    method: 'POST', body: JSON.stringify({ message }),
  });
export const sendAgentMessage = (projectId: string, data: { fromAgentId: string; fromAgentName: string; target: string; message: string }) =>
  request<{ delivered: boolean; toAgentName: string }>(`/projects/${projectId}/messages`, {
    method: 'POST', body: JSON.stringify(data),
  });
export const listActivity = (projectId: string) =>
  request<ActivityEvent[]>(`/activity?projectId=${encodeURIComponent(projectId)}`);

// Shared Content
export const listContent = (projectId: string) =>
  request<SharedContent[]>(`/projects/${projectId}/content`);
export const getContent = (projectId: string, filename: string) =>
  request<SharedContent>(`/projects/${projectId}/content/${encodeURIComponent(filename)}`);
export const createContent = (projectId: string, data: { filename: string; content?: string; createdBy?: string }) =>
  request<SharedContent>(`/projects/${projectId}/content`, { method: 'POST', body: JSON.stringify(data) });
export const updateContent = (projectId: string, filename: string, content: string) =>
  request<SharedContent>(`/projects/${projectId}/content/${encodeURIComponent(filename)}`, { method: 'PUT', body: JSON.stringify({ content }) });
export const deleteContent = (projectId: string, filename: string) =>
  request<void>(`/projects/${projectId}/content/${encodeURIComponent(filename)}`, { method: 'DELETE' });

// Project Wiki
export const getWikiStatus = (projectId: string) =>
  request<{ initialized: boolean }>(`/projects/${projectId}/wiki/status`);
export const initializeWiki = (projectId: string) =>
  request<{ initialized: boolean }>(`/projects/${projectId}/wiki/initialize`, { method: 'POST' });
export const listWikiFiles = (projectId: string) =>
  request<SharedContent[]>(`/projects/${projectId}/wiki`);
export const getWikiFile = (projectId: string, filename: string) =>
  request<SharedContent>(`/projects/${projectId}/wiki/${encodeURIComponent(filename)}`);
export const updateWikiFile = (projectId: string, filename: string, content: string) =>
  request<SharedContent>(`/projects/${projectId}/wiki/${encodeURIComponent(filename)}`, { method: 'PUT', body: JSON.stringify({ content }) });

// Misc
export const getHealth = () =>
  request<{ ok: boolean; daemon: boolean; auth: boolean; supervisor: string; bedrockModel: string; region: string }>('/health');

// Types (shared with backend)
export interface Project {
  id: string;
  name: string;
  description?: string;
  cwd: string;
  createdAt: string;
}

export type AgentStatus = 'stopped' | 'running' | 'idle' | 'awaiting_input';

export interface PendingGate {
  prompt: string;
  source: 'regex' | 'supervisor';
  options?: string[];
}

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  cli: 'claude' | 'codex' | 'gemini' | 'opencode' | 'gpt' | 'nemotron';
  cwd: string;
  status: AgentStatus;
  pid?: number;
  flags?: {
    dangerouslySkipPermissions?: boolean;
    remoteControl?: boolean;
  };
  pendingGate?: PendingGate;
}

export interface Plan {
  id: string;
  projectId: string;
  description: string;
  targetAgent: string;
  targetProject: string;
  proposedMessage: string;
  createdAt: string;
}

export interface SharedContent {
  id: string;
  projectId: string;
  filename: string;
  content: string;
  createdBy: string;
  updatedAt: string;
}

export interface GroupChatMsg {
  id: string;
  ts: string;
  role: 'supervisor' | 'user' | 'agent' | 'human';
  sender: string;
  text?: string;
  message?: string;
  classification?: 'progress' | 'blocker' | 'question' | 'risky_action' | 'noise';
  projectId?: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  agentId?: string;
  agentName?: string;
  event: string;
  detail: string;
  timestamp: string;
  fromAgent?: string;
  toAgent?: string;
  message?: string;
}
