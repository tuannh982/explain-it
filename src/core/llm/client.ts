export interface CompletionOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
	system?: string;
	stop?: string[];
	useSearch?: boolean;
}

export interface Message {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface ChatResponse {
	content: string;
	thinking?: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	raw?: unknown;
}

export interface LLMClient {
	complete(prompt: string, options?: CompletionOptions): Promise<string>;
	completeJSON<T>(prompt: string, options?: CompletionOptions): Promise<T>;
	advance(
		messages: Message[],
		options?: CompletionOptions,
	): Promise<ChatResponse>;
}
