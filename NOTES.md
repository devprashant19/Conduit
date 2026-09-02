# Strands Agents SDK & AWS Bedrock Integration Notes

## Bedrock Model Selection
**Model ID Used:** `anthropic.claude-3-5-sonnet-20240620-v1:0`
**Reasoning:** 
- **Coding Proficiency:** Claude 3.5 Sonnet is highly capable at coding tasks and reasoning, which is essential for a "brain" orchestrator managing coding agents.
- **Speed & Cost:** It provides an excellent balance of low latency and cost-effectiveness compared to the Opus tier, making it ideal for real-time dashboard interactions.
- **Availability:** Readily available in `us-east-1`, which is the standard region for many hackathons.

## AWS Credentials Strategy
The integration uses the `@aws-sdk/credential-providers` standard Node provider chain via `fromNodeProviderChain()`.
**Recommendation for Deployment:** 
For the deployed version on EC2 (or ECS), I strongly recommend using an **IAM Instance Role** rather than hardcoding or injecting IAM User keys. The Node provider chain automatically detects and uses the instance role metadata. This is a much cleaner architecture for hackathon judging and completely eliminates the risk of leaked keys in the repository or environment. 

For local development, developers can just set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in their `.env` file, and the same code will pick them up seamlessly.

## End-to-End Verification Status
The integration is fully coded (SDK installed, Bedrock model configured, `get_conduit_status` tool registered, and `/api/strands/ping` endpoint created).

Currently, testing the `/api/strands/ping` endpoint locally yields:
```json
{"error":"Could not load credentials from any providers"}
```

This is because the local development environment does not currently have AWS credentials set in the `.env` file or environment variables. 

**Next Steps:**
To complete the verification step as requested, please add valid AWS credentials with Bedrock access to your `.env` file. Once added, I can re-run the smoke test and capture the actual model response here.
