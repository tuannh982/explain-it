import { config } from '../config/config';
import { WorkflowState } from './state';
import { logger } from '../utils/logger';

export class CircuitBreaker {
    stats: WorkflowState;

    constructor(state: WorkflowState) {
        this.stats = state;
    }

    checkValidationFailure(): 'CONTINUE' | 'REDECOMPOSE' | 'ABORT' {
        if (this.stats.validationAttempts < config.circuitBreaker.maxValidationAttempts) {
            return 'CONTINUE';
        }
        // If we've failed validation too many times, maybe just abort or try a simpler approach?
        // For now, let's say we abort if we can't even get a valid decomposition
        logger.error('CircuitBreaker: Max validation attempts reached.');
        return 'ABORT';
    }

    checkExplanationIteration(conceptId: string): 'CONTINUE' | 'SKIP_CONCEPT' {
        const iterations = this.stats.conceptIterations[conceptId] || 0;
        if (iterations < config.circuitBreaker.maxExplainIterations) {
            return 'CONTINUE';
        }
        logger.warn(`CircuitBreaker: Max iterations reached for concept ${conceptId}. Skipping.`);
        return 'SKIP_CONCEPT';
    }

    checkRedecompositionLimit(): 'CONTINUE' | 'PARTIAL_OUTPUT' {
        if (this.stats.redecompositionCount < config.circuitBreaker.maxRedecompositions) {
            return 'CONTINUE';
        }
        logger.warn('CircuitBreaker: Max redecompositions reached. Proceeding with partial output.');
        return 'PARTIAL_OUTPUT';
    }

    checkConceptFailures(totalConcepts: number): 'CONTINUE' | 'ABORT' {
        if (totalConcepts === 0) return 'CONTINUE';

        const failureRate = this.stats.failedConcepts.length / totalConcepts;
        if (failureRate > config.circuitBreaker.maxConceptFailures) {
            logger.error(`CircuitBreaker: Concept failure rate ${failureRate} exceeds limit.`);
            return 'ABORT';
        }
        return 'CONTINUE';
    }
}
