import { BaseAgent } from "../core/agent/base-agent.js";
import type { Message } from "../core/llm/client.js";

interface ClarifierInput {
	userQuery: string;
	history?: { question: string; answer: string }[];
}

export interface ClarifierResult {
	originalQuery: string;
	isClear: boolean;
	reasoning: string;
	clarifications: {
		aspect: string;
		question: string;
		options: string[];
	}[];
	suggestedDepth: 1 | 2 | 3 | 4 | 5;
	confirmedTopic: string;
}

export class ClarifierAgent extends BaseAgent {
	async execute(input: ClarifierInput): Promise<ClarifierResult> {
		const conversation: Message[] = [];
		const MAX_HISTORY_TURNS = 10;

		// 1. Render base prompts
		const { system, user } = await this.templateRenderer.renderParts(
			"clarifier",
			{
				userQuery: input.userQuery,
			},
		);

		conversation.push({ role: "system", content: system });

		// 2. Handle History and Compaction
		let finalUserQuery = user;

		if (input.history && input.history.length > 0) {
			if (input.history.length <= MAX_HISTORY_TURNS) {
				// Scenario A: Short history - Construct full conversation
				for (const item of input.history) {
					conversation.push({ role: "assistant", content: item.question });
					conversation.push({ role: "user", content: item.answer });
				}
			} else {
				// Scenario B: Long history - Compact to summary
				// We summarize the history into a text block and prepend to the user query
				const summaryText = input.history
					.map((h, i) => `[Turn ${i + 1}] Q: ${h.question} | A: ${h.answer}`)
					.join("\n");

				const summaryPrefix = `\n\n[Previous Conversation Summary]\n${summaryText}\n[End Summary]\n\n`;
				finalUserQuery = summaryPrefix + user;
			}
		}

		conversation.push({ role: "user", content: finalUserQuery });

		// 3. Execute
		return this.executeConversation<ClarifierResult>(conversation, "clarifier");
	}
}
