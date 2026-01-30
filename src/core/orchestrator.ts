import fs from 'fs-extra';
import path from 'path';
import { StateManager } from './state.js';
import { EventSystem } from './events.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { logger } from '../utils/logger.js';
import { ConceptNode, Explanation } from './types.js';

// Agents
import { ClarifierAgent } from '../agents/clarifier.js';
import { DecomposerAgent } from '../agents/decomposer.js';
import { ValidatorAgent } from '../agents/validator.js';
import { ExplainerAgent } from '../agents/explainer.js';
import { CriticAgent } from '../agents/critic.js';
import { IteratorAgent } from '../agents/iterator.js';
import { ReDecomposerAgent } from '../agents/redecomposer.js';
import { BuilderAgent } from '../agents/builder.js';
import { SynthesizerAgent } from '../agents/synthesizer.js';

import { MkDocsGenerator } from '../generator/mkdocs-generator.js';
import { TemplateManager } from '../generator/template-manager.js';
import { config } from '../config/config.js';

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

            const finalResult = await this.processSingleTask({
                topic: topic,
                currentDepth: 0,
                parentConcepts: [],
                currentPath: "",
                sectionPrefix: "",
                targetNodes: [],
                rootTopic: topic
            }, depth, null);

            return finalResult;
        } catch (error: any) {
            logger.error('Orchestrator Fatal Error:', error);
            this.events.emit('error', { message: error.message });
            throw error;
        }
    }

    async start(initialQuery: string) {
        try {
            logger.info('Starting Orchestrator...');
            this.stateManager.reset();

            this.updatePhase('clarify');
            const clarification = await this.clarifier.execute({ userQuery: initialQuery });

            if (!clarification.isClear) {
                logger.warn('Query ambiguous, proceeding with best effort.');
            }

            this.stateManager.updateState({
                topic: {
                    originalQuery: initialQuery,
                    confirmedTopic: clarification.confirmedTopic,
                    depthLevel: clarification.suggestedDepth,
                    isClear: true
                }
            });

            this.process(clarification.confirmedTopic, clarification.suggestedDepth);

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

    private isSimilar(name: string): boolean {
        const normalized = name.toLowerCase().trim();
        // Exact match
        if (this.exploredConcepts.has(normalized)) return true;

        // Basic plural/singular match
        const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
        if (this.exploredConcepts.has(singular)) return true;

        // Check against all existing but fuzzy (very light)
        for (const existing of this.exploredConcepts) {
            // If one contains the other and they are long enough
            if (normalized.length > 5 && existing.length > 5) {
                if (normalized.includes(existing) || existing.includes(normalized)) {
                    return true;
                }
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
        _unusedScoutReport: any
    ): Promise<any> {
        const { topic, currentDepth, parentConcepts, currentPath, sectionPrefix, rootTopic } = task;
        const isRoot = currentDepth === 0;

        logger.info(`[Process Task] Processing: "${topic}" | Depth: ${currentDepth}/${totalDepth}`);
        this.events.emit('step_progress', { message: `Processing: ${topic}` });

        // 1. Setup Node/Directory
        let node: ConceptNode;
        let subDirPath = currentPath;

        if (isRoot) {
            this.updatePhase('scout');
            this.exploredConcepts.clear();
            this.addToExplored(topic);
            node = {
                id: 'root',
                name: topic,
                oneLiner: '',
                isAtomic: false,
                dependsOn: [],
                status: 'pending',
                relativeFilePath: 'index.md'
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
                relativeFilePath: path.join(subDirPath, 'index.md'),
                status: 'pending'
            };
        }

        // 2. Discovery / Explanation
        this.events.emit('node_status_update', { data: { nodeId: node.id, status: 'in-progress' } });

        const explanationInput = isRoot
            ? { concept: { name: topic }, depthLevel: totalDepth, previousConcepts: [] }
            : { concept: node, depthLevel: totalDepth, previousConcepts: parentConcepts };

        let explanation = await this.explainer.execute(explanationInput);
        node.explanation = explanation;
        node.oneLiner = explanation.elevatorPitch || '';

        // 3. Critic Loop
        let passed = false;
        let iterations = 0;
        while (!passed && iterations < 2) {
            const critique = await this.critic.execute({ explanation, conceptName: topic, depthLevel: totalDepth });
            if (critique.verdict === 'PASS') {
                passed = true;
            } else {
                logger.info(`[Process Task] Critic requested revision for: ${topic} (Iteration ${iterations + 1})`);
                const iterationResult = await this.iterator.execute({ explanation, critique, iteration: iterations + 1 });
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
        this.events.emit('node_status_update', { data: { nodeId: node.id, status: 'done' } });

        // 5. Decompose & Recurse
        const childrenNodes: ConceptNode[] = [];
        let allExplanations: Explanation[] = [explanation];

        if (currentDepth < totalDepth) {
            this.updatePhase(isRoot ? 'decompose_root' : 'decompose_child');

            let decomposition = await this.decomposer.execute({
                topic,
                depthLevel: totalDepth,
                scoutReport: explanation,
                parentConcepts: parentConcepts,
                rootTopic: rootTopic,
                alreadyExplored: Array.from(this.exploredConcepts)
            });

            const selfScore = decomposition.reflection?.domainCorrectnessScore || 10;
            if (selfScore < 8) {
                logger.info(`[Decomposer] Low self-reflection score (${selfScore}) for "${topic}". Invoking ValidatorAgent...`);
                const validation = await this.validator.execute({
                    topic,
                    rootTopic,
                    scoutReport: explanation,
                    decomposition
                });

                if (validation.verdict === 'NEEDS_REDECOMPOSITION') {
                    logger.warn(`[Validator] Needs re-decomposition: ${validation.recommendation}`);
                    const redecomp = await this.redecomposer.execute({
                        decomposition,
                        issues: validation.issues
                    });
                    decomposition = redecomp.newDecomposition;
                }
            }

            const filteredConcepts = decomposition.concepts.filter(concept => {
                const isRepetitive = concept.name.toLowerCase() === topic.toLowerCase() ||
                    parentConcepts.some((p: string) => p.toLowerCase() === concept.name.toLowerCase());

                if (isRepetitive) return false;
                if (this.isSimilar(concept.name)) return false;
                return true;
            });

            if (decomposition.learningSequence && decomposition.learningSequence.length > 0) {
                const seq = decomposition.learningSequence;
                filteredConcepts.sort((a, b) => {
                    const idxA = seq.indexOf(a.id);
                    const idxB = seq.indexOf(b.id);
                    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                });
            }

            const processChild = async (concept: any, index: number) => {
                this.addToExplored(concept.name);
                const currentSection = sectionPrefix ? `${sectionPrefix}_${index}` : `${index}`;

                return this.processSingleTask({
                    topic: concept.name,
                    currentDepth: currentDepth + 1,
                    parentConcepts: [...parentConcepts, topic],
                    currentPath: subDirPath,
                    sectionPrefix: currentSection,
                    targetNodes: [],
                    rootTopic: rootTopic
                }, totalDepth, null);
            };

            const childResults = await Promise.all(
                filteredConcepts.map((c, i) => processChild(c, i + 1))
            );

            for (const res of childResults) {
                if (res && res.node) {
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
        this.updatePhase('build');
        const builderOutput = await this.builder.execute({
            explanations: allExplanations,
            depthLevel: totalDepth
        });
        if (isRoot) this.stateManager.updateState({ builderOutput });

        // 7. Synthesize
        this.updatePhase('synthesize');
        const decompositionContext = {
            concepts: childrenNodes as any,
            depthLevel: totalDepth as any,
            totalConcepts: childrenNodes.length,
            learningSequence: childrenNodes.map(c => c.id),
            inScope: [],
            outOfScope: []
        };

        const synthesisResult = await this.synthesizer.execute({
            scoutReport: explanation,
            decomposition: decompositionContext,
            explanations: allExplanations,
            builderOutput
        });

        const finalResult = {
            ...synthesisResult,
            node,
            allExplanations
        };

        if (isRoot) {
            this.updatePhase('complete');
            await this.mkdocs.generate(
                topic,
                finalResult,
                this.outputDir
            );
        }

        return finalResult;
    }

    private async writeIncrementalPage(explanation: Explanation, relativePath?: string) {
        const fileName = relativePath || `${this.mkdocs.slugify(explanation.conceptName)}.md`;

        // Safe array check for Check Your Understanding
        const safeCheckUnderstanding = Array.isArray(explanation.checkUnderstanding)
            ? explanation.checkUnderstanding
            : [];

        // Check if we have any references to display
        const r = explanation.references;
        const hasReferences = !!(
            r && (
                r.official ||
                r.bestTutorial ||
                r.quickReference ||
                r.deepDive ||
                (r.others && r.others.length > 0)
            )
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
            checkUnderstanding: safeCheckUnderstanding
        };

        const content = await this.templateManager.render('concept-page.md', context);
        await this.mkdocs.writePage(fileName, content, this.outputDir);
        logger.info(`[Incremental Doc] Written: ${fileName}`);
    }
}
