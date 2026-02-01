import { BaseAgent } from "../core/agent/base-agent.js";
import type { Concept, Explanation } from "../core/types.js";
import { logger } from "../utils/logger.js";

export class ExplainerAgent extends BaseAgent {
	async execute(input: {
		concept: Concept | { name: string; oneLiner?: string };
		depthLevel: number;
		previousConcepts: string[];
	}): Promise<Explanation> {
		const conceptName =
			"name" in input.concept
				? input.concept.name
				: (input.concept as any).name;
		const conceptOneLiner =
			"oneLiner" in input.concept ? input.concept.oneLiner : "";

		logger.info(
			`[Explainer] Explaining concept: "${conceptName}" (Depth: ${input.depthLevel})`,
		);

		const previous =
			input.previousConcepts.length > 0
				? input.previousConcepts.join(", ")
				: "None (First concept)";

		return this.executeLLMWithTemplate<Explanation>(
			"explainer",
			{
				conceptName: conceptName,
				conceptOneLiner: conceptOneLiner,
				depthLevel: input.depthLevel,
				previousConcepts: previous,
			},
			{ useSearch: true },
		);
	}
}
