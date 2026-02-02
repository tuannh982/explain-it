import { EventEmitter } from "node:events";
import type { ConceptNode } from "./types.js";

// 1. Define specific payloads
export interface PhaseStartPayload {
	phase: string;
}

export interface StepProgressPayload {
	message: string;
}

export interface NodeDiscoveredPayload {
	node: ConceptNode;
	parentId?: string;
}

export interface NodeStatusUpdatePayload {
	nodeId: string;
	status: ConceptNode["status"];
}

export interface RequestInputPayload {
	question: string;
	options?: string[];
	context?: {
		topic: string;
		requirements: Record<string, string>;
		suggestions: { approach: string; reason: string }[];
	};
}

export interface ErrorPayload {
	message: string;
}

// 2. Map event names to payloads
export interface EventMap {
	phase_start: PhaseStartPayload;
	step_progress: StepProgressPayload;
	node_discovered: NodeDiscoveredPayload;
	node_status_update: NodeStatusUpdatePayload;
	request_input: RequestInputPayload;
	error: ErrorPayload;
}

export type EventType = keyof EventMap;

// 3. Wrapper payload that includes timestamp (for internal use or generic listeners)
export type EventPayload<T extends EventType> = EventMap[T] & {
	timestamp: number;
};

export class EventSystem extends EventEmitter {
	// Overload for specific events
	emit<T extends EventType>(event: T, payload: EventMap[T]): boolean {
		return super.emit(event, { ...payload, timestamp: Date.now() });
	}

	on<T extends EventType>(
		event: T,
		listener: (payload: EventMap[T] & { timestamp: number }) => void,
	): this {
		// biome-ignore lint/suspicious/noExplicitAny: dependent on base EventEmitter
		return super.on(event, listener as any);
	}
}
