import { LLMClient } from '../llm/client.js';
import { PromptManager } from '../prompt/prompt-manager.js';
import { ClaudeClient } from '../llm/claude-client.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/config.js';

export abstract class BaseAgent {
    protected llm: LLMClient;
    protected prompts: PromptManager;
    protected configKey: string;

    constructor() {
        this.llm = new ClaudeClient();
        this.prompts = new PromptManager('claude');
        // Map ClarifierAgent -> clarifier, etc.
        this.configKey = this.constructor.name.replace('Agent', '').toLowerCase();
    }

    protected async executeLLM<T>(templateName: string, context: Record<string, any>, options?: { maxTokens?: number, useSearch?: boolean }): Promise<T> {
        const { system, user } = await this.prompts.loadTemplate(templateName, context);
        logger.debug(`[${this.constructor.name}] executing prompt: ${templateName}`);
        logger.debug(`[${this.constructor.name}] System Prompt: ${system}`);
        logger.debug(`[${this.constructor.name}] User Prompt: ${user}`);


        // Get agent specific config if available
        const agentConfig = (config.llm.agents as any)[this.configKey] || {};

        const response = await this.llm.advance([
            { role: 'system', content: system },
            { role: 'user', content: user }
        ], {
            model: agentConfig.model,
            temperature: agentConfig.temperature,
            maxTokens: options?.maxTokens || 8192,
            useSearch: options?.useSearch
        });

        if (response.thinking) {
            logger.debug(`[${this.constructor.name}] Thinking block detected and parsed.`);
            // Optionally log a preview of thinking
            // logger.debug(`[${this.constructor.name}] Thinking preview: ${response.thinking.substring(0, 100)}...`);
        }

        const content = response.content;
        logger.debug(`[${this.constructor.name}] Raw Content: ${content}`);


        try {
            // Extract JSON if model included text wrap
            const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            const cleanJson = jsonMatch ? jsonMatch[0] : content;
            return JSON.parse(cleanJson.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')) as T;
        } catch (error: any) {
            logger.error(`[${this.constructor.name}] JSON Parse Error:`, error.message);
            logger.error(`[${this.constructor.name}] Raw Response content follows:\n${content}`);

            if (response.thinking) {
                logger.debug(`[${this.constructor.name}] Thinking associated with failed JSON:`, response.thinking);
            }
            throw new Error(`Agent ${this.constructor.name} failed to parse LLM response. Error: ${error.message}. Raw prefix: ${content.substring(0, 500)}`);
        }
    }

    abstract execute(input: any): Promise<any>;
}
