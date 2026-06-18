const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';

/**
 * Call Claude via AWS Bedrock.
 * @param {object} opts - { system, messages, maxTokens, timeoutMs }
 * @returns {string} - The assistant text response
 */
async function callClaude({ system, messages, maxTokens = 1500, timeoutMs = 30000 }) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body)
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out (' + (timeoutMs / 1000) + 's)')), timeoutMs)
  );

  const response = await Promise.race([client.send(command), timeoutPromise]);
  const responseBody = JSON.parse(Buffer.from(response.body).toString('utf8'));

  if (responseBody.error) throw new Error(responseBody.error.message || 'Bedrock error');
  return responseBody.content?.[0]?.text || '';
}

module.exports = { callClaude, MODEL_ID };
