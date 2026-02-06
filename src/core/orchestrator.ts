import path from "node:path";
// Agents
import {
	ClarifierAgent,
	type ClarifierRequirements,
	type ClarifierResult,
} from "../agents/clarifier.js";
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
import { createSessionLogger, type LoggerSubscriber } from "../utils/logger.js";
import { EventManager } from "./event-manager.js";
import { StateManager, type WorkflowPhase } from "./state.js";
import type {
	Concept,
	ConceptNode,
	Explanation,
	SynthesizerResult,
} from "./types.js";

interface DecomposeTask {
	topic: string;
	currentDepth: number;
	parentConcepts: string[];
	parentNodeId?: string;
	currentPath: string;
	sectionPrefix: string;
	targetNodes: ConceptNode[];
	rootTopic: string;
	persona: string;
}

export class Orchestrator {
	private stateManager: StateManager;
	private events: EventManager;
	private loggerSubscriber: LoggerSubscriber;
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
	private synthesizer = new SynthesizerAgent();
	private similarity = new SimilarityAgent();

	private mkdocs = new MkDocsGenerator();
	private templateManager: TemplateManager;

	private outputDir: string;

	constructor(sessionId: string, outputDir: string) {
		this.outputDir = outputDir;
		this.stateManager = new StateManager(sessionId, outputDir);
		this.events = new EventManager(sessionId);
		this.loggerSubscriber = createSessionLogger(this.events, outputDir);
		this.templateManager = new TemplateManager(config.paths.root);
	}

	getEvents() {
		return this.events;
	}

	markInterrupted() {
		this.stateManager.markInterrupted();
	}

	private log(level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]) {
		this.events.publish("log", {
			type: "entry",
			level,
			message,
			args: args.length > 0 ? args : undefined,
		});
	}

	async process(topic: string, depth: number, persona: string) {
		try {
			// Load existing state if resuming
			await this.stateManager.loadState();
			const existingState = this.stateManager.getState();

			// Populate exploredConcepts from existing explanations (for resume)
			if (existingState.explanations) {
				for (const conceptName of Object.keys(existingState.explanations)) {
					this.addToExplored(conceptName);
				}
			}

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
					persona: persona,
				},
				depth,
				null,
			);

			return finalResult;
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.log("error", "Orchestrator Fatal Error:", err);
			this.events.publish("error", { type: "error", message: err.message });
			throw err;
		}
	}

	private async askUser(
		question: string,
		options?: string[],
		context?: {
			topic: string;
			requirements: Record<string, string>;
			suggestions: { approach: string; reason: string }[];
		},
	): Promise<string> {
		return new Promise((resolve) => {
			this.inputResolver = resolve;
			this.events.publish("input", { type: "request", question, options, context });
		});
	}

	public resolveInput(answer: string) {
		if (this.inputResolver) {
			this.inputResolver(answer);
			this.inputResolver = null;
		}
	}

	private logPhase(phase: WorkflowPhase, nodeName: string) {
		this.stateManager.updateState({ currentPhase: phase });
		this.events.publish("workflow", { type: "phase_start", phase });
		this.log("info", `Phase: ${phase} - ${nodeName}`);
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
					this.log(
						"info",
						`[Similarity] "${name}" effectively duplicate of "${result.similarTo}". Reason: ${result.reasoning}`,
					);
					return true;
				}
			} catch (error) {
				this.log(
					"error",
					"[Similarity] Agent failed, falling back to false",
					error,
				);
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
		_unusedScoutReport: unknown,
	): Promise<
		SynthesizerResult & { node: ConceptNode; allExplanations: Explanation[] }
	> {
		const {
			topic,
			currentDepth,
			parentConcepts,
			parentNodeId,
			currentPath,
			sectionPrefix,
			rootTopic,
		} = task;
		const isRoot = currentDepth === 0;
		const existingState = this.stateManager.getState();
		const isResuming =
			existingState.explanations &&
			Object.keys(existingState.explanations).length > 0;

		// Check if this concept was already explained (for resume)
		if (!isRoot && existingState.explanations?.[topic]) {
			this.log("info", `[Process Task] Skipping already explained: "${topic}"`);
			const existingExplanation = existingState.explanations[topic];
			const slugBase = this.mkdocs.slugify(topic);
			const slug = `${sectionPrefix}_${slugBase}`;
			const subDir = path.join(currentPath, slug);

			// Return existing node data
			const node: ConceptNode = {
				id: slug,
				name: topic,
				oneLiner: existingExplanation.elevatorPitch || "",
				isAtomic: true,
				dependsOn: [],
				relativeFilePath: path.join(subDir, "index.md"),
				status: "done",
				explanation: existingExplanation,
			};

			// Emit node as discovered and done
			this.events.publish("node", { type: "discovered", node, parentId: parentNodeId });
			this.events.publish("node", {
				type: "status_update",
				nodeId: node.id,
				status: "done",
			});

			return {
				node,
				indexContent: "",
				pages: [],
				tableOfContents: [],
				stats: { wordCount: 0, readingTime: "0 min" },
				allExplanations: [existingExplanation],
			};
		}

		this.log(
			"info",
			`[Process Task] Processing: "${topic}" | Depth: ${currentDepth}/${totalDepth}`,
		);

		// 1. Setup Node/Directory
		let node: ConceptNode;
		let subDirPath = currentPath;

		if (isRoot) {
			this.logPhase("scout", topic);
			// Only clear explored concepts if not resuming
			if (!isResuming) {
				this.exploredConcepts.clear();
			}
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
			this.events.publish("node", { type: "discovered", node });
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
			this.events.publish("node", {
				type: "discovered",
				node,
				parentId: parentNodeId,
			});
		}

		this.events.publish("workflow", {
			type: "step_progress",
			nodeId: node.id,
			step: "processing",
			status: "started",
			message: `Processing: ${topic}`,
		});

		// 2. Discovery / Explanation
		this.events.publish("node", {
			type: "status_update",
			nodeId: node.id,
			status: "in-progress",
		});

		this.events.publish("workflow", {
			type: "step_progress",
			nodeId: node.id,
			step: "explaining",
			status: "started",
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
				persona: task.persona,
			});
			if (critique.verdict === "PASS") {
				passed = true;
			} else {
				this.log(
					"info",
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

		this.events.publish("workflow", {
			type: "step_progress",
			nodeId: node.id,
			step: "explaining",
			status: "completed",
		});

		// 4. Write Index Page
		if (isRoot) {
			this.stateManager.updateState({ scoutReport: explanation });
			await this.mkdocs.writeIndexPage(explanation, topic, this.outputDir);
		} else {
			await this.writeIncrementalPage(explanation, node.relativeFilePath);
		}

		this.stateManager.addExplanation(topic, explanation);
		this.events.publish("node", {
			type: "status_update",
			nodeId: node.id,
			status: "done",
		});

		// 5. Decompose & Recurse
		const childrenNodes: ConceptNode[] = [];
		const allExplanations: Explanation[] = [explanation];

		if (currentDepth < totalDepth) {
			this.logPhase("decompose", topic);

			this.events.publish("workflow", {
				type: "step_progress",
				nodeId: node.id,
				step: "decomposing",
				status: "started",
			});

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
				this.log(
					"info",
					`[Decomposer] Low self-reflection score (${selfScore}) for "${topic}". Invoking ValidatorAgent...`,
				);
				const validation = await this.validator.execute({
					topic,
					rootTopic,
					scoutReport: explanation,
					decomposition,
				});

				if (validation.verdict === "NEEDS_REDECOMPOSITION") {
					this.log(
						"warn",
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

			const processChild = async (concept: Concept, index: number) => {
				this.addToExplored(concept.name);
				const currentSection = sectionPrefix
					? `${sectionPrefix}_${index}`
					: `${index}`;

				// Pre-compute the node ID so we can emit status on failure
				const slugBase = this.mkdocs.slugify(concept.name);
				const childNodeId = `${currentSection}_${slugBase}`;

				try {
					return await this.processSingleTask(
						{
							topic: concept.name,
							currentDepth: currentDepth + 1,
							parentConcepts: [...parentConcepts, topic],
							parentNodeId: node.id,
							currentPath: subDirPath,
							sectionPrefix: currentSection,
							targetNodes: [],
							rootTopic: rootTopic,
							persona: task.persona,
						},
						totalDepth,
						null,
					);
				} catch (error) {
					// Emit failed status so UI updates the node
					this.events.publish("node", {
						type: "status_update",
						nodeId: childNodeId,
						status: "failed",
					});
					throw error; // Re-throw so Promise.allSettled captures it
				}
			};

			const childSettled = await Promise.allSettled(
				filteredConcepts.map((c, i) => processChild(c, i + 1)),
			);

			for (const result of childSettled) {
				if (result.status === "fulfilled" && result.value?.node) {
					childrenNodes.push(result.value.node);
					if (result.value.allExplanations) {
						allExplanations.push(...result.value.allExplanations);
					}
				} else if (result.status === "rejected") {
					// Log the failure but continue processing other nodes
					const errorMsg =
						result.reason instanceof Error
							? result.reason.message
							: String(result.reason);
					this.log("warn", `[Orchestrator] Child node failed: ${errorMsg}`);
					this.events.publish("error", { type: "error", message: `Node failed: ${errorMsg}` });
				}
			}

			node.children = childrenNodes;
			if (childrenNodes.length > 0) node.isAtomic = false;

			this.events.publish("workflow", {
				type: "step_progress",
				nodeId: node.id,
				step: "decomposing",
				status: "completed",
			});
		}

		// 6. Synthesize (includes building)
		this.logPhase("synthesize", topic);
		const decompositionContext = {
			concepts: childrenNodes,
			depthLevel: totalDepth,
			totalConcepts: childrenNodes.length,
			learningSequence: childrenNodes.map((c) => c.id),
			inScope: [],
			outOfScope: [],
		};

		const synthesisResult = await this.synthesizer.execute({
			scoutReport: explanation,
			decomposition: decompositionContext,
			explanations: allExplanations,
		});

		const finalResult = {
			...synthesisResult,
			node,
			allExplanations,
		};

		if (isRoot) {
			this.logPhase("complete", topic);
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
		this.log("info", `[Incremental Doc] Written: ${fileName}`);
	}

	public async clarify(initialQuery: string) {
		const history: { question: string; answer: string }[] = [];
		let requirements: ClarifierRequirements = {
			constraints: {},
			preferences: {},
		};

		let clarification = await this.clarifier.execute({
			userQuery: initialQuery,
			history: [],
			requirements,
		});

		// Loop until confirmed (isClear = true)
		while (!clarification.isClear) {
			// Always accumulate requirements from each turn
			if (clarification.requirements) {
				requirements = {
					...requirements,
					...clarification.requirements,
					constraints: {
						...requirements.constraints,
						...clarification.requirements.constraints,
					},
					preferences: {
						...requirements.preferences,
						...clarification.requirements.preferences,
					},
				};
			}

			if (clarification.needsConfirmation) {
				// CONFIRM phase - show summary and get confirmation
				const confirmQuestion = this.buildConfirmationQuestion(clarification);
				const context = this.buildConfirmationContext(clarification);
				const answer = await this.askUser(
					confirmQuestion.question,
					confirmQuestion.options,
					context,
				);

				history.push({ question: confirmQuestion.question, answer });

				if (answer === "Start over") {
					// Reset everything
					history.length = 0;
					requirements = { constraints: {}, preferences: {} };
				}
				// "Yes, proceed" and "Let me adjust" both continue to next iteration
				// The LLM will see the answer in history and respond accordingly
			} else if (
				clarification.clarifications &&
				clarification.clarifications.length > 0
			) {
				// REFINE phase - ask ONE question at a time (first one only)
				const q = clarification.clarifications[0];
				const answer = await this.askUser(q.question, q.options);
				history.push({ question: q.question, answer });
			} else {
				// No questions and not ready to confirm - break to avoid infinite loop
				this.log(
					"warn",
					"Clarifier returned no questions and not ready to confirm. Proceeding with best effort.",
				);
				break;
			}

			// Re-run with accumulated context
			clarification = await this.clarifier.execute({
				userQuery: initialQuery,
				history,
				requirements,
			});
		}

		return clarification;
	}

	private buildConfirmationQuestion(clarification: ClarifierResult): {
		question: string;
		options: string[];
	} {
		const parts: string[] = [
			`Topic: "${clarification.confirmedTopic || clarification.originalQuery}"`,
		];

		// Add key requirements
		if (clarification.requirements) {
			const req = clarification.requirements;
			if (req.domain) parts.push(`Domain: ${req.domain}`);
			if (req.focus) parts.push(`Focus: ${req.focus}`);
			if (req.audience) parts.push(`Audience: ${req.audience}`);
		}

		// Add suggestions
		if (clarification.suggestions && clarification.suggestions.length > 0) {
			const suggested = clarification.suggestions
				.map((s) => s.approach)
				.join(", ");
			parts.push(`Suggested approach: ${suggested}`);
		}

		const summary = parts.join("\n");
		return {
			question: `Ready to proceed?\n\n${summary}`,
			options: ["Yes, proceed", "Let me adjust", "Start over"],
		};
	}

	private buildConfirmationContext(clarification: ClarifierResult) {
		const requirements: Record<string, string> = {};

		if (clarification.requirements) {
			const req = clarification.requirements;
			if (req.domain) requirements.Domain = req.domain;
			if (req.focus) requirements.Focus = req.focus;
			if (req.audience) requirements.Audience = req.audience;
			if (req.language) requirements.Language = req.language;

			for (const [key, value] of Object.entries(req.constraints)) {
				requirements[key] = value;
			}
			for (const [key, value] of Object.entries(req.preferences)) {
				requirements[key] = value;
			}
		}

		return {
			topic: clarification.confirmedTopic || clarification.originalQuery,
			requirements,
			suggestions: clarification.suggestions || [],
		};
	}
}
