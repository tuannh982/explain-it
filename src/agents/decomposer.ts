import { BaseAgent } from "../core/agent/base-agent.js";
import type { Decomposition, ScoutReport } from "../core/types.js";

export class DecomposerAgent extends BaseAgent {
	async execute(input: {
		topic: string;
		depthLevel: number;
		scoutReport: ScoutReport;
		parentConcepts?: string[];
		rootTopic?: string;
		alreadyExplored?: string[];
	}): Promise<Decomposition> {
		// Reduced context up to some limit to prevent repetitive decomposition
		const scoutContext = `Parent Context (Category): ${input.scoutReport.category}.${input.parentConcepts ? ` Already covered/Parent concepts: ${input.parentConcepts.join(", ")}.` : ""}${input.alreadyExplored && input.alreadyExplored.length > 0 ? ` Concepts already explored in other branches (DO NOT REPEAT): ${input.alreadyExplored.join(", ")}.` : ""}`;

		const result = await this.executeLLMWithTemplate<Decomposition>(
			"decomposer",
			{
				topic: input.topic,
				rootTopic: input.rootTopic || input.parentConcepts?.[0] || input.topic,
				depthLevel: input.depthLevel,
				scoutContext: scoutContext,
			},
			{ useSearch: true },
		);

		console.log(
			`[Decomposer] Decomposed "${input.topic}" into ${result.concepts.length} concepts: ${result.concepts.map((c) => c.name).join(", ")}`,
		);

		return result;
	}
}
