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

import { MkDocsGenerator } from '../output/mkdocs-generator.js';

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

            // NEW: Scaffold MkDocs project early
            await this.mkdocs.scaffoldProject(topicStr, this.outputDir);

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

            // NEW: Write initial index page immediately
            await this.mkdocs.writeIndexPage(scoutReport, topicStr, this.outputDir);


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
        return this.decomposeRecursively(topic, depth, scoutReport, 0, [], "");
    }

    private async decomposeRecursively(topic: string, depth: number, scoutReport: any, currentDepth: number, parentConcepts: string[], currentPath: string, sectionPrefix: string = ""): Promise<ConceptNode[]> {
        logger.info(`[Decomposition Loop] Topic: "${topic}" | Depth: ${currentDepth}/${depth}`);

        // 1. Decompose
        const decomposition = await this.decomposer.execute({
            topic,
            depthLevel: depth,
            scoutReport,
            parentConcepts
        });

        const nodes: ConceptNode[] = [];
        const currentLevelConcepts = decomposition.concepts.map(c => c.name);
        logger.info(`[Decomposition Loop] Decomposer returned ${decomposition.concepts.length} concepts for "${topic}"`);
        logger.info(`[Decomposition Loop] Concepts: ${currentLevelConcepts.join(', ')}`);

        // Pre-filter concepts to avoid repeating ancestors and ensure sequential numbering
        const filteredConcepts = decomposition.concepts.filter(concept => {
            const isRepetitive = concept.name.toLowerCase() === topic.toLowerCase() ||
                parentConcepts.some(p => p.toLowerCase() === concept.name.toLowerCase());
            if (isRepetitive) {
                logger.debug(`[Decomposition Loop] Filtering out repetitive concept: ${concept.name}`);
            }
            return !isRepetitive;
        });

        for (let i = 0; i < filteredConcepts.length; i++) {
            const concept = filteredConcepts[i];
            const index = i + 1;
            const currentSection = sectionPrefix ? `${sectionPrefix}_${index}` : `${index}`;
            logger.info(`[Decomposition Loop] [${currentSection}] Processing: "${concept.name}"`);

            const node: ConceptNode = { ...concept };
            const slugBase = this.mkdocs.slugify(concept.name);
            const slug = `${currentSection}_${slugBase}`;

            // At currentDepth === 0 (top-level), ALWAYS create folder structure for every concept
            const isTopLevel = currentDepth === 0;
            const isWithinDepth = currentDepth < Math.max(1, Math.min(depth - 1, 3));
            const shouldCreateFolder = isTopLevel || isWithinDepth;

            if (shouldCreateFolder) {
                const subDirPath = path.join(currentPath, slug);
                logger.debug(`[Decomposition Loop] [${currentSection}] Creating folder structure. subDirPath: ${subDirPath}`);
                await this.mkdocs.ensureDirectory(subDirPath, this.outputDir);
                node.relativeFilePath = path.join(subDirPath, 'index.md');

                // Only recurse if not atomic and within depth limit
                if (!concept.isAtomic && isWithinDepth) {
                    logger.info(`[Decomposition Loop] [${currentSection}] Recursing into "${concept.name}"...`);
                    // ONLY pass ancestors to parentConcepts to avoid over-aggressive filtering of siblings
                    const nextParentConcepts = [...parentConcepts, topic];
                    node.children = await this.decomposeRecursively(concept.name, depth, scoutReport, currentDepth + 1, nextParentConcepts, subDirPath, currentSection);

                    if (!node.children || node.children.length === 0) {
                        // No children returned, but keep folder structure - just make it a leaf with index.md
                        node.isAtomic = true;
                        delete node.children;
                        logger.info(`[Decomposition Loop] [${currentSection}] Sub-decomposition returned no children. Keeping folder with index.md at: ${node.relativeFilePath}`);
                    }
                } else {
                    // Top-level atomic node: folder with index.md but no recursion
                    node.isAtomic = true;
                    logger.info(`[Decomposition Loop] [${currentSection}] Top-level node with folder structure. Path: ${node.relativeFilePath}`);
                }
            } else {
                // Deep-level atomic node: just a .md file
                node.isAtomic = true;
                node.relativeFilePath = path.join(currentPath, `${slug}.md`);
                logger.info(`[Decomposition Loop] [${currentSection}] ATOMIC node. Path: ${node.relativeFilePath}`);
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

            // NEW: Update state incrementally
            const currentState = this.stateManager.getState();
            this.stateManager.updateState({
                explanations: {
                    ...currentState.explanations,
                    [node.name]: explanation
                },
                explainedConcepts: [...currentState.explainedConcepts, node.name]
            });

            // NEW: Write incremental markdown file using hierarchical path
            await this.writeIncrementalPage(explanation, node.relativeFilePath);

            // Recurse for children
            if (node.children && node.children.length > 0) {
                await this.traverseAndExplain(node.children, depth);
            }
        }
    }

    private async writeIncrementalPage(explanation: Explanation, relativePath?: string) {
        const fileName = relativePath || `${this.mkdocs.slugify(explanation.conceptName)}.md`;

        const content = `
# ${explanation.conceptName}

${explanation.elevatorPitch ? `> ${explanation.elevatorPitch}\n` : ''}

## Overview
${explanation.simpleExplanation}

${explanation.analogy ? `## Analogy\n${explanation.analogy}\n` : ''}

${explanation.diagram ? `## Diagram\n\`\`\`mermaid\n${explanation.diagram.mermaidCode}\n\`\`\`\n*${explanation.diagram.caption}*\n` : ''}

${explanation.whyExists ? `## Why it Exists\n**Before:** ${explanation.whyExists.before}\n**The Pain:** ${explanation.whyExists.pain}\n**After:** ${explanation.whyExists.after}\n` : ''}

${explanation.codeExample ? `## Code Example (${explanation.codeExample.language})\n\`\`\`${explanation.codeExample.language}\n${explanation.codeExample.code}\n\`\`\`\n**What happens:** ${explanation.codeExample.whatHappens}\n` : ''}

## Check Your Understanding
${(explanation.checkUnderstanding || []).map(q => `- ${q}`).join('\n')}
        `.trim();

        await this.mkdocs.writePage(fileName, content, this.outputDir);
        logger.info(`[Incremental Doc] Written: ${fileName}`);
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
