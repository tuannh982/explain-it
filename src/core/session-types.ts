// src/core/session-types.ts
import type { WorkflowPhase } from "./state.js";

export type SessionStatus = "running" | "completed" | "failed" | "interrupted";

export interface SessionProgress {
	phase: WorkflowPhase;
	completedNodes: string[];
	totalNodes: number;
}

export interface Session {
	id: string;
	topic: string;
	folderName: string;
	folderPath: string;
	status: SessionStatus;
	createdAt: string; // ISO string for JSON serialization
	completedAt?: string;
	error?: string;
	progress?: SessionProgress;
	persona: string;
	depth: number;
}

export interface SessionRegistry {
	version: number;
	sessions: Session[];
}
