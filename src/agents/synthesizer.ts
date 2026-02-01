import { config } from "../config/config.js";
import { BaseAgent } from "../core/agent/base-agent.js";
import type {
	BuilderOutput,
	ConceptNode,
	Decomposition,
	Explanation,
	ScoutReport,
	SynthesizerResult,
} from "../core/types.js";
import { TemplateManager } from "../generator/template-manager.js";

export class SynthesizerAgent extends BaseAgent {
	private templateManager: TemplateManager;

	constructor() {
		super();
		this.templateManager = new TemplateManager(config.paths.root);
	}

	async execute(input: {
		scoutReport: ScoutReport;
		decomposition: Decomposition;
		explanations: Explanation[];
		builderOutput: BuilderOutput;
	}): Promise<SynthesizerResult> {
		// Generate Index/Overview via LLM
		const conversation = await this.templateRenderer.render("synthesizer", {
			scoutJson: JSON.stringify(input.scoutReport, null, 2),
			decompositionJson: JSON.stringify(input.decomposition, null, 2),
			// We only pass names/summaries for the index, not full explanations to save context/focus
			explanationsJson: JSON.stringify(
				input.explanations.map((e) => ({
					name: e.conceptName,
					simple: e.simpleExplanation,
				})),
				null,
				2,
			),
			builderJson: JSON.stringify(input.builderOutput, null, 2),
		});

		const response = await this.executeLLM(conversation);
		const indexContent = response.content;

		// Generate Pages from Concept Tree
		// The decomposition.concepts is passed as the root of the tree (ConceptNode[])
		const rootNodes = input.decomposition.concepts as unknown as ConceptNode[];
		const pages: {
			id: string;
			title: string;
			fileName: string;
			content: string;
		}[] = [];

		const processNode = async (node: ConceptNode) => {
			// Respect the path calculated during decomposition
			const fileName = node.relativeFilePath || `${this.slugify(node.name)}.md`;

			// Generate Content (reuse existing format)
			if (node.explanation) {
				const exp = node.explanation;

				// Prepare references for template
				const hasReferences =
					exp.references &&
					(exp.references.official ||
						exp.references.bestTutorial ||
						exp.references.quickReference ||
						exp.references.deepDive ||
						(exp.references.others && exp.references.others.length > 0));

				const context = {
					...exp,
					hasReferences,
					// Ensure complexity is formatted if needed, though template handles replace
					complexity: exp.complexity
						? exp.complexity.replace("_", " ")
						: undefined,
				};

				const content = await this.templateManager.render(
					"concept-page.md",
					context,
				);

				pages.push({
					id: node.id,
					title: node.name,
					fileName,
					content,
				});
			}

			// Recurse
			if (node.children) {
				for (const child of node.children) {
					await processNode(child);
				}
			}
		};

		for (const node of rootNodes) {
			await processNode(node);
		}

		// Calculate stats
		const totalWordCount =
			indexContent.split(/\s+/).length +
			pages.reduce((acc, p) => acc + p.content.split(/\s+/).length, 0);
		const readingTime = `${Math.ceil(totalWordCount / 200)} min read`;

		// TOC is concepts list - flatten or just empty
		const toc: string[] = [];

		return {
			indexContent,
			pages,
			tableOfContents: toc,
			stats: {
				wordCount: totalWordCount,
				readingTime,
			},
		};
	}

	private slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}
}
