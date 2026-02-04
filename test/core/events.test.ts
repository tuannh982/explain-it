import { describe, expect, it, vi } from "vitest";
import { EventSystem } from "../../src/core/events.js";

describe("EventSystem", () => {
	it("includes sessionId in emitted events", () => {
		const events = new EventSystem("session-123");
		const handler = vi.fn();

		events.on("phase_start", handler);
		events.emit("phase_start", { phase: "decompose" });

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "session-123",
				phase: "decompose",
				timestamp: expect.any(Number),
			}),
		);
	});

	it("uses default sessionId when not provided", () => {
		const events = new EventSystem();
		const handler = vi.fn();

		events.on("phase_start", handler);
		events.emit("phase_start", { phase: "scout" });

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "default",
			}),
		);
	});

	it("getSessionId returns the session id", () => {
		const events = new EventSystem("my-session");
		expect(events.getSessionId()).toBe("my-session");
	});

	it("pipe forwards events to another EventSystem", () => {
		const source = new EventSystem("source-session");
		const target = new EventSystem("target-session");
		const handler = vi.fn();

		source.pipe(target);
		target.on("phase_start", handler);

		source.emit("phase_start", { phase: "decompose" });

		// Should receive event with source's sessionId
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "source-session",
				phase: "decompose",
			}),
		);
	});
});
