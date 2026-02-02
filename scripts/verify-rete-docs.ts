import path from "node:path";
import { fileURLToPath } from "node:url";
import { Orchestrator } from "../src/core/orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	const outputDir = path.resolve(__dirname, "../output/rete-test");
	console.log(`Starting Orchestrator test. Output directory: ${outputDir}`);

	const orchestrator = new Orchestrator(outputDir);

	try {
		const result = await orchestrator.process("Rete algorithm", 2);
		console.log("Orchestrator completed successfully.");
		console.log(
			"Result summary (Index):",
			`${result.indexContent.substring(0, 200)}...`,
		);
		console.log("Pages generated:", result.pages.length);
	} catch (error) {
		console.error("Orchestrator failed:", error);
		process.exit(1);
	}
}

main();
