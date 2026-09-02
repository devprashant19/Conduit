import { Agent, BedrockModel, tool } from '@strands-agents/sdk';
import { bedrockClient, BEDROCK_MODEL_ID } from './config.js';
import { z } from 'zod';
import {
  getProjectOverview,
  readWiki,
  readShared,
  getAgentStatus,
  askAgent,
  messageAgent
} from './tools.js';

export function createSupervisorAgent(onUpdate: (update: any) => void) {
  const reportUpdate = tool({
    name: 'report_update',
    description: 'Report the classification and summary of an agent\'s recent terminal output.',
    schema: z.object({
      classification: z.enum(['progress', 'blocker', 'question', 'risky_action', 'noise'])
        .describe('The category of the update.'),
      summary: z.string().describe('One short spoken-style sentence summarizing it.'),
    }),
    handler: async (args) => {
      onUpdate(args);
      return { success: true, message: 'Update recorded successfully.' };
    },
  });

  return new Agent({
    name: 'ConduitSupervisor',
    description: 'Supervises running coding agents by analyzing their output and deciding what matters.',
    instructions: 'You are a technical supervisor overseeing autonomous coding agents. When given terminal output from an agent, analyze it and report your findings using the report_update tool. Use your available tools if you need more context about the project or other agents.',
    model: new BedrockModel({
      modelId: BEDROCK_MODEL_ID,
      client: bedrockClient,
    }),
    tools: [
      getProjectOverview,
      readWiki,
      readShared,
      getAgentStatus,
      askAgent,
      messageAgent,
      reportUpdate,
    ],
  });
}

// Global instance just for the smoke test
export const supervisorAgent = createSupervisorAgent(() => {});

export async function runSmokeTest(message: string): Promise<string> {
  // Execute a single turn using the Strands Agent
  const result = await supervisorAgent.invoke({
    messages: [
      { role: 'user', content: message }
    ]
  });

  // Extract the text response from the model
  const lastMsg = result.messages[result.messages.length - 1];
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
