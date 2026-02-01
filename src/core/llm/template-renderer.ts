import { PromptManager } from '../prompt/prompt-manager.js';
import { Message } from './client.js';

/**
 * Converts template name + context into a conversation (Message[]).
 * Separates template rendering from LLM execution.
 */
export class TemplateRenderer {
    private prompts: PromptManager;

    constructor(provider: string = 'claude') {
        this.prompts = new PromptManager(provider);
    }

    /**
     * Renders a template with the given context and returns the raw parts.
     */
    async renderParts(templateName: string, context: Record<string, any>): Promise<{ system: string; user: string }> {
        return this.prompts.loadTemplate(templateName, context);
    }

    /**
     * Renders a template with the given context and returns a conversation.
     */
    async render(templateName: string, context: Record<string, any>): Promise<Message[]> {
        const { system, user } = await this.renderParts(templateName, context);

        return [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ];
    }
}
