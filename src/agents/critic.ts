import { BaseAgent } from "../core/agent/base-agent.js";
import type { Critique, Explanation } from "../core/types.js";

export class CriticAgent extends BaseAgent {
	async execute(input: {
		explanation: Explanation;
		conceptName: string;
		depthLevel: number;
	}): Promise<Critique> {
		const persona =
			input.depthLevel <= 2 ? "Curious 12-year old" : "Junior Developer";

		return this.executeLLMWithTemplate<Critique>("critic", {
			conceptName: input.conceptName,
			explanationJson: JSON.stringify(input.explanation, null, 2),
			persona: persona,
		});
	}
}
