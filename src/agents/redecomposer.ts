import { BaseAgent } from '../core/agent/base-agent';
import { Decomposition } from '../core/types';
import { ValidationIssues } from './validator';

export interface ReDecompositionResult {
    changes: {
        type: 'SPLIT' | 'MERGE' | 'REORDER' | 'REMOVE' | 'ADD';
        originalConceptId?: string;
        reason: string;
    }[];
    newDecomposition: Decomposition;
    confidence: number;
}

export class ReDecomposerAgent extends BaseAgent {
    async execute(input: { decomposition: Decomposition, issues: ValidationIssues[] }): Promise<ReDecompositionResult> {
        return this.executeLLM<ReDecompositionResult>('redecomposer', {
            decompositionJson: JSON.stringify(input.decomposition, null, 2),
            issuesJson: JSON.stringify(input.issues, null, 2)
        });
    }
}
