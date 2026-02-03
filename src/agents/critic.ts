import { BaseAgent } from "../core/agent/base-agent.js";
import type { Critique, Explanation } from "../core/types.js";

export class CriticAgent extends BaseAgent {
	async execute(input: {
		explanation: Explanation;
		conceptName: string;
		depthLevel: number;
		persona: string;
	}): Promise<Critique> {
		return this.executeLLMWithTemplate<Critique>("critic", {
			conceptName: input.conceptName,
			explanationJson: JSON.stringify(input.explanation, null, 2),
			persona: input.persona,
		});
	}
}
