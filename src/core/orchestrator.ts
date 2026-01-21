import { StateManager } from './state';
import { EventSystem } from './events';
import { CircuitBreaker } from './circuit-breaker';
import { logger } from '../utils/logger';
import { ConceptNode, Explanation } from './types';

// Agents
import { ClarifierAgent } from '../agents/clarifier';
import { DecomposerAgent } from '../agents/decomposer';
import { ValidatorAgent } from '../agents/validator';
import { ExplainerAgent } from '../agents/explainer';
import { CriticAgent } from '../agents/critic';
import { IteratorAgent } from '../agents/iterator';
import { ReDecomposerAgent } from '../agents/redecomposer';
import { BuilderAgent } from '../agents/builder';
import { SynthesizerAgent } from '../agents/synthesizer';

import { MkDocsGenerator } from '../output/mkdocs-generator';

export class Orchestrator {
    private stateManager: StateManager;
    private events: EventSystem;
    private circuitBreaker: CircuitBreaker;

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

    private mkdocs = new MkDocsGenerator();

    private outputDir: string;

    constructor(outputDir: string) {
        this.outputDir = outputDir;
        this.stateManager = new StateManager(outputDir);
        this.events = new EventSystem();
        this.circuitBreaker = new CircuitBreaker(this.stateManager.getState());
    }

    getEvents() {
        return this.events;
    }

    async start(initialQuery: string) {
        try {
            logger.info('Starting Orchestrator...');
            this.stateManager.reset();

            // 1. Clarification
            this.updatePhase('clarify');
            const clarification = await this.clarifier.execute({ userQuery: initialQuery });

            if (!clarification.isClear) {
                logger.warn('Query ambiguous, proceeding with best effort.');
            }

            const topicStr = clarification.confirmedTopic || initialQuery;
            const depth = clarification.suggestedDepth || 3;

            this.stateManager.updateState({
                topic: {
                    originalQuery: initialQuery,
                    confirmedTopic: topicStr,
                    depthLevel: depth,
                    isClear: true
                }
            });

            // 2. Discovery (Explainer now handles initial research)
            this.updatePhase('scout');
            const scoutReport = await this.explainer.execute({
                concept: { name: topicStr },
                depthLevel: depth,
                previousConcepts: []
            });
            this.stateManager.updateState({ scoutReport });

            // 3. Decomposition Logic
            const conceptTree = await this.runDecompositionLoop(topicStr, depth, scoutReport);

            // 4. Explanation Loop
            await this.runExplanationLoop(conceptTree, depth);

            // 5. Build
            this.updatePhase('build');
            const state = this.stateManager.getState();
            // Convert explainer map to array
            const explanations = Object.values(state.explanations);

            if (explanations.length === 0) {
                throw new Error('No explanations generated, cannot build.');
            }

            const builderOutput = await this.builder.execute({ explanations, depthLevel: depth });
            this.stateManager.updateState({ builderOutput });

            // 6. Synthesize
            this.updatePhase('synthesize');
            const finalResult = await this.synthesizer.execute({
                scoutReport,
                decomposition: {
                    concepts: conceptTree as any, // Recursive tree passed here
                    depthLevel: depth,
                    totalConcepts: conceptTree.length, // Rough count
                    learningSequence: [],
                    inScope: [],
                    outOfScope: []
                },
                explanations,
                builderOutput
            });

            this.updatePhase('complete');

            // 7. Generate MkDocs Site
            await this.mkdocs.generate(
                topicStr,
                finalResult,
                this.outputDir
            );

            return finalResult;

        } catch (error: any) {
            logger.error('Orchestrator Fatal Error:', error);
            this.events.emit('error', { message: error.message });
            throw error;
        }
    }

    private updatePhase(phase: string) {
        this.stateManager.updateState({ currentPhase: phase as any });
        this.events.emit('phase_start', { phase });
        logger.info(`Phase: ${phase}`);
    }

    private async runDecompositionLoop(topic: string, depth: number, scoutReport: any): Promise<ConceptNode[]> {
        this.updatePhase('decompose');
        return this.decomposeRecursively(topic, depth, scoutReport, 0, []);
    }

    private async decomposeRecursively(topic: string, depth: number, scoutReport: any, currentDepth: number, parentConcepts: string[]): Promise<ConceptNode[]> {
        logger.info(`[Decomposition Loop] Topic: "${topic}" | Depth: ${currentDepth}/${depth}`);

        // 1. Decompose
        const decomposition = await this.decomposer.execute({
            topic,
            depthLevel: depth,
            scoutReport,
            parentConcepts
        });

        // Loop detection
        if (decomposition.concepts.length === 1 && decomposition.concepts[0].name.toLowerCase() === topic.toLowerCase()) {
            logger.warn(`[Decomposition Loop] Infinite loop detected for "${topic}". Stopping recursion.`);
            return [];
        }

        const nodes: ConceptNode[] = [];
        const currentLevelConcepts = decomposition.concepts.map(c => c.name);

        for (const concept of decomposition.concepts) {
            // Avoid repeating ancestors
            if (concept.name.toLowerCase() === topic.toLowerCase() || parentConcepts.some(p => p.toLowerCase() === concept.name.toLowerCase())) {
                logger.debug(`[Decomposition Loop] Skipping repetitive concept: ${concept.name}`);
                continue;
            }

            const node: ConceptNode = { ...concept };

            // Dynamic max recursion depth based on requested depthLevel
            const maxSubDepth = Math.max(1, Math.min(depth - 1, 3));

            if (!concept.isAtomic && currentDepth < maxSubDepth) {
                logger.info(`[Decomposition Loop] "${concept.name}" is COMPLEX. Recursing...`);
                const nextParentConcepts = [...parentConcepts, topic, ...currentLevelConcepts.filter(c => c !== concept.name)];
                node.children = await this.decomposeRecursively(concept.name, depth, scoutReport, currentDepth + 1, nextParentConcepts);

                if (!node.children || node.children.length === 0) {
                    node.isAtomic = true;
                    delete node.children;
                    logger.info(`[Decomposition Loop] Sub-decomposition of "${concept.name}" returned no children. Treating as atomic.`);
                }
            } else if (!concept.isAtomic) {
                logger.info(`[Decomposition Loop] "${concept.name}" is COMPLEX but reached depth/recursion limit. Treating as atomic.`);
                node.isAtomic = true;
            } else {
                logger.info(`[Decomposition Loop] "${concept.name}" is ATOMIC. Normal explanation path.`);
            }

            nodes.push(node);
        }

        return nodes;
    }

    private async runExplanationLoop(conceptTree: ConceptNode[], depth: number) {
        this.updatePhase('explain');
        await this.traverseAndExplain(conceptTree, depth);
        const flatExplanations = this.collectExplanations(conceptTree);
        const explanationMap = flatExplanations.reduce((acc, exp) => ({ ...acc, [exp.conceptName]: exp }), {});
        this.stateManager.updateState({ explanations: explanationMap });
        return conceptTree;
    }

    private async traverseAndExplain(nodes: ConceptNode[], depth: number) {
        for (const node of nodes) {
            // Explain EVERY node
            logger.info(`[Explanation] Starting: ${node.name}`);
            this.events.emit('step_progress', { message: `Explaining: ${node.name}` });

            let explanation = await this.explainer.execute({ concept: node, depthLevel: depth, previousConcepts: [] });

            // Critic Loop
            let passed = false;
            let iterations = 0;
            while (!passed && iterations < 2) {
                const critique = await this.critic.execute({ explanation, conceptName: node.name, depthLevel: depth });
                if (critique.verdict === 'PASS') {
                    passed = true;
                } else {
                    logger.info(`[Explanation] Critic requested revision for: ${node.name} (Iteration ${iterations + 1})`);
                    const iterationResult = await this.iterator.execute({ explanation, critique, iteration: iterations + 1 });
                    explanation = iterationResult.revisedExplanation;
                    iterations++;
                }
            }
            node.explanation = explanation;
            logger.info(`[Explanation] Completed: ${node.name}`);

            // Recurse for children
            if (node.children && node.children.length > 0) {
                await this.traverseAndExplain(node.children, depth);
            }
        }
    }

    private collectExplanations(nodes: ConceptNode[]): Explanation[] {
        let explanations: Explanation[] = [];
        for (const node of nodes) {
            if (node.explanation) explanations.push(node.explanation);
            if (node.children) explanations.push(...this.collectExplanations(node.children));
        }
        return explanations;
    }
}
