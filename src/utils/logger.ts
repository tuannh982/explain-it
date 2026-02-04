import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { EventManager, LogLevel } from "../core/event-manager.js";
import { env } from "../config/env.js";

const levels: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel = levels[env.LOG_LEVEL as LogLevel] ?? levels.info;

/**
 * Format a log entry for file output.
 */
export function formatLog(
	level: string,
	message: string,
	args?: unknown[],
): string {
	const timestamp = new Date().toISOString();
	const argsStr =
		args && args.length > 0
			? " " + args.map((a) => JSON.stringify(a)).join(" ")
			: "";
	return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
}

/**
 * LoggerSubscriber subscribes to the EventManager's log topic
 * and writes log entries to a file.
 */
export class LoggerSubscriber {
	private unsubscribe: () => void;

	constructor(eventManager: EventManager, logFile: string) {
		// Ensure log directory exists
		const logDir = path.dirname(logFile);
		try {
			mkdirSync(logDir, { recursive: true });
		} catch {
			// Directory may already exist
		}

		// Subscribe to log events
		this.unsubscribe = eventManager.subscribe("log", (event) => {
			if (event.type === "entry") {
				// Check log level
				const eventLevel = levels[event.level];
				if (eventLevel >= currentLevel) {
					const formatted = formatLog(event.level, event.message, event.args);
					try {
						appendFileSync(logFile, formatted + "\n");
					} catch {
						// Silently fail file writes to avoid breaking the app
					}
				}
			}
		});
	}

	/**
	 * Stop listening to log events.
	 */
	dispose(): void {
		this.unsubscribe();
	}
}

/**
 * Creates a LoggerSubscriber for a session that writes to {sessionFolder}/debug.log.
 */
export function createSessionLogger(
	eventManager: EventManager,
	sessionFolder: string,
): LoggerSubscriber {
	const logFile = path.join(sessionFolder, "debug.log");
	return new LoggerSubscriber(eventManager, logFile);
}

// =============================================================================
// Standalone Logger (for components outside EventManager context)
// =============================================================================

export interface Logger {
	debug: (message: string, ...args: unknown[]) => void;
	info: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
}

function createWriteToFile(logFile: string): (formatted: string) => void {
	return (formatted: string): void => {
		try {
			appendFileSync(logFile, formatted + "\n");
		} catch {
			// Silently fail file writes to avoid breaking the app
		}
	};
}

/**
 * Creates a standalone logger that writes directly to a file.
 * Use this for components that don't have access to EventManager.
 */
function createLoggerInstance(logFile: string): Logger {
	const writeToFile = createWriteToFile(logFile);

	return {
		debug: (message: string, ...args: unknown[]) => {
			if (levels.debug >= currentLevel) {
				const formatted = formatLog("debug", message, args);
				writeToFile(formatted);
			}
		},
		info: (message: string, ...args: unknown[]) => {
			if (levels.info >= currentLevel) {
				const formatted = formatLog("info", message, args);
				writeToFile(formatted);
			}
		},
		warn: (message: string, ...args: unknown[]) => {
			if (levels.warn >= currentLevel) {
				const formatted = formatLog("warn", message, args);
				writeToFile(formatted);
			}
		},
		error: (message: string, ...args: unknown[]) => {
			if (levels.error >= currentLevel) {
				const formatted = formatLog("error", message, args);
				writeToFile(formatted);
			}
		},
	};
}

// Default logger for standalone use (writes to logs/debug.log)
const logDir = "logs";
const defaultLogFile = path.join(logDir, "debug.log");

// Ensure log directory exists on startup
try {
	mkdirSync(logDir, { recursive: true });
} catch {
	// Directory may already exist
}

/**
 * Default standalone logger for components without EventManager access.
 * Writes to logs/debug.log.
 */
export const logger = createLoggerInstance(defaultLogFile);
