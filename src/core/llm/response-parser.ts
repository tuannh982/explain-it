import { logger } from '../../utils/logger.js';

/**
 * Error thrown when JSON parsing fails.
 */
export class ParseError extends Error {
    public readonly rawContent: string;

    constructor(message: string, rawContent: string) {
        super(message);
        this.name = 'ParseError';
        this.rawContent = rawContent;
    }
}

/**
 * Parses JSON from LLM response content.
 * Handles common cases like wrapped JSON in text responses.
 */
export class ResponseParser {
    /**
     * Extracts and parses JSON from content string.
     * Handles cases where JSON is wrapped in text or markdown code blocks.
     * @throws ParseError if JSON extraction or parsing fails
     */
    parseJSON<T>(content: string): T {
        try {
            // Try to find a JSON object or array balance-aware (simplified)
            // First, try to find content between ```json blocks
            const codeBlockMatch = content.match(/```json\s+([\s\S]*?)\s+```/);
            if (codeBlockMatch) {
                return JSON.parse(codeBlockMatch[1]) as T;
            }

            // Fallback: extract the first { } or [ ] block
            const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            const cleanJson = jsonMatch ? jsonMatch[0].trim() : content.trim();

            // Remove control characters that can break JSON parsing
            const sanitized = cleanJson.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');

            return JSON.parse(sanitized) as T;
        } catch (error: any) {
            logger.error(`[ResponseParser] JSON Parse Error: ${error.message}`);
            throw new ParseError(
                `Failed to parse JSON: ${error.message}`,
                content
            );
        }
    }
}
