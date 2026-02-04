// test/integration/session-flow.test.ts

import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "../../src/core/session-manager.js";

describe("Session Flow Integration", () => {
	let testDir: string;
	let sessionsFile: string;
	let manager: SessionManager;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `explain-it-integration-${Date.now()}`);
		sessionsFile = path.join(testDir, ".explain-it", "sessions.json");
		await fs.ensureDir(testDir);
		manager = new SessionManager(sessionsFile, testDir);
	});

	afterEach(async () => {
		await fs.remove(testDir);
	});

	it("creates session with correct folder structure", async () => {
		const session = await manager.createSession("React Hooks", "beginner", 2);

		// Verify folder exists
		expect(await fs.pathExists(session.folderPath)).toBe(true);
		expect(session.folderPath).toBe(path.join(testDir, "react_hooks"));

		// Verify session registry
		const registry = await fs.readJSON(sessionsFile);
		expect(registry.sessions).toHaveLength(1);
		expect(registry.sessions[0].folderName).toBe("react_hooks");
	});

	it("handles multiple sessions", async () => {
		const s1 = await manager.createSession("Topic A", "beginner", 1);
		await manager.createSession("Topic B", "beginner", 1);

		expect(manager.getActiveSessions()).toHaveLength(2);

		await manager.updateSession(s1.id, { status: "completed" });

		expect(manager.getActiveSessions()).toHaveLength(1);
		expect(manager.getArchivedSessions()).toHaveLength(1);
	});

	it("persists sessions across manager instances", async () => {
		// Create session with first manager
		const session = await manager.createSession(
			"Persistence Test",
			"expert",
			4,
		);
		const sessionId = session.id;

		// Create new manager instance and load
		const manager2 = new SessionManager(sessionsFile, testDir);
		await manager2.load();

		// Verify session loaded correctly
		const loadedSession = manager2.getSession(sessionId);
		expect(loadedSession).toBeDefined();
		expect(loadedSession?.topic).toBe("Persistence Test");
		expect(loadedSession?.persona).toBe("expert");
		expect(loadedSession?.depth).toBe(4);
	});

	it("handles unique folder names for duplicate topics", async () => {
		const s1 = await manager.createSession("Same Topic", "beginner", 1);
		const s2 = await manager.createSession("Same Topic", "beginner", 1);

		// Both should have different folder names (second should have suffix)
		expect(s1.folderName).not.toBe(s2.folderName);
		expect(await fs.pathExists(s1.folderPath)).toBe(true);
		expect(await fs.pathExists(s2.folderPath)).toBe(true);
	});
});
