# {{{conceptName}}}

{{#if elevatorPitch}}
> {{{elevatorPitch}}}

{{/if}}
## Overview
{{{simpleExplanation}}}

{{#if analogy}}
## Analogy
{{{analogy}}}

{{/if}}
{{#if imaginationScenario}}
## Imagination Scenario
{{{imaginationScenario}}}

{{/if}}
{{#if diagram}}
## Diagram
\`\`\`mermaid
{{{diagram.mermaidCode}}}
\`\`\`
{{#if diagram.caption}}
*{{{diagram.caption}}}*
{{/if}}

{{/if}}
{{#if whyExists}}
## Why it Exists
**Before:** {{{whyExists.before}}}
**The Pain:** {{{whyExists.pain}}}
**After:** {{{whyExists.after}}}

{{/if}}
{{#if codeExample}}
## Code Example ({{{codeExample.language}}})
\`\`\`{{{codeExample.language}}}
{{{codeExample.code}}}
\`\`\`
**What happens:** {{{codeExample.whatHappens}}}

{{/if}}
{{#if hasReferences}}
## References
{{#if references.official}}
- **Official**: [{{{references.official.name}}}]({{{references.official.url}}})
{{/if}}
{{#if references.bestTutorial}}
- **Tutorial**: [{{{references.bestTutorial.name}}}]({{{references.bestTutorial.url}}})
{{/if}}
{{#if references.quickReference}}
- **Quick Reference**: [{{{references.quickReference.name}}}]({{{references.quickReference.url}}})
{{/if}}
{{#if references.deepDive}}
- **Deep Dive**: [{{{references.deepDive.name}}}]({{{references.deepDive.url}}})
{{/if}}
{{#each references.others}}
- [{{{name}}}]({{{url}}})
{{/each}}

{{/if}}
## Check Your Understanding
{{#each checkUnderstanding}}
- {{{this}}}
{{/each}}
