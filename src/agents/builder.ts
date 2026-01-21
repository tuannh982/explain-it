import { BaseAgent } from '../core/agent/base-agent';
import { Explanation, BuilderOutput } from '../core/types';

export class BuilderAgent extends BaseAgent {
    async execute(input: { explanations: Explanation[], depthLevel: number }): Promise<BuilderOutput> {
        // Simplify explanations to save context window
        const simplifiedExplanations = input.explanations.map(e => ({
            name: e.conceptName,
            code: e.codeExample,
            why: e.whyExists
        }));

        return this.executeLLM<BuilderOutput>('builder', {
            explanationsJson: JSON.stringify(simplifiedExplanations, null, 2),
            depthLevel: input.depthLevel
        });
    }
}
