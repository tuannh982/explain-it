import { env } from './env';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
    app: {
        name: 'explain-it',
        version: '0.1.0',
        env: env.NODE_ENV,
    },
    llm: {
        defaults: {
            provider: 'claude', // Default provider
            model: 'claude-opus-4-5-20251101', // ultra-powerful model as requested
            temperature: 0.7,
            maxTokens: 4096,
        },
        providers: {
            claude: {
                apiKey: env.CLAUDE_API_KEY,
            },
            openai: {
                apiKey: env.OPENAI_API_KEY,
            },
            gemini: {
                apiKey: env.GEMINI_API_KEY,
            }
        }
    },
    paths: {
        root: path.resolve(__dirname, '../../'),
        output: path.resolve(__dirname, '../../output'),
        prompts: path.resolve(__dirname, '../prompts'),
    },
    circuitBreaker: {
        maxValidationAttempts: 2,
        maxExplainIterations: 3,
        maxRedecompositions: 2,
        maxConceptFailures: 0.3, // 30%
    },
    scout: {
        trustedSites: [
            'medium.com',
            'wikipedia.org',
            'arxiv.org',
            'github.com',
            'dev.to',
            'stackoverflow.com',
            'reddit.com',
            'geeksforgeeks.org',
            'tutorialspoint.com'
        ]
    }
};
