import { BaseAgent } from '../core/agent/base-agent.js';
import { Topic } from '../core/types.js';

interface ClarifierInput {
    userQuery: string;
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
    confirmedTopic: string | null;
}

export class ClarifierAgent extends BaseAgent {
    async execute(input: ClarifierInput): Promise<ClarifierResult> {
        return this.executeLLM<ClarifierResult>('clarifier', {
            userQuery: input.userQuery
        });
    }
}
