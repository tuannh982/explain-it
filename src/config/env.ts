import dotenv from "dotenv";
import { z } from "zod";

// Load .env file
dotenv.config();

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	CLAUDE_API_KEY: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	GEMINI_API_KEY: z.string().optional(),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

// biome-ignore lint/suspicious/noExplicitAny: inferred from zod
let parsedEnv: any;
try {
	parsedEnv = envSchema.parse(process.env);
} catch (error: unknown) {
	if (error instanceof z.ZodError) {
		console.error(
			"Environment validation failed:",
			// biome-ignore lint/suspicious/noExplicitAny: zod error type issue
			JSON.stringify((error as z.ZodError<any>).issues, null, 2),
		);
	} else {
		console.error("Environment loading failed:", error);
	}
	process.exit(1);
}

export const env = parsedEnv;
