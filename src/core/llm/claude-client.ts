import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config/config.js";
import { logger } from "../../utils/logger.js";
import type {
	ChatResponse,
	CompletionOptions,
	LLMClient,
	Message,
} from "./client.js";

export class ClaudeClient implements LLMClient {
	private client: Anthropic;

	constructor() {
		if (!config.llm.providers.claude.apiKey) {
			throw new Error(
				"Claude API Key is missing. Please check your .env file.",
			);
		}
		this.client = new Anthropic({
			apiKey: config.llm.providers.claude.apiKey,
		});
	}

	async complete(prompt: string, options?: CompletionOptions): Promise<string> {
		const response = await this.advance(
			[{ role: "user", content: prompt }],
			options,
		);
		return response.content;
	}

	async completeJSON<T>(
		prompt: string,
		options?: CompletionOptions,
	): Promise<T> {
		const responseText = await this.complete(prompt, options);

		try {
			const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
			const cleanJson = jsonMatch ? jsonMatch[0] : responseText;
			return JSON.parse(cleanJson) as T;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.error(`Claude JSON Parse Error: ${errorMessage}`);
			throw error;
		}
	}

	async advance(
		messages: Message[],
		options?: CompletionOptions,
	): Promise<ChatResponse> {
		const model = options?.model || config.llm.defaults.model;
		const maxTokens = options?.maxTokens || config.llm.defaults.maxTokens;
		const temperature = options?.temperature || config.llm.defaults.temperature;

		// Separate system messages
		const systemMessage =
			messages.find((m) => m.role === "system")?.content || options?.system;
		const chatMessages = messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role,
				content:
					typeof m.content === "string"
						? [{ type: "text", text: m.content }]
						: m.content, // Assume compatible format if not string
			}));

		// Prepare tools if requested
		// biome-ignore lint/suspicious/noExplicitAny: dependent on SDK types
		const tools: any[] = [];
		if (options?.useSearch) {
			tools.push({
				type: "web_search_20250305",
				name: "web_search",
			});
		}

		let loopCount = 0;
		const MAX_LOOPS = 5;

		try {
			while (loopCount < MAX_LOOPS) {
				logger.debug(`Calling Claude (${model}) - Loop ${loopCount + 1}...`);
				const response = await this.client.messages.create({
					model,
					max_tokens: maxTokens,
					temperature,
					system: systemMessage,
					messages: chatMessages as any,
					tools: tools.length > 0 ? tools : undefined,
				});

				// Add Claude's message to context for next potential turn
				chatMessages.push({
					role: "assistant",
					content: response.content as any,
				});

				const toolUseBlocks = response.content.filter(
					(b) => b.type === "tool_use",
				);

				if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
					// Final response
					let fullContent = "";
					let thinking: string | undefined;

					for (const block of response.content) {
						if (block.type === "text") {
							fullContent += block.text;
						} else if (block.type === "thinking") {
							thinking = (thinking || "") + block.thinking;
						}
					}

					let content = fullContent;
					if (!thinking) {
						const thinkingMatch = fullContent.match(
							/<thinking>([\s\S]*?)<\/thinking>/,
						);
						if (thinkingMatch) {
							thinking = thinkingMatch[1].trim();
							content = fullContent
								.replace(/<thinking>[\s\S]*?<\/thinking>/, "")
								.trim();
						}
					}

					return {
						content,
						thinking,
						usage: {
							promptTokens: response.usage.input_tokens,
							completionTokens: response.usage.output_tokens,
							totalTokens:
								response.usage.input_tokens + response.usage.output_tokens,
						},
						raw: response,
					};
				}

				// Handle tool use
				// biome-ignore lint/suspicious/noExplicitAny: dependent on SDK types
				const toolResults: any[] = [];
				for (const toolUse of toolUseBlocks) {
					if (toolUse.type !== "tool_use") continue;

					if (toolUse.name === "web_search") {
						logger.debug(
							`[ClaudeClient] Claude used web_search: ${JSON.stringify(toolUse.input)}`,
						);
						// The built-in tool often handles it, but if it's a client tool 20250305,
						// we must provide a result.
						toolResults.push({
							type: "tool_result",
							tool_use_id: toolUse.id,
							content: "Search completed. Results are ready for synthesis.",
						});
					}
				}

				if (toolResults.length > 0) {
					chatMessages.push({
						role: "user",
						content: toolResults as any,
					});
					loopCount++;
				} else {
					break;
				}
			}

			throw new Error(
				`Exceeded MAX_LOOPS (${MAX_LOOPS}) in ClaudeClient tool loop.`,
			);
		} catch (error: unknown) {
			logger.error("Claude API Error:", error);
			throw error;
		}
	}
}
