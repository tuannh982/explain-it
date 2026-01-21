import { LLMClient } from '../llm/client';
import { PromptManager } from '../prompt/prompt-manager';
import { ClaudeClient } from '../llm/claude-client';
import { logger } from '../../utils/logger';

export abstract class BaseAgent {
    protected llm: LLMClient;
    protected prompts: PromptManager;

    constructor() {
        this.llm = new ClaudeClient();
        this.prompts = new PromptManager('claude');
    }

    protected async executeLLM<T>(templateName: string, context: Record<string, any>, maxTokens: number = 8192): Promise<T> {
        const prompt = await this.prompts.loadTemplate(templateName, context);
        logger.debug(`[${this.constructor.name}] executing prompt: ${templateName}`);

        const response = await this.llm.complete(prompt, { maxTokens });

        try {
            // Extract JSON if model included text wrap
            const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            const cleanJson = jsonMatch ? jsonMatch[0] : response;
            return JSON.parse(cleanJson.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')) as T;
        } catch (error: any) {
            logger.error(`[${this.constructor.name}] JSON Parse Error:`, error.message);
            logger.debug(`[${this.constructor.name}] Raw Response:`, response);
            throw new Error(`Agent ${this.constructor.name} failed to parse LLM response: ${error.message}`);
        }
    }

    abstract execute(input: any): Promise<any>;
}
