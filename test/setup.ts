import path from "node:path";
import dotenv from "dotenv";

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Verify API key presence for integration tests
if (!process.env.CLAUDE_API_KEY) {
	console.warn(
		"⚠️  CLAUDE_API_KEY not found in environment. Integration tests may fail.",
	);
}
