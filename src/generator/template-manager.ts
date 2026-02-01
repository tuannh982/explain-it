import path from "node:path";
import fs from "fs-extra";
import handlebars from "handlebars";
import { logger } from "../utils/logger.js";

export class TemplateManager {
	private templatesDir: string;
	private cache: Map<string, HandlebarsTemplateDelegate> = new Map();

	constructor(rootDir: string) {
		this.templatesDir = path.join(rootDir, "src", "templates");
	}

	async render(
		templateName: string,
		context: Record<string, unknown>,
	): Promise<string> {
		try {
			let template = this.cache.get(templateName);

			if (!template) {
				const templatePath = path.join(this.templatesDir, templateName);
				const content = await fs.readFile(templatePath, "utf-8");
				template = handlebars.compile(content);
				this.cache.set(templateName, template);
			}

			return template(context);
		} catch (error) {
			logger.error(`Error rendering template ${templateName}:`, error);
			throw error;
		}
	}
}
