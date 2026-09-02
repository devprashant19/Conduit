import { Agent, BedrockModel, tool } from '@strands-agents/sdk';
import { bedrockClient, BEDROCK_MODEL_ID } from './config.js';
import { z } from 'zod';
import {
  getProjectOverview,
  readWiki,
  readShared,
  getAgentStatus,
  planAction
} from './tools.js';

export function createSupervisorAgent(onUpdate: (update: any) => void) {
  const reportUpdate = tool({
    name: 'report_update',
    description: 'Report the classification and summary of an agent\'s recent terminal output.',
    inputSchema: z.object({
      classification: z.enum(['progress', 'blocker', 'question', 'risky_action', 'noise'])
        .describe('The category of the update.'),
      summary: z.string().describe('One short spoken-style sentence summarizing it.'),
    }),
    callback: async (args: any) => {
      onUpdate(args);
      return { success: true, message: 'Update recorded successfully.' };
    },
  });

  return new Agent({
    name: 'ConduitSupervisor',
    description: 'Supervises running coding agents by analyzing their output and deciding what matters.',
    systemPrompt: 'You are a technical supervisor overseeing autonomous coding agents. When given terminal output from an agent, analyze it and report your findings using the report_update tool. Use your available tools if you need more context about the project or other agents. IF YOU WANT TO INSTRUCT AN AGENT TO DO SOMETHING (WRITE-intent), YOU MUST USE THE plan_action TOOL to propose your action for human approval first. You cannot directly instruct agents without approval.',
    model: new BedrockModel({
      modelId: BEDROCK_MODEL_ID,
    }),
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

// Global instance just for the smoke test
export const supervisorAgent = createSupervisorAgent(() => {});

export async function runSmokeTest(message: string): Promise<string> {
  // Execute a single turn using the Strands Agent
  const result = await supervisorAgent.invoke(message);

  // Extract the text response from the model
  const lastMsg = result.lastMessage;
  if (lastMsg && typeof lastMsg.content === 'string') {
    return lastMsg.content;
  } else if (lastMsg && Array.isArray(lastMsg.content)) {
    // If it's a multimodal content array
    return lastMsg.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');
  }

  return 'No textual response generated.';
}
