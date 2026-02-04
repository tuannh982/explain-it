// test/core/session-manager.test.ts

import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "../../src/core/session-manager.js";

describe("SessionManager", () => {
	let testDir: string;
	let sessionsFile: string;
	let manager: SessionManager;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `explain-it-test-${Date.now()}`);
		sessionsFile = path.join(testDir, "sessions.json");
		await fs.ensureDir(testDir);
		manager = new SessionManager(sessionsFile, testDir);
	});

	afterEach(async () => {
		await fs.remove(testDir);
	});

	describe("createSession", () => {
		it("creates a new session with correct folder structure", async () => {
			const session = await manager.createSession("React Hooks", "beginner", 2);

			expect(session.id).toBeDefined();
			expect(session.topic).toBe("React Hooks");
			expect(session.folderName).toBe("react_hooks");
			expect(session.status).toBe("running");
			expect(await fs.pathExists(session.folderPath)).toBe(true);
		});

		it("handles duplicate folder names by appending suffix", async () => {
			const s1 = await manager.createSession("React Hooks", "beginner", 2);
			const s2 = await manager.createSession("React Hooks", "beginner", 2);

			expect(s1.folderName).toBe("react_hooks");
			expect(s2.folderName).toBe("react_hooks_2");
		});
	});

	describe("getSession", () => {
		it("retrieves session by id", async () => {
			const created = await manager.createSession("Test", "beginner", 1);
			const retrieved = manager.getSession(created.id);

			expect(retrieved).toEqual(created);
		});

		it("returns undefined for unknown id", () => {
			expect(manager.getSession("unknown")).toBeUndefined();
		});
	});

	describe("updateSession", () => {
		it("updates session status and returns true", async () => {
			const session = await manager.createSession("Test", "beginner", 1);
			const result = await manager.updateSession(session.id, {
				status: "completed",
			});

			expect(result).toBe(true);
			const updated = manager.getSession(session.id);
			expect(updated?.status).toBe("completed");
		});

		it("returns false when updating non-existent session", async () => {
			const result = await manager.updateSession("non-existent-id", {
				status: "completed",
			});
			expect(result).toBe(false);
		});
	});

	describe("deleteSession", () => {
		it("removes session from list", async () => {
			const session = await manager.createSession("Test", "beginner", 1);
			expect(manager.listSessions()).toHaveLength(1);

			await manager.deleteSession(session.id);
			expect(manager.listSessions()).toHaveLength(0);
			expect(manager.getSession(session.id)).toBeUndefined();
		});

		it("persists deletion to file", async () => {
			const session = await manager.createSession("Test", "beginner", 1);
			await manager.deleteSession(session.id);

			const newManager = new SessionManager(sessionsFile, testDir);
			await newManager.load();
			expect(newManager.listSessions()).toHaveLength(0);
		});

		it("handles deleting non-existent session gracefully", async () => {
			await manager.createSession("Test", "beginner", 1);
			expect(manager.listSessions()).toHaveLength(1);

			// Should not throw and should not affect existing sessions
			await manager.deleteSession("non-existent-id");
			expect(manager.listSessions()).toHaveLength(1);
		});
	});

	describe("getActiveSessions / getArchivedSessions", () => {
		it("filters sessions by status", async () => {
			const s1 = await manager.createSession("Active", "beginner", 1);
			const s2 = await manager.createSession("Done", "beginner", 1);
			await manager.updateSession(s2.id, { status: "completed" });

			expect(manager.getActiveSessions()).toHaveLength(1);
			expect(manager.getActiveSessions()[0].id).toBe(s1.id);
			expect(manager.getArchivedSessions()).toHaveLength(1);
			expect(manager.getArchivedSessions()[0].id).toBe(s2.id);
		});
	});

	describe("persistence", () => {
		it("persists sessions to file", async () => {
			await manager.createSession("Test", "beginner", 1);

			const data = await fs.readJSON(sessionsFile);
			expect(data.sessions).toHaveLength(1);
		});

		it("loads sessions on init", async () => {
			await manager.createSession("Test", "beginner", 1);

			const newManager = new SessionManager(sessionsFile, testDir);
			await newManager.load();

			expect(newManager.listSessions()).toHaveLength(1);
		});
	});
});
