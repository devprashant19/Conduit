import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

// Use the standard credential chain:
// It will automatically pick up AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env vars
// OR fall back to the EC2 Instance Profile / ECS task role if running in AWS.
export const bedrockClient = new BedrockRuntimeClient({
  region,
  credentials: fromNodeProviderChain(),
});
