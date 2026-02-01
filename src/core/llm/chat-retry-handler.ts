import path from "node:path";
import fs from "fs-extra";
import { config } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

export interface RetryOptions {
	maxRetries: number;
	backoffMs: number;
	logFile: string;
}

export interface FailureLogEntry {
	timestamp: string;
	agentName: string;
	templateName?: string;
	attempt: number;
	errorType: string;
	errorMessage: string;
	rawContentPreview?: string;
}

/**
 * Handles retry logic for LLM calls with exponential backoff.
 * Logs failures to a file for debugging and monitoring.
 */
export class ChatRetryHandler {
	private defaultOptions: RetryOptions;

	constructor() {
		this.defaultOptions = {
			maxRetries: config.retry?.maxRetries ?? 3,
			backoffMs: config.retry?.backoffMs ?? 1000,
			logFile: config.retry?.logFile ?? "output/logs/llm-failures.jsonl",
		};
	}

	/**
	 * Executes a function with retry logic.
	 * @param fn The async function to execute
	 * @param options Retry options (uses defaults if not provided)
	 * @param context Context for logging (agent name, template)
	 */
	async executeWithRetry<T>(
		fn: () => Promise<T>,
		options: Partial<RetryOptions> = {},
		context: { agentName: string; templateName?: string },
	): Promise<T> {
		const opts = { ...this.defaultOptions, ...options };
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
			try {
				return await fn();
			} catch (error: unknown) {
				const err = error instanceof Error ? error : new Error(String(error));
				lastError = err;

				logger.warn(
					`[${context.agentName}] Attempt ${attempt}/${opts.maxRetries} failed: ${err.message}`,
				);

				await this.logFailure(
					{
						timestamp: new Date().toISOString(),
						agentName: context.agentName,
						templateName: context.templateName,
						attempt,
						errorType: err.name || "Error",
						errorMessage: err.message,
						rawContentPreview: (
							err as Error & { rawContent?: string }
						).rawContent?.substring(0, 500),
					},
					opts.logFile,
				);

				if (attempt < opts.maxRetries) {
					const delay = opts.backoffMs * 2 ** (attempt - 1);
					logger.debug(`[${context.agentName}] Retrying in ${delay}ms...`);
					await this.sleep(delay);
				}
			}
		}

		throw new Error(
			`[${context.agentName}] Failed after ${opts.maxRetries} attempts. Last error: ${lastError?.message}`,
		);
	}

	private async logFailure(
		entry: FailureLogEntry,
		logFile: string,
	): Promise<void> {
		try {
			const logPath = path.isAbsolute(logFile)
				? logFile
				: path.join(config.paths.output, "..", logFile);

			await fs.ensureDir(path.dirname(logPath));
			await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`);
		} catch (err) {
			// Don't let logging errors break the main flow
			logger.error(`[ChatRetryHandler] Failed to write failure log: ${err}`);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
