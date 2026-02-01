import path from "node:path";
import { BuilderAgent } from "../agents/builder.js";
// Agents
import { ClarifierAgent } from "../agents/clarifier.js";
import { CriticAgent } from "../agents/critic.js";
import { DecomposerAgent } from "../agents/decomposer.js";
import { ExplainerAgent } from "../agents/explainer.js";
import { IteratorAgent } from "../agents/iterator.js";
import { ReDecomposerAgent } from "../agents/redecomposer.js";
import { SimilarityAgent } from "../agents/similarity.js";
import { SynthesizerAgent } from "../agents/synthesizer.js";
import { ValidatorAgent } from "../agents/validator.js";
import { config } from "../config/config.js";
import { MkDocsGenerator } from "../generator/mkdocs-generator.js";
import { TemplateManager } from "../generator/template-manager.js";
import { logger } from "../utils/logger.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { EventSystem } from "./events.js";
import { StateManager } from "./state.js";
import type { ConceptNode, Explanation } from "./types.js";

interface DecomposeTask {
	topic: string;
	currentDepth: number;
	parentConcepts: string[];
	currentPath: string;
	sectionPrefix: string;
	targetNodes: ConceptNode[];
	rootTopic: string;
}

export class Orchestrator {
	private stateManager: StateManager;
	private events: EventSystem;
	private circuitBreaker: CircuitBreaker;
	private exploredConcepts = new Set<string>();
	private inputResolver: ((answer: string) => void) | null = null;

	// Agents
	private clarifier = new ClarifierAgent();
	private decomposer = new DecomposerAgent();
	private validator = new ValidatorAgent();
	private explainer = new ExplainerAgent();
	private critic = new CriticAgent();
	private iterator = new IteratorAgent();
	private redecomposer = new ReDecomposerAgent();
	private builder = new BuilderAgent();
	private synthesizer = new SynthesizerAgent();
	private similarity = new SimilarityAgent();

	private mkdocs = new MkDocsGenerator();
	private templateManager: TemplateManager;

	private outputDir: string;

	constructor(outputDir: string) {
		this.outputDir = outputDir;
		this.stateManager = new StateManager(outputDir);
		this.events = new EventSystem();
		this.circuitBreaker = new CircuitBreaker(this.stateManager.getState());
		this.templateManager = new TemplateManager(config.paths.root);
	}

	getEvents() {
		return this.events;
	}

	async process(topic: string, depth: number) {
		try {
			await this.mkdocs.scaffoldProject(topic, this.outputDir);

			const finalResult = await this.processSingleTask(
				{
					topic: topic,
					currentDepth: 0,
					parentConcepts: [],
					currentPath: "",
					sectionPrefix: "",
					targetNodes: [],
					rootTopic: topic,
				},
				depth,
				null,
			);

			return finalResult;
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			logger.error("Orchestrator Fatal Error:", err);
			this.events.emit("error", { message: err.message });
			throw err;
		}
	}

	async start(initialQuery: string) {
		try {
			logger.info("Starting Orchestrator...");
			this.stateManager.reset();

			this.updatePhase("clarify");

			const clarification = await this.resolveAmbiguity(initialQuery);

			this.stateManager.updateState({
				topic: {
					originalQuery: initialQuery,
					confirmedTopic: clarification.confirmedTopic,
					depthLevel: clarification.suggestedDepth,
					isClear: true,
				},
			});

			this.process(clarification.confirmedTopic, clarification.suggestedDepth);
		} catch (error: any) {
			logger.error("Orchestrator Fatal Error:", error);
			this.events.emit("error", { message: error.message });
			throw error;
		}
	}

	private async askUser(question: string, options?: string[]): Promise<string> {
		return new Promise((resolve) => {
			this.inputResolver = resolve;
			this.events.emit("request_input", { question, options });
		});
	}

	public resolveInput(answer: string) {
		if (this.inputResolver) {
			this.inputResolver(answer);
			this.inputResolver = null;
		}
	}

	private updatePhase(phase: string) {
		this.stateManager.updateState({ currentPhase: phase as any });
		this.events.emit("phase_start", { phase });
		logger.info(`Phase: ${phase}`);
	}

	private async isSimilar(name: string): Promise<boolean> {
		const normalized = name.toLowerCase().trim();
		// Exact match
		if (this.exploredConcepts.has(normalized)) return true;

		// Basic plural/singular match
		const singular = normalized.endsWith("s")
			? normalized.slice(0, -1)
			: normalized;
		if (this.exploredConcepts.has(singular)) return true;

		// Use SimilarityAgent for semantic check
		// We only check if we have concepts to compare against
		if (this.exploredConcepts.size > 0) {
			try {
				const result = await this.similarity.execute({
					candidate: name,
					existing: Array.from(this.exploredConcepts),
				});

				if (result.isSimilar) {
					logger.info(
						`[Similarity] "${name}" effectively duplicate of "${result.similarTo}". Reason: ${result.reasoning}`,
					);
					return true;
				}
			} catch (error) {
				logger.error("[Similarity] Agent failed, falling back to false", error);
				return false;
			}
		}

		return false;
	}

	private addToExplored(name: string) {
		this.exploredConcepts.add(name.toLowerCase().trim());
	}

	private async processSingleTask(
		task: DecomposeTask,
		totalDepth: number,
		_unusedScoutReport: any,
	): Promise<any> {
		const {
			topic,
			currentDepth,
			parentConcepts,
			currentPath,
			sectionPrefix,
			rootTopic,
		} = task;
		const isRoot = currentDepth === 0;

		logger.info(
			`[Process Task] Processing: "${topic}" | Depth: ${currentDepth}/${totalDepth}`,
		);
		this.events.emit("step_progress", { message: `Processing: ${topic}` });

		// 1. Setup Node/Directory
		let node: ConceptNode;
		let subDirPath = currentPath;

		if (isRoot) {
			this.updatePhase("scout");
			this.exploredConcepts.clear();
			this.addToExplored(topic);
			node = {
				id: "root",
				name: topic,
				oneLiner: "",
				isAtomic: false,
				dependsOn: [],
				status: "pending",
				relativeFilePath: "index.md",
			};
		} else {
			const slugBase = this.mkdocs.slugify(topic);
			const slug = `${sectionPrefix}_${slugBase}`;
			subDirPath = path.join(currentPath, slug);
			await this.mkdocs.ensureDirectory(subDirPath, this.outputDir);

			node = {
				id: slug,
				name: topic,
				oneLiner: "",
				isAtomic: true,
				dependsOn: [],
				relativeFilePath: path.join(subDirPath, "index.md"),
				status: "pending",
			};
		}

		// 2. Discovery / Explanation
		this.events.emit("node_status_update", {
			data: { nodeId: node.id, status: "in-progress" },
		});

		const explanationInput = isRoot
			? {
					concept: { name: topic },
					depthLevel: totalDepth,
					previousConcepts: [],
				}
			: {
					concept: node,
					depthLevel: totalDepth,
					previousConcepts: parentConcepts,
				};

		let explanation = await this.explainer.execute(explanationInput);
		node.explanation = explanation;
		node.oneLiner = explanation.elevatorPitch || "";

		// 3. Critic Loop
		let passed = false;
		let iterations = 0;
		while (!passed && iterations < 2) {
			const critique = await this.critic.execute({
				explanation,
				conceptName: topic,
				depthLevel: totalDepth,
			});
			if (critique.verdict === "PASS") {
				passed = true;
			} else {
				logger.info(
					`[Process Task] Critic requested revision for: ${topic} (Iteration ${iterations + 1})`,
				);
				const iterationResult = await this.iterator.execute({
					explanation,
					critique,
					iteration: iterations + 1,
				});
				explanation = iterationResult.revisedExplanation;
				iterations++;
			}
		}
		node.explanation = explanation;

		// 4. Write Index Page
		if (isRoot) {
			this.stateManager.updateState({ scoutReport: explanation });
			await this.mkdocs.writeIndexPage(explanation, topic, this.outputDir);
		} else {
			await this.writeIncrementalPage(explanation, node.relativeFilePath);
		}

		this.stateManager.addExplanation(topic, explanation);
		this.events.emit("node_status_update", {
			data: { nodeId: node.id, status: "done" },
		});

		// 5. Decompose & Recurse
		const childrenNodes: ConceptNode[] = [];
		const allExplanations: Explanation[] = [explanation];

		if (currentDepth < totalDepth) {
			this.updatePhase(isRoot ? "decompose_root" : "decompose_child");

			let decomposition = await this.decomposer.execute({
				topic,
				depthLevel: totalDepth,
				scoutReport: explanation,
				parentConcepts: parentConcepts,
				rootTopic: rootTopic,
				alreadyExplored: Array.from(this.exploredConcepts),
			});

			const selfScore = decomposition.reflection?.domainCorrectnessScore || 10;
			if (selfScore < 8) {
				logger.info(
					`[Decomposer] Low self-reflection score (${selfScore}) for "${topic}". Invoking ValidatorAgent...`,
				);
				const validation = await this.validator.execute({
					topic,
					rootTopic,
					scoutReport: explanation,
					decomposition,
				});

				if (validation.verdict === "NEEDS_REDECOMPOSITION") {
					logger.warn(
						`[Validator] Needs re-decomposition: ${validation.recommendation}`,
					);
					const redecomp = await this.redecomposer.execute({
						decomposition,
						issues: validation.issues,
					});
					decomposition = redecomp.newDecomposition;
				}
			}

			const filteredConcepts = [];
			for (const concept of decomposition.concepts) {
				const isRepetitive =
					concept.name.toLowerCase() === topic.toLowerCase() ||
					parentConcepts.some(
						(p: string) => p.toLowerCase() === concept.name.toLowerCase(),
					);

				if (isRepetitive) continue;

				const similar = await this.isSimilar(concept.name);
				if (similar) continue;

				filteredConcepts.push(concept);
			}

			if (
				decomposition.learningSequence &&
				decomposition.learningSequence.length > 0
			) {
				const seq = decomposition.learningSequence;
				filteredConcepts.sort((a, b) => {
					const idxA = seq.indexOf(a.id);
					const idxB = seq.indexOf(b.id);
					return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
				});
			}

			const processChild = async (concept: any, index: number) => {
				this.addToExplored(concept.name);
				const currentSection = sectionPrefix
					? `${sectionPrefix}_${index}`
					: `${index}`;

				return this.processSingleTask(
					{
						topic: concept.name,
						currentDepth: currentDepth + 1,
						parentConcepts: [...parentConcepts, topic],
						currentPath: subDirPath,
						sectionPrefix: currentSection,
						targetNodes: [],
						rootTopic: rootTopic,
					},
					totalDepth,
					null,
				);
			};

			const childResults = await Promise.all(
				filteredConcepts.map((c, i) => processChild(c, i + 1)),
			);

			for (const res of childResults) {
				if (res?.node) {
					childrenNodes.push(res.node);
					if (res.allExplanations) {
						allExplanations.push(...res.allExplanations);
					}
				}
			}

			node.children = childrenNodes;
			if (childrenNodes.length > 0) node.isAtomic = false;
		}

		// 6. Build
		this.updatePhase("build");
		const builderOutput = await this.builder.execute({
			explanations: allExplanations,
			depthLevel: totalDepth,
		});
		if (isRoot) this.stateManager.updateState({ builderOutput });

		// 7. Synthesize
		this.updatePhase("synthesize");
		const decompositionContext = {
			concepts: childrenNodes as any,
			depthLevel: totalDepth as any,
			totalConcepts: childrenNodes.length,
			learningSequence: childrenNodes.map((c) => c.id),
			inScope: [],
			outOfScope: [],
		};

		const synthesisResult = await this.synthesizer.execute({
			scoutReport: explanation,
			decomposition: decompositionContext,
			explanations: allExplanations,
			builderOutput,
		});

		const finalResult = {
			...synthesisResult,
			node,
			allExplanations,
		};

		if (isRoot) {
			this.updatePhase("complete");
			await this.mkdocs.generate(topic, finalResult, this.outputDir);
		}

		return finalResult;
	}

	private async writeIncrementalPage(
		explanation: Explanation,
		relativePath?: string,
	) {
		const fileName =
			relativePath || `${this.mkdocs.slugify(explanation.conceptName)}.md`;

		// Safe array check for Check Your Understanding
		const safeCheckUnderstanding = Array.isArray(explanation.checkUnderstanding)
			? explanation.checkUnderstanding
			: [];

		// Check if we have any references to display
		const r = explanation.references;
		const hasReferences = !!(
			r &&
			(r.official ||
				r.bestTutorial ||
				r.quickReference ||
				r.deepDive ||
				(r.others && r.others.length > 0))
		);

		const context = {
			conceptName: explanation.conceptName,
			elevatorPitch: explanation.elevatorPitch,
			simpleExplanation: explanation.simpleExplanation,
			analogy: explanation.analogy,
			imaginationScenario: explanation.imaginationScenario,
			diagram: explanation.diagram,
			whyExists: explanation.whyExists,
			codeExample: explanation.codeExample,
			references: explanation.references,
			hasReferences: hasReferences,
			checkUnderstanding: safeCheckUnderstanding,
		};

		const content = await this.templateManager.render(
			"concept-page.md",
			context,
		);
		await this.mkdocs.writePage(fileName, content, this.outputDir);
		logger.info(`[Incremental Doc] Written: ${fileName}`);
	}

	private async resolveAmbiguity(initialQuery: string) {
		const _currentQuery = initialQuery;
		const history: { question: string; answer: string }[] = [];

		let clarification = await this.clarifier.execute({
			userQuery: initialQuery,
			history: history,
		});

		while (!clarification.isClear) {
			logger.warn("Query ambiguous, starting clarification loop.");

			if (
				clarification.clarifications &&
				clarification.clarifications.length > 0
			) {
				const questionObj = clarification.clarifications[0];
				const question = questionObj.question;
				const options = questionObj.options;

				// Emit event to request input from user (TUI)
				const answer = await this.askUser(question, options);

				// Add to history
				history.push({ question, answer });

				// We keep the query constant now, as the context is passed via history
				// But we can still append to query if we want to be safe, though history is better.
				// For now, let's rely on the history field we added to the agent.
			} else {
				logger.warn(
					"Query ambiguous but no clarification questions generated. Proceeding with best effort.",
				);
				break;
			}

			// Retry with updated history
			clarification = await this.clarifier.execute({
				userQuery: initialQuery,
				history: this.compactHistory(history),
			});
		}

		return clarification;
	}

	private compactHistory(
		history: { question: string; answer: string }[],
	): { question: string; answer: string }[] {
		const MAX_TURNS = 10; // Keep last 10 turns
		if (history.length > MAX_TURNS) {
			logger.info(
				`History trimmed from ${history.length} to ${MAX_TURNS} turns.`,
			);
			return history.slice(-MAX_TURNS);
		}
		return history;
	}
}
