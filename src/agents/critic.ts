import { BaseAgent } from '../core/agent/base-agent';
import { Explanation, Critique } from '../core/types';

export class CriticAgent extends BaseAgent {
    async execute(input: { explanation: Explanation, conceptName: string, depthLevel: number }): Promise<Critique> {
        const persona = input.depthLevel <= 2 ? 'Curious 12-year old' : 'Junior Developer';

        return this.executeLLM<Critique>('critic', {
            conceptName: input.conceptName,
            explanationJson: JSON.stringify(input.explanation, null, 2),
            persona: persona
        });
    }
}
