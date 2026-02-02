import { describe, expect, it } from "vitest";
import { BuilderAgent } from "../../src/agents/builder";
import { ClarifierAgent } from "../../src/agents/clarifier";
import { CriticAgent } from "../../src/agents/critic";
import { DecomposerAgent } from "../../src/agents/decomposer";
import { ExplainerAgent } from "../../src/agents/explainer";
import { IteratorAgent } from "../../src/agents/iterator";
import { SynthesizerAgent } from "../../src/agents/synthesizer";
import { ValidatorAgent } from "../../src/agents/validator";
import type {
	BuilderOutput,
	Concept,
	Decomposition,
	Explanation,
	ScoutReport,
} from "../../src/core/types";

describe("Comprehensive Agent Integration Tests", () => {
	const TIMEOUT = 120000;

	// --- Mocks & State ---
	const mockConcept: Concept = {
		id: "c1",
		name: "Flex Container",
		oneLiner: "The parent element that holds items.",
		isAtomic: true,
		dependsOn: [],
	};

	const mockScoutReport: ScoutReport = {
		category: "CSS Layout Module",
		problemSolved: "Arranging elements efficiently.",
		targetUsers: "Frontend Developers",
		similarTo: ["Grid", "Float"],
		elevatorPitch: "Layout engine for 1D.",
		complexity: "moderate",
		prerequisites: ["CSS Basics"],
		resources: {
			official: { name: "MDN", qualityScore: 5, url: "https://mdn.io" },
		},
		resourceWarnings: [],
		searchQueriesUsed: [],
	};

	const mockDecomposition: Decomposition = {
		depthLevel: 2,
		totalConcepts: 1,
		concepts: [mockConcept],
		learningSequence: ["c1"],
		inScope: ["Flexbox"],
		outOfScope: ["Grid"],
	};

	const mockExplanation: Explanation = {
		conceptName: "Flex Container",
		simpleExplanation: "The container that enables flex context.",
		checkUnderstanding: ["What is it?"],
		whyExists: {
			before: "Floats",
			pain: "Hard to align",
			after: "Easy alignment",
		},
		codeExample: {
			language: "css",
			code: ".container { display: flex; }",
			whatHappens: "Items align in row",
		},
	};

	const mockBuilderOutput: BuilderOutput = {
		prerequisites: ["HTML"],
		quickStart: ["display: flex"],
		nextSteps: ["Grid"],
	};

	// --- Tests ---

	describe("Clarifier Agent", () => {
		const agent = new ClarifierAgent();
		it(
			"should identify ambiguity",
			async () => {
				const result = await agent.execute({ userQuery: "Redux" });
				expect(result.isClear).toBe(false);
			},
			TIMEOUT,
		);
	});

	describe("Decomposer Agent", () => {
		const agent = new DecomposerAgent();
		it(
			"should decompose topic",
			async () => {
				const result = await agent.execute({
					topic: "CSS Flexbox",
					depthLevel: 2,
					scoutReport: mockScoutReport,
				});
				expect(result.concepts.length).toBeGreaterThan(0);
			},
			TIMEOUT,
		);
	});

	describe("Validator Agent", () => {
		const agent = new ValidatorAgent();
		it(
			"should validate plan",
			async () => {
				const result = await agent.execute({
					topic: "CSS Flexbox",
					scoutReport: mockScoutReport,
					decomposition: mockDecomposition,
				});
				expect(result.verdict).toBeDefined(); // ValidatorResult type check
			},
			TIMEOUT,
		);
	});

	describe("Explainer Agent", () => {
		const agent = new ExplainerAgent();
		it(
			"should explain concept",
			async () => {
				const result = await agent.execute({
					concept: mockConcept,
					depthLevel: 2,
					previousConcepts: [],
				});
				expect(result.simpleExplanation).toBeDefined();
			},
			TIMEOUT,
		);
	});

	describe("Critic & Iterator Agents", () => {
		const critic = new CriticAgent();
		const iterator = new IteratorAgent();

		it(
			"should critique and improve",
			async () => {
				const critique = await critic.execute({
					conceptName: mockConcept.name,
					explanation: mockExplanation,
					depthLevel: 2,
				});
				expect(critique.scores.average).toBeGreaterThan(0);

				const improved = await iterator.execute({
					explanation: mockExplanation,
					critique: critique,
					iteration: 1,
				});
				expect(improved.revisedExplanation).toBeDefined();
			},
			TIMEOUT,
		);
	});

	describe("Builder Agent", () => {
		const agent = new BuilderAgent();
		it(
			"should build guide metadata",
			async () => {
				const result = await agent.execute({
					explanations: [mockExplanation],
					depthLevel: 2,
				});
				expect(result.quickStart).toBeDefined();
			},
			TIMEOUT,
		);
	});

	describe("Synthesizer Agent", () => {
		const agent = new SynthesizerAgent();
		it(
			"should synthesize final markdown",
			async () => {
				const result = await agent.execute({
					scoutReport: mockScoutReport,
					decomposition: mockDecomposition,
					explanations: [mockExplanation],
					builderOutput: mockBuilderOutput,
				});
				expect(result.indexContent).toBeDefined();
			},
			TIMEOUT,
		);
	});
});
