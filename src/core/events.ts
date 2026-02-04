import { EventEmitter } from "node:events";
import type { ConceptNode } from "./types.js";

// 1. Define specific payloads
export interface PhaseStartPayload {
	phase: string;
}

export interface StepProgressPayload {
	nodeId: string;
	step: string;
	status: "started" | "in-progress" | "completed" | "failed";
	message?: string;
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

// 3. Wrapper payload that includes timestamp and sessionId (for internal use or generic listeners)
export type EventPayload<T extends EventType> = EventMap[T] & {
	timestamp: number;
	sessionId: string;
};

export class EventSystem extends EventEmitter {
	private sessionId: string;

	constructor(sessionId = "default") {
		super();
		this.sessionId = sessionId;
	}

	getSessionId(): string {
		return this.sessionId;
	}

	// Overload for specific events
	emit<T extends EventType>(event: T, payload: EventMap[T]): boolean {
		return super.emit(event, {
			...payload,
			timestamp: Date.now(),
			sessionId: this.sessionId,
		});
	}

	on<T extends EventType>(
		event: T,
		listener: (payload: EventPayload<T>) => void,
	): this {
		// biome-ignore lint/suspicious/noExplicitAny: dependent on base EventEmitter
		return super.on(event, listener as any);
	}

	pipe(target: EventSystem): void {
		const eventTypes: EventType[] = [
			"phase_start",
			"step_progress",
			"node_discovered",
			"node_status_update",
			"request_input",
			"error",
		];

		for (const eventType of eventTypes) {
			this.on(eventType, (payload) => {
				// Forward the event with original payload (preserves source sessionId)
				// biome-ignore lint/suspicious/noExplicitAny: payload type varies by event
				super.emit.call(target, eventType, payload as any);
			});
		}
	}
}
