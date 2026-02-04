import type { ConceptNode } from "./types.js";

// =============================================================================
// Log Topic
// =============================================================================
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntryEvent {
	type: "entry";
	level: LogLevel;
	message: string;
	args?: unknown[];
}

export type LogEvent = LogEntryEvent;

// =============================================================================
// Node Topic
// =============================================================================
export interface NodeDiscoveredEvent {
	type: "discovered";
	node: ConceptNode;
	parentId?: string;
}

export interface NodeStatusUpdateEvent {
	type: "status_update";
	nodeId: string;
	status: ConceptNode["status"];
}

export type NodeEvent = NodeDiscoveredEvent | NodeStatusUpdateEvent;

// =============================================================================
// Workflow Topic
// =============================================================================
export interface PhaseStartEvent {
	type: "phase_start";
	phase: string;
}

export interface StepProgressEvent {
	type: "step_progress";
	nodeId: string;
	step: string;
	status: "started" | "in-progress" | "completed" | "failed";
	message?: string;
}

export type WorkflowEvent = PhaseStartEvent | StepProgressEvent;

// =============================================================================
// Input Topic
// =============================================================================
export interface InputRequestEvent {
	type: "request";
	question: string;
	options?: string[];
	context?: {
		topic: string;
		requirements: Record<string, string>;
		suggestions: { approach: string; reason: string }[];
	};
}

export type InputEvent = InputRequestEvent;

// =============================================================================
// Error Topic
// =============================================================================
export interface ErrorEvent {
	type: "error";
	message: string;
}

// =============================================================================
// Topic Map
// =============================================================================
export interface TopicEventMap {
	log: LogEvent;
	node: NodeEvent;
	workflow: WorkflowEvent;
	input: InputEvent;
	error: ErrorEvent;
}

export type EventTopic = keyof TopicEventMap;

// Wrapper that adds metadata to all events
export type EventPayload<T extends EventTopic> = TopicEventMap[T] & {
	timestamp: number;
	sessionId: string;
};

// Handler type for subscriptions
export type EventHandler<T extends EventTopic> = (
	payload: EventPayload<T>,
) => void;

// =============================================================================
// EventManager Class
// =============================================================================
export class EventManager {
	private sessionId: string;
	private handlers: Map<EventTopic, Set<EventHandler<EventTopic>>>;

	constructor(sessionId: string) {
		this.sessionId = sessionId;
		this.handlers = new Map();

		// Initialize handler sets for all topics
		const topics: EventTopic[] = ["log", "node", "workflow", "input", "error"];
		for (const topic of topics) {
			this.handlers.set(topic, new Set());
		}
	}

	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Publish an event to a topic. All subscribers will receive the event
	 * with timestamp and sessionId automatically injected.
	 */
	publish<T extends EventTopic>(topic: T, event: TopicEventMap[T]): void {
		const handlers = this.handlers.get(topic);
		if (!handlers) return;

		const payload = {
			...event,
			timestamp: Date.now(),
			sessionId: this.sessionId,
		} as EventPayload<T>;

		for (const handler of handlers) {
			try {
				(handler as EventHandler<T>)(payload);
			} catch (err) {
				// Prevent one handler from breaking others
				console.error(`Error in ${topic} event handler:`, err);
			}
		}
	}

	/**
	 * Subscribe to a topic. Returns an unsubscribe function.
	 */
	subscribe<T extends EventTopic>(
		topic: T,
		handler: EventHandler<T>,
	): () => void {
		const handlers = this.handlers.get(topic);
		if (handlers) {
			handlers.add(handler as EventHandler<EventTopic>);
		}

		// Return unsubscribe function
		return () => {
			this.unsubscribe(topic, handler);
		};
	}

	/**
	 * Unsubscribe a handler from a topic.
	 */
	unsubscribe<T extends EventTopic>(topic: T, handler: EventHandler<T>): void {
		const handlers = this.handlers.get(topic);
		if (handlers) {
			handlers.delete(handler as EventHandler<EventTopic>);
		}
	}

	/**
	 * Pipe all events from this EventManager to another EventManager.
	 * Useful for forwarding events between sessions.
	 */
	pipe(target: EventManager): () => void {
		const topics: EventTopic[] = ["log", "node", "workflow", "input", "error"];
		const unsubscribers: (() => void)[] = [];

		for (const topic of topics) {
			const unsub = this.subscribe(topic, (payload) => {
				// Forward with original payload (preserves source sessionId)
				const handlers = target.handlers.get(topic);
				if (handlers) {
					for (const handler of handlers) {
						try {
							handler(payload);
						} catch (err) {
							console.error(`Error in piped ${topic} event handler:`, err);
						}
					}
				}
			});
			unsubscribers.push(unsub);
		}

		// Return function to stop piping
		return () => {
			for (const unsub of unsubscribers) {
				unsub();
			}
		};
	}
}
