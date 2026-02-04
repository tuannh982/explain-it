import { EventEmitter } from "node:events";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel = levels[env.LOG_LEVEL as LogLevel];

// Singleton event emitter for log events
export const logEvents = new EventEmitter();

// Logger interface type
export interface Logger {
	debug: (message: string, ...args: unknown[]) => void;
	info: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
}

function formatLog(level: string, message: string, args: unknown[]): string {
	const timestamp = new Date().toISOString();
	const argsStr =
		args.length > 0 ? " " + args.map((a) => JSON.stringify(a)).join(" ") : "";
	return `[${timestamp}] [${level}] ${message}${argsStr}`;
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
 * Internal factory function to create a logger instance that writes to a specific log file.
 */
function createLoggerInstance(logFile: string): Logger {
	const writeToFile = createWriteToFile(logFile);

	return {
		debug: (message: string, ...args: unknown[]) => {
			if (levels.debug >= currentLevel) {
				const formatted = formatLog("DEBUG", message, args);
				writeToFile(formatted);
				logEvents.emit("log", { level: "debug", message, args, formatted });
			}
		},
		info: (message: string, ...args: unknown[]) => {
			if (levels.info >= currentLevel) {
				const formatted = formatLog("INFO", message, args);
				writeToFile(formatted);
				logEvents.emit("log", { level: "info", message, args, formatted });
			}
		},
		warn: (message: string, ...args: unknown[]) => {
			if (levels.warn >= currentLevel) {
				const formatted = formatLog("WARN", message, args);
				writeToFile(formatted);
				logEvents.emit("log", { level: "warn", message, args, formatted });
			}
		},
		error: (message: string, ...args: unknown[]) => {
			if (levels.error >= currentLevel) {
				const formatted = formatLog("ERROR", message, args);
				writeToFile(formatted);
				logEvents.emit("log", { level: "error", message, args, formatted });
			}
		},
	};
}

/**
 * Creates a session-specific logger that writes to {sessionFolder}/debug.log.
 * Each session can have its own isolated log file.
 */
export function createSessionLogger(sessionFolder: string): Logger {
	const logFile = path.join(sessionFolder, "debug.log");
	return createLoggerInstance(logFile);
}

// Default logger setup (backwards compatible)
const logDir = "logs";
const defaultLogFile = `${logDir}/debug.log`;

// Ensure log directory exists on startup
try {
	mkdirSync(logDir, { recursive: true });
} catch {
	// Directory may already exist
}

// Export default logger for backwards compatibility
export const logger = createLoggerInstance(defaultLogFile);
