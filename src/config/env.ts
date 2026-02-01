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

let parsedEnv: any;
try {
	parsedEnv = envSchema.parse(process.env);
} catch (error: any) {
	if (error.name === "ZodError") {
		console.error(
			"Environment validation failed:",
			JSON.stringify(error.errors, null, 2),
		);
	} else {
		console.error("Environment loading failed:", error);
	}
	process.exit(1);
}

export const env = parsedEnv;
