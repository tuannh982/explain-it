import Anthropic from '@anthropic-ai/sdk';
import { LLMClient, CompletionOptions } from './client';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export class ClaudeClient implements LLMClient {
    private client: Anthropic;

    constructor() {
        if (!config.llm.providers.claude.apiKey) {
            throw new Error('Claude API Key is missing. Please check your .env file.');
        }
        this.client = new Anthropic({
            apiKey: config.llm.providers.claude.apiKey,
        });
    }

    async complete(prompt: string, options?: CompletionOptions): Promise<string> {
        const model = options?.model || config.llm.defaults.model;
        const maxTokens = options?.maxTokens || config.llm.defaults.maxTokens;
        const temperature = options?.temperature || config.llm.defaults.temperature;

        logger.debug(`Calling Claude (${model})...`);

        try {
            const response = await this.client.messages.create({
                model,
                max_tokens: maxTokens,
                temperature,
                system: options?.system,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            return text;
        } catch (error: any) {
            logger.error('Claude API Error:', error);
            throw error;
        }
    }

    async completeJSON<T>(prompt: string, options?: CompletionOptions): Promise<T> {
        // Simplified: The prompt now contains the schema and enforcement rules.
        const responseText = await this.complete(prompt, options);

        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            const cleanJson = jsonMatch ? jsonMatch[0] : responseText;
            return JSON.parse(cleanJson) as T;
        } catch (error: any) {
            logger.error('Claude JSON Parse Error:', error.message);
            throw error;
        }
    }
}
