export interface CompletionOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    system?: string;
    stop?: string[];
}

export interface LLMClient {
    complete(prompt: string, options?: CompletionOptions): Promise<string>;
    completeJSON<T>(prompt: string, options?: CompletionOptions): Promise<T>;
}
