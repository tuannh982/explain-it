import { BaseAgent } from "../core/agent/base-agent.js";

interface SimilarityInput {
	candidate: string;
	existing: string[];
}

interface SimilarityResult {
	isSimilar: boolean;
	similarTo: string | null;
	reasoning: string;
}

export class SimilarityAgent extends BaseAgent {
	async execute(input: SimilarityInput): Promise<SimilarityResult> {
		// If no existing concepts, it can't be similar
		if (!input.existing || input.existing.length === 0) {
			return {
				isSimilar: false,
				similarTo: null,
				reasoning: "No existing concepts to compare against.",
			};
		}

		// We join the existing concepts for the prompt
		// Limit to reasonable number if needed, but for now take all
		const existingList = input.existing.map((c) => `- ${c}`).join("\n");

		return this.executeLLMWithTemplate<SimilarityResult>("similarity", {
			candidate: input.candidate,
			existing: existingList,
		});
	}
}
