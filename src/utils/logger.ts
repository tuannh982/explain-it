import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = levels[env.LOG_LEVEL as LogLevel];

export const logger = {
    debug: (message: string, ...args: any[]) => {
        if (levels.debug >= currentLevel) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
    info: (message: string, ...args: any[]) => {
        if (levels.info >= currentLevel) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    warn: (message: string, ...args: any[]) => {
        if (levels.warn >= currentLevel) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    error: (message: string, ...args: any[]) => {
        if (levels.error >= currentLevel) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
};
