import fs from 'fs-extra';
import path from 'path';
import handlebars from 'handlebars';
import { config } from '../../config/config.js';
import { logger } from '../../utils/logger.js';

export interface PromptTemplate {
    system: string;
    user: string;
}

export class PromptManager {
    private provider: string;

    constructor(provider: string = 'claude') {
        this.provider = provider;
    }

    async loadTemplate(templateName: string, variables: Record<string, any> = {}): Promise<PromptTemplate> {
        const templatePath = path.join(config.paths.prompts, this.provider, `${templateName}.md`);

        try {
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            const compiledTemplate = handlebars.compile(templateContent);
            const fullPrompt = compiledTemplate(variables);

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
