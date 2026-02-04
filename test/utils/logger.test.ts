// test/utils/logger.test.ts

import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionLogger } from "../../src/utils/logger.js";

describe("createSessionLogger", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
		await fs.ensureDir(testDir);
	});

	afterEach(async () => {
		await fs.remove(testDir);
	});

	it("writes logs to session-specific file", async () => {
		const logger = createSessionLogger(testDir);
		logger.info("Test message");

		const logPath = path.join(testDir, "debug.log");
		expect(await fs.pathExists(logPath)).toBe(true);

		const content = await fs.readFile(logPath, "utf-8");
		expect(content).toContain("Test message");
	});

	it("creates separate log files for different sessions", async () => {
		const dir1 = path.join(testDir, "session1");
		const dir2 = path.join(testDir, "session2");
		await fs.ensureDir(dir1);
		await fs.ensureDir(dir2);

		const logger1 = createSessionLogger(dir1);
		const logger2 = createSessionLogger(dir2);

		logger1.info("Message 1");
		logger2.info("Message 2");

		const content1 = await fs.readFile(path.join(dir1, "debug.log"), "utf-8");
		const content2 = await fs.readFile(path.join(dir2, "debug.log"), "utf-8");

		expect(content1).toContain("Message 1");
		expect(content1).not.toContain("Message 2");
		expect(content2).toContain("Message 2");
		expect(content2).not.toContain("Message 1");
	});

	it("supports all log levels", async () => {
		const logger = createSessionLogger(testDir);
		logger.debug("Debug message");
		logger.info("Info message");
		logger.warn("Warn message");
		logger.error("Error message");

		const logPath = path.join(testDir, "debug.log");
		const content = await fs.readFile(logPath, "utf-8");

		expect(content).toContain("[DEBUG]");
		expect(content).toContain("[INFO]");
		expect(content).toContain("[WARN]");
		expect(content).toContain("[ERROR]");
	});
});
