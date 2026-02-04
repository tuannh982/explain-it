// src/core/session-manager.ts

import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "fs-extra";
import { toSnakeCase } from "../utils/slug.js";
import type { Session, SessionRegistry } from "./session-types.js";
import type { WorkflowState } from "./state.js";
import type { ConceptNode } from "./types.js";

export interface ResumeData {
	nodes: Array<{
		id: string;
		name: string;
		status: ConceptNode["status"];
		parentId?: string;
	}>;
	logs: string[];
	state: WorkflowState | null;
}

const REGISTRY_VERSION = 1;

export class SessionManager {
	private sessions: Map<string, Session> = new Map();
	private sessionsFile: string;
	private projectRoot: string;

	constructor(sessionsFile: string, projectRoot: string) {
		this.sessionsFile = sessionsFile;
		this.projectRoot = projectRoot;
	}

	async load(): Promise<void> {
		if (await fs.pathExists(this.sessionsFile)) {
			try {
				const data: SessionRegistry = await fs.readJSON(this.sessionsFile);
				if (data.version !== REGISTRY_VERSION) {
					console.warn(
						`Session registry version mismatch: expected ${REGISTRY_VERSION}, got ${data.version}. Loading anyway for backwards compatibility.`,
					);
				}
				this.sessions = new Map(data.sessions.map((s) => [s.id, s]));
			} catch (error) {
				console.warn(
					`Failed to parse sessions file, starting with empty registry: ${error instanceof Error ? error.message : String(error)}`,
				);
				this.sessions = new Map();
			}
		}
	}

	private async save(): Promise<void> {
		await fs.ensureDir(path.dirname(this.sessionsFile));
		const registry: SessionRegistry = {
			version: REGISTRY_VERSION,
			sessions: Array.from(this.sessions.values()),
		};
		await fs.writeJSON(this.sessionsFile, registry, { spaces: 2 });
	}

	async createSession(
		topic: string,
		persona: string,
		depth: number,
	): Promise<Session> {
		const id = randomUUID();
		const baseFolderName = toSnakeCase(topic);
		const folderName = this.getUniqueFolderName(baseFolderName);
		const folderPath = path.join(this.projectRoot, folderName);

		await fs.ensureDir(folderPath);

		const session: Session = {
			id,
			topic,
			folderName,
			folderPath,
			status: "running",
			createdAt: new Date().toISOString(),
			persona,
			depth,
		};

		this.sessions.set(id, session);
		await this.save();
		return session;
	}

	private getUniqueFolderName(baseName: string): string {
		const existingNames = new Set(
			Array.from(this.sessions.values()).map((s) => s.folderName),
		);

		if (!existingNames.has(baseName)) {
			return baseName;
		}

		let counter = 2;
		while (existingNames.has(`${baseName}_${counter}`)) {
			counter++;
		}
		return `${baseName}_${counter}`;
	}

	getSession(id: string): Session | undefined {
		return this.sessions.get(id);
	}

	listSessions(): Session[] {
		return Array.from(this.sessions.values());
	}

	getActiveSessions(): Session[] {
		return this.listSessions().filter(
			(s) => s.status === "running" || s.status === "interrupted",
		);
	}

	getArchivedSessions(): Session[] {
		return this.listSessions().filter(
			(s) => s.status === "completed" || s.status === "failed",
		);
	}

	async updateSession(id: string, updates: Partial<Session>): Promise<boolean> {
		const session = this.sessions.get(id);
		if (session) {
			Object.assign(session, updates);
			await this.save();
			return true;
		}
		return false;
	}

	async deleteSession(id: string): Promise<void> {
		this.sessions.delete(id);
		await this.save();
	}

	async loadResumeData(session: Session): Promise<ResumeData> {
		const stateFile = path.join(session.folderPath, "state.json");
		const logFile = path.join(session.folderPath, "debug.log");

		let state: WorkflowState | null = null;
		const nodes: ResumeData["nodes"] = [];
		let logs: string[] = [];

		// Load state.json
		if (await fs.pathExists(stateFile)) {
			try {
				state = await fs.readJSON(stateFile);

				// Build nodes from explanations - root node first
				if (state?.topic) {
					nodes.push({
						id: "root",
						name: state.topic.confirmedTopic || session.topic,
						status: "done",
					});
				}

				// Add explained concepts as child nodes
				if (state?.explanations) {
					for (const [name, explanation] of Object.entries(
						state.explanations,
					)) {
						// Skip root topic
						if (name === session.topic) continue;

						nodes.push({
							id: name.toLowerCase().replace(/\s+/g, "-"),
							name: explanation.conceptName || name,
							status: "done",
							parentId: "root", // Simplified - all children of root
						});
					}
				}
			} catch {
				// Ignore parse errors
			}
		}

		// Load debug.log
		if (await fs.pathExists(logFile)) {
			try {
				const content = await fs.readFile(logFile, "utf-8");
				logs = content.split("\n").filter((line) => line.trim());
			} catch {
				// Ignore read errors
			}
		}

		return { nodes, logs, state };
	}
}
