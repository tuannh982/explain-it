import { appendFileSync, mkdirSync } from "node:fs";
import { EventEmitter } from "node:events";
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

const logDir = "logs";
const logFile = `${logDir}/debug.log`;

// Ensure log directory exists on startup
try {
	mkdirSync(logDir, { recursive: true });
} catch {
	// Directory may already exist
}

function formatLog(level: string, message: string, args: unknown[]): string {
	const timestamp = new Date().toISOString();
	const argsStr = args.length > 0 ? " " + args.map((a) => JSON.stringify(a)).join(" ") : "";
	return `[${timestamp}] [${level}] ${message}${argsStr}`;
}

function writeToFile(formatted: string): void {
	try {
		appendFileSync(logFile, formatted + "\n");
	} catch {
		// Silently fail file writes to avoid breaking the app
	}
}

export const logger = {
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
