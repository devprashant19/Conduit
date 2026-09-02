import { Agent, BedrockModel, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { AWS_REGION, BEDROCK_MODEL_ID } from './config.js';
import {
  getProjectOverview,
  readWiki,
  readShared,
  getAgentStatus,
  planAction,
} from './tools.js';

export type SupervisorClassification = 'progress' | 'blocker' | 'question' | 'risky_action' | 'noise';

export interface SupervisorUpdate {
  classification: SupervisorClassification;
  summary: string;
}

const SYSTEM_PROMPT = [
  'You are a technical supervisor overseeing autonomous coding agents on behalf of a human engineer.',
  'You receive batches of terminal output from one agent at a time. For each batch, decide whether the',
  'human needs to hear about it and call the report_update tool exactly once with:',
  '  - classification: progress | blocker | question | risky_action | noise',
  '  - summary: ONE short spoken-style sentence in plain English (it is read aloud).',
  'Use "noise" for routine chatter, redraws, and progress you already reported. Use "risky_action" only',
  'when the agent is about to do something destructive or irreversible (deleting data, force pushes,',
  'dropping tables, production deploys). Use "question" when the agent is waiting on the human.',
  'You may use the read-only tools to get project context. If you want an agent to DO something',
  '(any write intent), you MUST propose it with plan_action and wait for human approval — never assume',
  'a plan was approved. Rejected plans listed in the context must not be re-proposed unless the',
  'situation changed.',
].join(' ');

function buildModel(): BedrockModel {
  return new BedrockModel({
    modelId: BEDROCK_MODEL_ID,
    region: AWS_REGION,
    maxTokens: 512,
    temperature: 0.2,
  });
}

/**
 * A fresh Supervisor agent. Each call gets its own report_update sink so the
 * caller decides what to do with the classification (group chat, gate, TTS).
 */
export function createSupervisorAgent(onUpdate: (update: SupervisorUpdate) => void) {
  const reportUpdate = tool({
    name: 'report_update',
    description: 'Report the classification and summary of an agent\'s recent terminal output.',
    inputSchema: z.object({
      classification: z.enum(['progress', 'blocker', 'question', 'risky_action', 'noise'])
        .describe('The category of the update.'),
      summary: z.string().describe('One short spoken-style sentence summarizing it.'),
    }),
    callback: async (args: SupervisorUpdate) => {
      onUpdate(args);
      return { success: true, message: 'Update recorded successfully.' };
    },
  });

  return new Agent({
    name: 'ConduitSupervisor',
    description: 'Supervises running coding agents by analyzing their output and deciding what matters.',
    systemPrompt: SYSTEM_PROMPT,
    model: buildModel(),
    tools: [
      getProjectOverview,
      readWiki,
      readShared,
      getAgentStatus,
      planAction,
      reportUpdate,
    ],
  });
}

/** One-shot connectivity test — proves credentials + model access work. */
export async function runSmokeTest(message: string): Promise<string> {
  const agent = new Agent({
    name: 'ConduitSupervisorPing',
    systemPrompt: 'Reply in one short sentence.',
    model: buildModel(),
    tools: [],
  });
  const result = await agent.invoke(message);
  const lastMsg = result.lastMessage as { content?: unknown } | undefined;
  if (lastMsg && typeof lastMsg.content === 'string') return lastMsg.content;
  if (lastMsg && Array.isArray(lastMsg.content)) {
    return (lastMsg.content as Array<{ type?: string; text?: string }>)
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n');
  }
  return 'No textual response generated.';
}
