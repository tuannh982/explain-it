import { search } from 'duck-duck-scrape';
import { logger } from './logger';

export interface SearchResult {
    title: string;
    url: string;
    description: string;
}

export class SearchService {
    async performSearch(topic: string, trustedSites?: string[]): Promise<string> {
        try {
            const query = trustedSites && trustedSites.length > 0
                ? `${topic} (${trustedSites.map(site => `site:${site}`).join(' OR ')})`
                : topic;

            logger.info(`[Search] Searching DuckDuckGo for: ${query}`);

            const results = await search(query, {
                // Remove safeSearch if type is problematic
            });

            if (!results.results || results.results.length === 0) {
                return 'No reliable results found.';
            }

            // Format top 5 results
            const formatted = results.results.slice(0, 5).map((r: any, i: number) => {
                return `[${i + 1}] ${r.title}\nURL: ${r.url}\nExcerpt: ${r.description}\n`;
            }).join('\n---\n');

            return formatted;
        } catch (error: any) {
            logger.error('[Search] Error during DuckDuckGo search:', error.message);
            return 'Search failed. Fallback to LLM internal knowledge.';
        }
    }
}
