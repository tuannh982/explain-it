import path from "node:path";
import fs from "fs-extra";
import type {
	BuilderOutput,
	Decomposition,
	Explanation,
	ScoutReport,
	Topic,
} from "./types.js";

export type WorkflowPhase =
	| "clarify"
	| "scout"
	| "decompose"
	| "validate"
	| "explain"
	| "build"
	| "synthesize"
	| "complete"
	| "failed"
	| "decompose_root"
	| "decompose_child";

export interface WorkflowState {
	topic?: Topic;
	scoutReport?: ScoutReport;
	decomposition?: Decomposition;
	explanations: Record<string, Explanation>;
	builderOutput?: BuilderOutput;

	currentPhase: WorkflowPhase;

	// Counters
	validationAttempts: number;
	redecompositionCount: number;
	conceptIterations: Record<string, number>;

	// Tracking
	explainedConcepts: string[]; // IDs
	failedConcepts: string[]; // IDs
	warnings: string[];
}

export class StateManager {
	private state: WorkflowState;
	private filePath: string;

	constructor(outputDir: string) {
		this.filePath = path.join(outputDir, "state.json");
		this.state = this.getInitialState();
	}

	private getInitialState(): WorkflowState {
		return {
			explanations: {},
			currentPhase: "clarify",
			validationAttempts: 0,
			redecompositionCount: 0,
			conceptIterations: {},
			explainedConcepts: [],
			failedConcepts: [],
			warnings: [],
		};
	}

	getState(): WorkflowState {
		return this.state;
	}

	updateState(update: Partial<WorkflowState>) {
		this.state = { ...this.state, ...update };
		this.saveState();
	}

	addExplanation(topic: string, explanation: Explanation) {
		this.state.explanations = {
			...this.state.explanations,
			[topic]: explanation,
		};
		this.state.explainedConcepts = [...this.state.explainedConcepts, topic];
		this.saveState();
	}

	async saveState() {
		await fs.ensureDir(path.dirname(this.filePath));
		await fs.writeJSON(this.filePath, this.state, { spaces: 2 });
	}

	async loadState() {
		if (await fs.pathExists(this.filePath)) {
			this.state = await fs.readJSON(this.filePath);
		}
	}

	reset() {
		this.state = this.getInitialState();
		this.saveState();
	}
}
