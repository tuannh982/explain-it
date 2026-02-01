export interface Topic {
	originalQuery: string;
	confirmedTopic: string;
	depthLevel: number;
	focus?: string;
	userLevel?: string;
	isClear: boolean;
}

export interface Resource {
	url?: string;
	name: string;
	type?: string;
	qualityScore: number;
	notes?: string;
	depthMatch?: string;
	whyRecommended?: string;
}

export interface Reference {
	url: string;
	name: string;
	qualityScore: number;
	description?: string;
}

export interface Explanation {
	// Aligned fields from both Scout and Explainer
	conceptName: string;
	category?: string;
	elevatorPitch?: string;
	simpleExplanation: string;

	// Scout-specific high-level metadata
	problemSolved?: string;
	targetUsers?: string;
	similarTo?: string[];
	complexity?: "simple" | "moderate" | "complex" | "very_complex";
	prerequisites?: string[];

	// Feynman / Teaching elements
	analogy?: string;
	imaginationScenario?: string;
	diagram?: {
		type: string;
		mermaidCode: string;
		caption: string;
	};
	whyExists?: {
		before: string;
		pain: string;
		after: string;
	};
	codeExample?: {
		language: string;
		code: string;
		whatHappens: string;
	};
	checkUnderstanding: string[];

	// Resources / References
	references: {
		official?: Reference;
		bestTutorial?: Reference;
		quickReference?: Reference;
		deepDive?: Reference;
		others?: Reference[];
	};
	resourceWarnings?: string[];
}

export type ScoutReport = Explanation; // Aliased for backward compatibility in Orchestrator for now

export interface Concept {
	id: string;
	name: string;
	oneLiner: string;
	isAtomic: boolean;
	dependsOn: string[]; // IDs of prerequisite concepts
}

export interface ConceptNode extends Concept {
	children?: ConceptNode[];
	explanation?: Explanation;
	relativeFilePath?: string;
	status: "pending" | "in-progress" | "done" | "failed";
}

export interface Decomposition {
	depthLevel: number;
	totalConcepts: number;
	concepts: Concept[]; // Flat list of current level
	learningSequence: string[]; // IDs in order
	inScope?: string[];
	outOfScope?: string[];
	reflection?: {
		domainCorrectnessScore: number;
		reasoning: string;
	};
}

export interface Critique {
	persona: string;
	thinkAloud: string;
	memorySafe: boolean;
	missingReminders: string[];
	tests: {
		explainBack: boolean;
		analogyWorks: boolean;
		scenarioImmersive: boolean;
		diagramClear: boolean;
		codeReadable: boolean;
	};
	gaps: {
		jargon: string[];
		logic: string[];
		motivation: string[];
	};
	scores: {
		clarity: number;
		jargonFree: number;
		analogy: number;
		scenario: number;
		diagram: number;
		code: number;
		memorySafe: number;
		average: number;
	};
	verdict: "PASS" | "REVISE" | "RETHINK";
	fixes: {
		issue: string;
		fix: string;
		priority: number;
	}[];
}

export interface BuilderOutput {
	prerequisites: string[];
	quickStart: string[];
	nextSteps: string[];
	projectStructure?: string;
	implementationSteps?: {
		step: string;
		description: string;
		expectedOutput?: string;
	}[];
	checkpoints?: string[];
	commonIssues?: string[];
	implementationPhases?: string[];
	errorHandling?: string[];
	troubleshooting?: string[];
	advancedConfig?: string[];
}

export interface SynthesizerResult {
	indexContent: string;
	pages: {
		id: string;
		title: string;
		fileName: string;
		content: string;
	}[];
	tableOfContents: string[];
	stats: {
		wordCount: number;
		readingTime: string;
	};
}
