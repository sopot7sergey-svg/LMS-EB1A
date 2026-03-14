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

export interface AIChatResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
}

export interface AIAvailability {
  available: boolean;
  reason: string;
  keyPrefix?: string;
  model: string;
}

export class AIGateway {
  private client: OpenAI;
  private model: string;

  constructor(options?: { model?: string }) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
    this.model = options?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o';
  }

  static diagnose(options?: { model?: string }): AIAvailability {
    const key = process.env.OPENAI_API_KEY;
    const model = options?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o';
    if (!key) return { available: false, reason: 'OPENAI_API_KEY is not set', model };
    if (key === 'your-openai-api-key') return { available: false, reason: 'OPENAI_API_KEY is placeholder ("your-openai-api-key")', model };
    if (key.length < 20) return { available: false, reason: `OPENAI_API_KEY too short (${key.length} chars)`, model };
    return { available: true, reason: 'configured', keyPrefix: key.slice(0, 8) + '...', model };
  }

  static logStartupDiagnostics(): void {
    const diag = AIGateway.diagnose();
    const tag = '[AI Config]';
    if (!diag.available) {
      console.warn(`${tag} WARNING: AI is NOT available. Reason: ${diag.reason}`);
      console.warn(`${tag} All AI features will use FALLBACK responses.`);
      console.warn(`${tag} To enable AI, set a real OPENAI_API_KEY in apps/api/.env`);
    } else {
      console.log(`${tag} AI is available. Key: ${diag.keyPrefix}, Model: ${diag.model}`);
    }
    if (!process.env.OPENAI_MODEL) {
      console.warn(`${tag} WARNING: OPENAI_MODEL not set. Defaulting to "gpt-4o".`);
    }
  }

  async chat(options: ChatOptions): Promise<string> {
    const result = await this.chatDetailed(options);
    return result.content;
  }

  private buildTokenParam(maxTokens: number): Record<string, number> {
    if (/^gpt-5|^gpt-4\.1|^o[1-9]/i.test(this.model)) {
      return { max_completion_tokens: maxTokens };
    }
    return { max_tokens: maxTokens };
  }

  async chatDetailed(options: ChatOptions): Promise<AIChatResult> {
    const { messages, systemPrompt, temperature = 0.7, maxTokens = 4096 } = options;
    const allMessages: ChatMessage[] = [];
    if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
    allMessages.push(...messages);

    const start = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: allMessages,
        temperature,
        ...this.buildTokenParam(maxTokens),
      } as any);
      const durationMs = Date.now() - start;
      const usage = response.usage;

      return {
        content: response.choices[0]?.message?.content || '',
        model: response.model || this.model,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        durationMs,
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AIGateway] chat failed after ${durationMs}ms: ${errMsg}`);
      throw error;
    }
  }

  async chatWithJSON<T>(options: ChatOptions): Promise<T> {
    const { messages, systemPrompt, temperature = 0.3, maxTokens = 4096 } = options;
    const allMessages: ChatMessage[] = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt + '\n\nRespond with valid JSON only.' });
    }
    allMessages.push(...messages);

    const start = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: allMessages,
        temperature,
        ...this.buildTokenParam(maxTokens),
        response_format: { type: 'json_object' },
      } as any);
      const durationMs = Date.now() - start;
      const usage = response.usage;
      console.log(`[AIGateway] chatWithJSON completed in ${durationMs}ms, model=${response.model}, tokens=${usage?.total_tokens ?? '?'}`);

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content) as T;
    } catch (error: unknown) {
      const durationMs = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AIGateway] chatWithJSON failed after ${durationMs}ms: ${errMsg}`);
      throw error;
    }
  }
}
