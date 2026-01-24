import { BaseAgent } from '../core/agent/base-agent.js';
import { Decomposition, ScoutReport } from '../core/types.js';

export class DecomposerAgent extends BaseAgent {
    async execute(input: {
        topic: string,
        depthLevel: number,
        scoutReport: ScoutReport,
        parentConcepts?: string[]
    }): Promise<Decomposition> {
        // Reduced context to prevent repetitive decomposition of parent concepts
        const scoutContext = `Parent Context (Category): ${input.scoutReport.category}.${input.parentConcepts ? ` Already covered/Parent concepts: ${input.parentConcepts.join(', ')}.` : ''}`;

        const result = await this.executeLLMWithTemplate<Decomposition>('decomposer', {
            topic: input.topic,
            depthLevel: input.depthLevel,
            scoutContext: scoutContext
        }, { useSearch: true });

        console.log(`[Decomposer] Decomposed "${input.topic}" into ${result.concepts.length} concepts: ${result.concepts.map(c => c.name).join(', ')}`);

        return result;
    }
}
