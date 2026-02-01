import { config } from "../../config/config.js";
import { logger } from "../../utils/logger.js";
import { ChatRetryHandler } from "../llm/chat-retry-handler.js";
import { ClaudeClient } from "../llm/claude-client.js";
import type { ChatResponse, LLMClient, Message } from "../llm/client.js";
import { ResponseParser } from "../llm/response-parser.js";
import { TemplateRenderer } from "../llm/template-renderer.js";

export abstract class BaseAgent {
	protected llm: LLMClient;
	protected templateRenderer: TemplateRenderer;
	protected responseParser: ResponseParser;
	protected retryHandler: ChatRetryHandler;
	protected configKey: string;

	constructor() {
		this.llm = new ClaudeClient();
		this.templateRenderer = new TemplateRenderer("claude");
		this.responseParser = new ResponseParser();
		this.retryHandler = new ChatRetryHandler();
		// Map ClarifierAgent -> clarifier, etc.
		this.configKey = this.constructor.name.replace("Agent", "").toLowerCase();
	}

	/**
	 * Executes an LLM call with a conversation (array of messages).
	 * Returns the raw ChatResponse without parsing.
	 */
	protected async executeLLM(
		conversation: Message[],
		options?: { maxTokens?: number; useSearch?: boolean },
	): Promise<ChatResponse> {
		logger.debug(
			`[${this.constructor.name}] executing LLM with ${conversation.length} messages`,
		);

		// Get agent specific config if available
		// Get agent specific config if available
		// biome-ignore lint/suspicious/noExplicitAny: config structure is dynamic
		const agentConfig = (config.llm.agents as any)[this.configKey] || {};

		const response = await this.llm.advance(conversation, {
			model: agentConfig.model,
			temperature: agentConfig.temperature,
			maxTokens: options?.maxTokens || 8192,
			useSearch: options?.useSearch,
		});

		if (response.thinking) {
			logger.debug(
				`[${this.constructor.name}] Thinking block detected and parsed.`,
			);
		}

		logger.debug(`[${this.constructor.name}] Raw Content: ${response.content}`);

		return response;
	}

	/**
	 * Executes an LLM call with a conversation and parses the response.
	 */
	protected async executeConversation<T>(
		conversation: Message[],
		templateName: string = "unknown",
		options?: { maxTokens?: number; useSearch?: boolean },
	): Promise<T> {
		return this.retryHandler.executeWithRetry(
			async () => {
				const response = await this.executeLLM(conversation, options);
				return this.responseParser.parseJSON<T>(response.content);
			},
			{},
			{ agentName: this.constructor.name, templateName },
		);
	}

	/**
	 * Convenience method that renders a template, calls the LLM with retry,
	 * and parses the JSON response.
	 */
	protected async executeLLMWithTemplate<T>(
		templateName: string,
		context: Record<string, unknown>,
		options?: { maxTokens?: number; useSearch?: boolean },
	): Promise<T> {
		logger.debug(
			`[${this.constructor.name}] executing prompt: ${templateName}`,
		);

		// 1. Render template parts
		const { system, user } = await this.templateRenderer.renderParts(
			templateName,
			context,
		);

		// 2. Construct base conversation
		const conversation: Message[] = [
			{ role: "system", content: system },
			{ role: "user", content: user },
		];

		logger.debug(
			`[${this.constructor.name}] System Prompt: ${conversation[0]?.content}`,
		);
		logger.debug(
			`[${this.constructor.name}] User Prompt: ${conversation[1]?.content}`,
		);

		// 3. Execute with retry
		return this.executeConversation<T>(conversation, templateName, options);
	}

	// biome-ignore lint/suspicious/noExplicitAny: generic base class
	abstract execute(input: any): Promise<any>;
}
