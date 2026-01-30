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

    async start(initialQuery: string, depth?: number) {
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
            const targetDepth = depth || clarification.suggestedDepth || 3;

            // NEW: Scaffold MkDocs project early
            await this.mkdocs.scaffoldProject(topicStr, this.outputDir);

            this.stateManager.updateState({
                topic: {
                    originalQuery: initialQuery,
                    confirmedTopic: topicStr,
                    depthLevel: targetDepth as any,
                    isClear: true
                }
            });

            // 2. Discovery (Explainer now handles initial research)
            this.updatePhase('scout');
            const scoutReport = await this.explainer.execute({
                concept: { name: topicStr },
                depthLevel: targetDepth,
                previousConcepts: []
            });
            this.stateManager.updateState({ scoutReport });

            // NEW: Write initial index page immediately
            await this.mkdocs.writeIndexPage(scoutReport, topicStr, this.outputDir);


            // 3 & 4. Unified Decomposition & Explanation Loop
            const conceptTree = await this.runUnifiedLoop(topicStr, targetDepth, scoutReport);

            // 5. Build
            this.updatePhase('build');
            const state = this.stateManager.getState();
            // Convert explainer map to array
            const explanations = Object.values(state.explanations);

            if (explanations.length === 0) {
                // If it's a very simple topic with no subconcepts, we might not have extra explanations,
                // but usually there should be at least some.
                logger.warn('No sub-concept explanations generated.');
            }

            const builderOutput = await this.builder.execute({ explanations, depthLevel: targetDepth });
            this.stateManager.updateState({ builderOutput });

            // 6. Synthesize
            this.updatePhase('synthesize');
            const finalResult = await this.synthesizer.execute({
                scoutReport,
                decomposition: {
                    concepts: conceptTree as any, // Recursive tree passed here
                    depthLevel: targetDepth as any,
                    totalConcepts: conceptTree.length, // Rough count
                    learningSequence: [],
                    inScope: [],
                    outOfScope: []
                },
                explanations,
                builderOutput
            });

            this.updatePhase('complete');

            // 7. Generate MkDocs Site (Final update)
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

    private async runUnifiedLoop(rootTopic: string, totalDepth: number, scoutReport: any): Promise<ConceptNode[]> {
        this.updatePhase('generate');
        this.exploredConcepts.clear();
        this.addToExplored(rootTopic);

        const rootNodes: ConceptNode[] = [];
        const queue: DecomposeTask[] = [{
            topic: rootTopic,
            currentDepth: 0,
            parentConcepts: [],
            currentPath: "",
            sectionPrefix: "",
            targetNodes: rootNodes,
            rootTopic: rootTopic
        }];

        // The root concept itself is already explained in scoutReport and written to index.md
        // So we start by decomposing the root topic to find the first level of concepts.
        const rootTask = queue.shift()!;
        await this.decomposeToQueue(rootTask, totalDepth, scoutReport, queue);

        // Now process the queue: Explain then Decompose (if needed)
        while (queue.length > 0) {
            const task = queue.shift()!;
            const { topic, currentDepth, parentConcepts, currentPath, sectionPrefix, targetNodes } = task;

            logger.info(`[Unified Loop] Processing: "${topic}" | Depth: ${currentDepth}/${totalDepth}`);
            this.events.emit('step_progress', { message: `Explaining: ${topic}` });

            // 1. Create directory
            const slugBase = this.mkdocs.slugify(topic);
            const slug = `${sectionPrefix}_${slugBase}`;
            const subDirPath = path.join(currentPath, slug);
            await this.mkdocs.ensureDirectory(subDirPath, this.outputDir);

            // 2. Explain
            const node: ConceptNode = {
                id: slug, // Use slug as ID for simplicity
                name: topic,
                oneLiner: "", // Will be filled by explainer or kept empty
                isAtomic: true,
                dependsOn: [],
                relativeFilePath: path.join(subDirPath, 'index.md')
            };

            let explanation = await this.explainer.execute({
                concept: node,
                depthLevel: totalDepth,
                previousConcepts: parentConcepts
            });

            // Critic Loop
            let passed = false;
            let iterations = 0;
            while (!passed && iterations < 2) {
                const critique = await this.critic.execute({ explanation, conceptName: topic, depthLevel: totalDepth });
                if (critique.verdict === 'PASS') {
                    passed = true;
                } else {
                    logger.info(`[Unified Loop] Critic requested revision for: ${topic} (Iteration ${iterations + 1})`);
                    const iterationResult = await this.iterator.execute({ explanation, critique, iteration: iterations + 1 });
                    explanation = iterationResult.revisedExplanation;
                    iterations++;
                }
            }
            node.explanation = explanation;

            // 3. Write index.md immediately
            await this.writeIncrementalPage(explanation, node.relativeFilePath);

            // 4. Update State
            const currentState = this.stateManager.getState();
            this.stateManager.updateState({
                explanations: {
                    ...currentState.explanations,
                    [topic]: explanation
                },
                explainedConcepts: [...currentState.explainedConcepts, topic]
            });

            targetNodes.push(node);

            // 5. Decompose (if depth allows)
            if (currentDepth < totalDepth) {
                node.children = [];
                await this.decomposeToQueue({
                    ...task,
                    topic: topic,
                    currentDepth: currentDepth,
                    currentPath: subDirPath,
                    sectionPrefix: sectionPrefix,
                    targetNodes: node.children,
                }, totalDepth, scoutReport, queue);

                if (node.children.length > 0) {
                    node.isAtomic = false;
                }
            }
        }

        return rootNodes;
    }

    private async decomposeToQueue(task: DecomposeTask, totalDepth: number, scoutReport: any, queue: DecomposeTask[]) {
        const { topic, currentDepth, parentConcepts, currentPath, sectionPrefix, rootTopic } = task;

        const decomposition = await this.decomposer.execute({
            topic,
            depthLevel: totalDepth,
            scoutReport,
            parentConcepts,
            rootTopic,
            alreadyExplored: Array.from(this.exploredConcepts)
        });

        const filteredConcepts = decomposition.concepts.filter(concept => {
            const isRepetitive = concept.name.toLowerCase() === topic.toLowerCase() ||
                parentConcepts.some((p: string) => p.toLowerCase() === concept.name.toLowerCase());

            if (isRepetitive) return false;
            if (this.isSimilar(concept.name)) return false;
            return true;
        });

        // NEW: Sort by learningSequence if available
        if (decomposition.learningSequence && decomposition.learningSequence.length > 0) {
            const seq = decomposition.learningSequence;
            filteredConcepts.sort((a, b) => {
                const idxA = seq.indexOf(a.id);
                const idxB = seq.indexOf(b.id);
                return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
        }

        for (let i = 0; i < filteredConcepts.length; i++) {
            const concept = filteredConcepts[i];
            this.addToExplored(concept.name);

            const index = i + 1;
            const currentSection = sectionPrefix ? `${sectionPrefix}_${index}` : `${index}`;

            queue.push({
                topic: concept.name,
                currentDepth: currentDepth + 1,
                parentConcepts: [...parentConcepts, topic],
                currentPath: currentPath,
                sectionPrefix: currentSection,
                targetNodes: task.targetNodes, // Crucial: push siblings into the same array
                rootTopic
            });
        }
    }

    private async writeIncrementalPage(explanation: Explanation, relativePath?: string) {
        const fileName = relativePath || `${this.mkdocs.slugify(explanation.conceptName)}.md`;

        // Format references
        const refs: string[] = [];
        if (explanation.references) {
            const r = explanation.references;
            if (r.official) refs.push(`- **Official**: [${r.official.name}](${r.official.url})`);
            if (r.bestTutorial) refs.push(`- **Tutorial**: [${r.bestTutorial.name}](${r.bestTutorial.url})`);
            if (r.quickReference) refs.push(`- **Quick Reference**: [${r.quickReference.name}](${r.quickReference.url})`);
            if (r.deepDive) refs.push(`- **Deep Dive**: [${r.deepDive.name}](${r.deepDive.url})`);
            if (r.others) {
                r.others.forEach(other => refs.push(`- [${other.name}](${other.url})`));
            }
        }

        const content = `
# ${explanation.conceptName}

${explanation.elevatorPitch ? `> ${explanation.elevatorPitch}\n` : ''}

## Overview
${explanation.simpleExplanation}

${explanation.analogy ? `## Analogy\n${explanation.analogy}\n` : ''}

${explanation.imaginationScenario ? `## Imagination Scenario\n${explanation.imaginationScenario}\n` : ''}

${explanation.diagram ? `## Diagram\n\`\`\`mermaid\n${explanation.diagram.mermaidCode}\n\`\`\`\n${explanation.diagram.caption ? `*${explanation.diagram.caption}*\n` : ''}` : ''}

${explanation.whyExists ? `## Why it Exists\n**Before:** ${explanation.whyExists.before}\n**The Pain:** ${explanation.whyExists.pain}\n**After:** ${explanation.whyExists.after}\n` : ''}

${explanation.codeExample ? `## Code Example (${explanation.codeExample.language})\n\`\`\`${explanation.codeExample.language}\n${explanation.codeExample.code}\n\`\`\`\n**What happens:** ${explanation.codeExample.whatHappens}\n` : ''}

${refs.length > 0 ? `## References\n${refs.join('\n')}\n` : ''}

## Check Your Understanding
${(explanation.checkUnderstanding || []).filter(q => !!q).map(q => `- ${q}`).join('\n')}
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

