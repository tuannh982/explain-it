import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
	app: {
		name: "explain-it",
		version: "0.1.0",
		env: env.NODE_ENV,
	},
	llm: {
		defaults: {
			provider: "claude",
			model: "claude-haiku-4-5-20251001", // faster, efficient model as default
			temperature: 0.7,
			maxTokens: 64000,
		},
		agents: {
			clarifier: {
				model: "claude-haiku-4-5-20251001",
				temperature: 0.3,
			},
			decomposer: {
				// model: 'claude-opus-4-5-20251101', // reasoning heavy
				model: "claude-haiku-4-5-20251001",
				temperature: 0.5,
			},
			explainer: {
				// model: 'claude-opus-4-5-20251101', // quality heavy
				model: "claude-haiku-4-5-20251001",
				temperature: 0.7,
			},
			critic: {
				model: "claude-haiku-4-5-20251001",
				temperature: 0.2,
			},
			iterator: {
				model: "claude-haiku-4-5-20251001",
				temperature: 0.7,
			},
			builder: {
				// model: 'claude-opus-4-5-20251101', // code generation
				model: "claude-haiku-4-5-20251001",
				temperature: 0.5,
			},
			synthesizer: {
				// model: 'claude-opus-4-5-20251101', // integration
				model: "claude-haiku-4-5-20251001",
				temperature: 0.5,
			},
			redecomposer: {
				model: "claude-haiku-4-5-20251001",
				temperature: 0.5,
			},
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
			},
		},
	},
	paths: {
		root: path.resolve(__dirname, "../../"),
		prompts: path.resolve(__dirname, "../templates/prompts"),
		output: path.resolve(__dirname, "../../output"),
	},
	scout: {
		trustedSites: [
			"medium.com",
			"wikipedia.org",
			"arxiv.org",
			"github.com",
			"dev.to",
			"stackoverflow.com",
			"reddit.com",
			"geeksforgeeks.org",
			"tutorialspoint.com",
		],
	},
	retry: {
		maxRetries: 3,
		backoffMs: 1000,
		logFile: "logs/llm-failures.jsonl",
	},
};
