import { BaseAgent } from '../core/agent/base-agent';
import { Concept, Explanation } from '../core/types';
import { SearchService } from '../utils/search-service';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class ExplainerAgent extends BaseAgent {
    private searchService = new SearchService();

    async execute(input: { concept: Concept | { name: string, oneLiner?: string }, depthLevel: number, previousConcepts: string[] }): Promise<Explanation> {
        const conceptName = 'name' in input.concept ? input.concept.name : (input.concept as any).name;
        const conceptOneLiner = 'oneLiner' in input.concept ? input.concept.oneLiner : '';

        logger.info(`[Explainer] Explaining concept: "${conceptName}" (Depth: ${input.depthLevel})`);

        // Perform web research to find resources
        const trustedSites = config.scout.trustedSites;
        const searchResults = await this.searchService.performSearch(conceptName, trustedSites);

        const previous = input.previousConcepts.length > 0 ? input.previousConcepts.join(', ') : 'None (First concept)';

        return this.executeLLM<Explanation>('explainer', {
            conceptName: conceptName,
            conceptOneLiner: conceptOneLiner,
            depthLevel: input.depthLevel,
            previousConcepts: previous,
            searchResults: searchResults
        });
    }
}
