import { BaseAgent } from '../core/agent/base-agent.js';
import { ScoutReport, Decomposition, Explanation, BuilderOutput, SynthesizerResult, ConceptNode } from '../core/types.js';

export class SynthesizerAgent extends BaseAgent {
    async execute(input: {
        scoutReport: ScoutReport,
        decomposition: Decomposition,
        explanations: Explanation[],
        builderOutput: BuilderOutput
    }): Promise<SynthesizerResult> {

        // Generate Index/Overview via LLM
        const { system, user } = await this.prompts.loadTemplate('synthesizer', {
            scoutJson: JSON.stringify(input.scoutReport, null, 2),
            decompositionJson: JSON.stringify(input.decomposition, null, 2),
            // We only pass names/summaries for the index, not full explanations to save context/focus
            explanationsJson: JSON.stringify(input.explanations.map(e => ({ name: e.conceptName, simple: e.simpleExplanation })), null, 2),
            builderJson: JSON.stringify(input.builderOutput, null, 2)
        });

        const response = await this.llm.advance([
            { role: 'system', content: system },
            { role: 'user', content: user }
        ]);
        const indexContent = response.content;

        // Generate Pages from Concept Tree
        // The decomposition.concepts is passed as the root of the tree (ConceptNode[])
        const rootNodes = input.decomposition.concepts as unknown as ConceptNode[];
        const pages: { id: string, title: string, fileName: string, content: string }[] = [];

        const processNode = (node: ConceptNode) => {
            // Respect the path calculated during decomposition
            const fileName = node.relativeFilePath || `${this.slugify(node.name)}.md`;

            // Generate Content (reuse existing format)
            if (node.explanation) {
                const exp = node.explanation;

                // Collect references
                const refs: string[] = [];
                if (exp.references) {
                    if (exp.references.official) refs.push(`- **Official**: [${exp.references.official.name}](${exp.references.official.url}) (Score: ${exp.references.official.qualityScore})`);
                    if (exp.references.bestTutorial) refs.push(`- **Tutorial**: [${exp.references.bestTutorial.name}](${exp.references.bestTutorial.url})`);
                    if (exp.references.quickReference) refs.push(`- **Quick Reference**: [${exp.references.quickReference.name}](${exp.references.quickReference.url})`);
                    if (exp.references.others) {
                        exp.references.others.forEach(r => refs.push(`- [${r.name}](${r.url})`));
                    }
                }

                const content = `# ${exp.conceptName}

${exp.elevatorPitch ? `> ${exp.elevatorPitch}\n` : ''}

## Simple Explanation
${exp.simpleExplanation}

${exp.analogy ? `## Analogy\n${exp.analogy}\n` : ''}
${exp.imaginationScenario ? `## Imagination Scenario\n${exp.imaginationScenario}\n` : ''}

${exp.whyExists ? `## Why It Exists\n**Before**: ${exp.whyExists.before}\n\n**Pain**: ${exp.whyExists.pain}\n\n**After**: ${exp.whyExists.after}\n` : ''}

${exp.diagram ? `## Diagram\n![${exp.diagram.caption}](mermaid)\n\`\`\`mermaid\n${exp.diagram.mermaidCode}\n\`\`\`\n` : ''}

${exp.complexity ? `**Complexity**: ${exp.complexity.replace('_', ' ')}\n` : ''}
${exp.prerequisites && exp.prerequisites.length > 0 ? `**Prerequisites**: ${exp.prerequisites.join(', ')}\n` : ''}

${exp.codeExample ? `## Code Example\n\`\`\`${exp.codeExample.language}\n${exp.codeExample.code}\n\`\`\`\n\n${exp.codeExample.whatHappens}\n` : ''}

${refs.length > 0 ? `## References\n${refs.join('\n')}\n` : ''}

## Check Your Understanding
${(exp.checkUnderstanding || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}
`;

                pages.push({
                    id: node.id,
                    title: node.name,
                    fileName,
                    content
                });
            }

            // Recurse
            if (node.children) {
                node.children.forEach(child => processNode(child));
            }
        };

        rootNodes.forEach(node => processNode(node));

        // Calculate stats
        const totalWordCount = indexContent.split(/\s+/).length + pages.reduce((acc, p) => acc + p.content.split(/\s+/).length, 0);
        const readingTime = `${Math.ceil(totalWordCount / 200)} min read`;

        // TOC is concepts list - flatten or just empty
        const toc: string[] = [];

        return {
            indexContent,
            pages,
            tableOfContents: toc,
            stats: {
                wordCount: totalWordCount,
                readingTime
            }
        };
    }

    private slugify(text: string): string {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
}
