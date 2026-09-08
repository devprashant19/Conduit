import dotenv from 'dotenv';

// Ensure .env is loaded
dotenv.config();

export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Bedrock model the Supervisor runs on. Keep this in sync with the IAM policy
 * in the README — the role must allow InvokeModel on exactly this id.
 */
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

/** True when the Supervisor is switched off (no AWS access, or by choice). */
export function supervisorDisabled(): boolean {
  const v = (process.env.CONDUIT_SUPERVISOR || '').trim().toLowerCase();
  return v === '0' || v === 'off' || v === 'false';
}

/**
 * Which backend classifies agent output.
 *   'bedrock'   — Strands + Amazon Bedrock only
 *   'anthropic' — the Anthropic Messages API only (ANTHROPIC_API_KEY, or the
 *                 Claude Code OAuth token on this machine)
 *   'auto'      — Bedrock first, Anthropic when Bedrock has no usable
 *                 credentials (the default)
 */
export function supervisorProvider(): 'auto' | 'anthropic' | 'bedrock' {
  const v = (process.env.SUPERVISOR_PROVIDER || '').trim().toLowerCase();
  if (v === 'anthropic' || v === 'claude') return 'anthropic';
  if (v === 'bedrock' || v === 'aws') return 'bedrock';
  return 'auto';
}

// Credentials: the Strands BedrockModel builds its own BedrockRuntimeClient,
// which uses the standard AWS SDK provider chain — AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY from the environment or .env, ~/.aws/credentials, or
// an EC2 / ECS instance role when running on AWS.
