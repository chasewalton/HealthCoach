import OpenAI from 'openai';

let client: OpenAI | null = null;

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'X-Title': 'HealthCoach',
      },
    });
  }
  return client;
}

export async function createChatCompletion(
  request: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
) {
  return getClient().chat.completions.create(request);
}
