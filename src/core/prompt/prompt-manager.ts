import path from 'path';
import { config } from '../../config/config.js';
import { logger } from '../../utils/logger.js';
import { TemplateManager } from '../../generator/template-manager.js';

export interface PromptTemplate {
    system: string;
    user: string;
}

export class PromptManager {
    private provider: string;
    private templateManager: TemplateManager;

    constructor(provider: string = 'claude') {
        this.provider = provider;
        this.templateManager = new TemplateManager(config.paths.root);
    }

    async loadTemplate(templateName: string, variables: Record<string, any> = {}): Promise<PromptTemplate> {
        try {
            // TemplateManager root is src/templates
            // Prompts are in src/templates/prompts/{provider}/{templateName}.md
            const relativePath = path.join('prompts', this.provider, `${templateName}.md`);

            const fullPrompt = await this.templateManager.render(relativePath, variables);

            const [system, user] = fullPrompt.split('---').map(part => part.trim());

            return {
                system: system || '',
                user: user || system || '', // Fallback if no delimiter
            };
        } catch (error) {
            logger.error(`Failed to load prompt template: ${templateName}`, error);
            throw new Error(`Prompt template '${templateName}' not found for provider '${this.provider}'`);
        }
    }
}
