import { BaseAgent } from "../core/agent/base-agent.js";
import type { Message } from "../core/llm/client.js";

interface ClarifierInput {
	userQuery: string;
	history?: { question: string; answer: string }[];
	requirements?: ClarifierRequirements;
}

export interface ClarifierRequirements {
	domain?: string;
	focus?: string;
	language?: string;
	audience?: string;
	constraints: Record<string, string>;
	preferences: Record<string, string>;
}

export interface ClarifierSuggestion {
	approach: string;
	reason: string;
	alternatives?: string[];
}

export interface ClarifierResult {
	originalQuery: string;
	isClear: boolean;
	needsConfirmation: boolean;
	reasoning: string;
	clarifications: {
		aspect: string;
		question: string;
		options: string[];
	}[];
	requirements: ClarifierRequirements;
	suggestions: ClarifierSuggestion[];
	confirmedTopic: string;
}

export class ClarifierAgent extends BaseAgent {
	async execute(input: ClarifierInput): Promise<ClarifierResult> {
		const conversation: Message[] = [];
		const MAX_HISTORY_TURNS = 10;

		// Initialize requirements with defaults if not provided
		const requirements: ClarifierRequirements = input.requirements ?? {
			constraints: {},
			preferences: {},
		};

		// 1. Render base prompts
		const { system, user } = await this.templateRenderer.renderParts(
			"clarifier",
			{
				userQuery: input.userQuery,
				requirements: JSON.stringify(requirements, null, 2),
			},
		);

		conversation.push({ role: "system", content: system });

		// 2. Handle History - always use conversation format for context
		if (input.history && input.history.length > 0) {
			const historyToUse = input.history.slice(-MAX_HISTORY_TURNS);
			for (const item of historyToUse) {
				conversation.push({ role: "assistant", content: item.question });
				conversation.push({ role: "user", content: item.answer });
			}
		}

		conversation.push({ role: "user", content: user });

		// 3. Execute with web search enabled
		return this.executeConversation<ClarifierResult>(conversation, "clarifier");
	}
}
