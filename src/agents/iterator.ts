import { BaseAgent } from "../core/agent/base-agent.js";
import type { Critique, Explanation } from "../core/types.js";

export interface IterationResult {
	iteration: number;
	fixesApplied: string[];
	revisedExplanation: Explanation;
	selfCheck: {
		allJargonDefined: boolean;
		analogyWorks: boolean;
	};
}

export class IteratorAgent extends BaseAgent {
	async execute(input: {
		explanation: Explanation;
		critique: Critique;
		iteration: number;
	}): Promise<IterationResult> {
		return this.executeLLMWithTemplate<IterationResult>("iterator", {
			originalJson: JSON.stringify(input.explanation, null, 2),
			critiqueJson: JSON.stringify(input.critique, null, 2),
		});
	}
}
