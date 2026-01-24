import { BaseAgent } from '../core/agent/base-agent.js';
import { Decomposition, ScoutReport } from '../core/types.js';

export interface ValidationIssues {
    type: 'structural' | 'semantic';
    conceptId: string;
    problem: string;
    fix: string;
}

export interface ValidationResult {
    verdict: 'VALID' | 'NEEDS_REDECOMPOSITION';
    scores: {
        structural: number;
        semantic: number;
        overall: number;
    };
    issues: ValidationIssues[];
    recommendation: string;
}

export class ValidatorAgent extends BaseAgent {
    async execute(input: { topic: string, scoutReport: ScoutReport, decomposition: Decomposition }): Promise<ValidationResult> {
        const scoutContext = `Category: ${input.scoutReport.category}. Elevator Pitch: ${input.scoutReport.elevatorPitch}`;

        return this.executeLLMWithTemplate<ValidationResult>('validator', {
            topic: input.topic,
            scoutContext: scoutContext,
            decompositionJson: JSON.stringify(input.decomposition, null, 2)
        });
    }
}
