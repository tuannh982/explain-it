import fs from 'fs-extra';
import path from 'path';
import handlebars from 'handlebars';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export class PromptManager {
    private provider: string;

    constructor(provider: string = 'claude') {
        this.provider = provider;
    }

    async loadTemplate(templateName: string, variables: Record<string, any> = {}): Promise<string> {
        const templatePath = path.join(config.paths.prompts, this.provider, `${templateName}.md`);

        try {
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            const compiledTemplate = handlebars.compile(templateContent);
            return compiledTemplate(variables);
        } catch (error) {
            logger.error(`Failed to load prompt template: ${templateName}`, error);
            throw new Error(`Prompt template '${templateName}' not found for provider '${this.provider}'`);
        }
    }
}
