import OpenAI from 'openai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIGateway {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async chat(options: ChatOptions): Promise<string> {
    const { messages, systemPrompt, temperature = 0.7, maxTokens = 4096 } = options;

    const allMessages: ChatMessage[] = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    allMessages.push(...messages);

    try {
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: allMessages,
        temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('AI Gateway error:', error);
      throw new Error('AI request failed');
    }
  }

  async chatWithJSON<T>(options: ChatOptions): Promise<T> {
    const { messages, systemPrompt, temperature = 0.3, maxTokens = 4096 } = options;

    const allMessages: ChatMessage[] = [];

    if (systemPrompt) {
      allMessages.push({
        role: 'system',
        content: systemPrompt + '\n\nRespond with valid JSON only.',
      });
    }

    allMessages.push(...messages);

    try {
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: allMessages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content) as T;
    } catch (error) {
      console.error('AI Gateway JSON error:', error);
      throw new Error('AI request failed');
    }
  }
}
