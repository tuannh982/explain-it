import path from "node:path";
import fs from "fs-extra";
import { config } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

export interface RetryOptions {
	backoffMs: number;
	maxBackoffMs: number;
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
			backoffMs: config.retry?.backoffMs ?? 1000,
			maxBackoffMs: config.retry?.maxBackoffMs ?? 60000,
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
		let attempt = 0;

		while (true) {
			attempt++;
			try {
				return await fn();
			} catch (error: unknown) {
				const err = error instanceof Error ? error : new Error(String(error));

				logger.warn(
					`[${context.agentName}] Attempt ${attempt} failed: ${err.message}`,
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

				// Exponential backoff capped at maxBackoffMs
				const delay = Math.min(
					opts.backoffMs * 2 ** (attempt - 1),
					opts.maxBackoffMs,
				);
				logger.debug(`[${context.agentName}] Retrying in ${delay}ms...`);
				await this.sleep(delay);
			}
		}
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
