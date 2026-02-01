import path from "node:path";
import fs from "fs-extra";
import type { SynthesizerResult } from "../core/types.js";
import { logger } from "../utils/logger.js";

export class MkDocsGenerator {
	/**
	 * Initializes the MkDocs project structure and basic config.
	 */
	async scaffoldProject(topic: string, outputDir: string): Promise<void> {
		const docsDir = path.join(outputDir, "docs");
		const assetsDir = path.join(docsDir, "assets");

		await fs.ensureDir(docsDir);
		await fs.ensureDir(assetsDir);

		// Initial mkdocs.yml without full nav (will be updated or finalized later)
		await this.writeConfig(topic, outputDir, [{ Home: "index.md" }]);

		// Initial index.md placeholder
		await fs.writeFile(
			path.join(docsDir, "index.md"),
			`# ${topic}\n\nDocumentation being generated...`,
		);
	}

	async ensureDirectory(
		relativeSubPath: string,
		outputDir: string,
	): Promise<string> {
		const fullPath = path.join(outputDir, "docs", relativeSubPath);
		await fs.ensureDir(fullPath);
		return fullPath;
	}

	async writePage(
		relativeFilePath: string,
		content: string,
		outputDir: string,
	): Promise<string> {
		const fullPath = path.join(outputDir, "docs", relativeFilePath);
		await fs.ensureDir(path.dirname(fullPath));
		await fs.writeFile(fullPath, content);
		return fullPath;
	}

	async generate(
		topic: string,
		result: SynthesizerResult,
		outputDir: string,
	): Promise<string> {
		logger.info(`Finalizing MkDocs site for: ${topic}`);

		const docsDir = path.join(outputDir, "docs");

		// 1. Write Index
		await fs.writeFile(path.join(docsDir, "index.md"), result.indexContent);

		// 2. Write/Overwrite Pages (Final versions)
		for (const page of result.pages) {
			await this.writePage(page.fileName, page.content, outputDir);
		}

		// 3. Generate final mkdocs.yml with full nav
		// 3. Generate final mkdocs.yml with full nav
		const nav = [
			{
				Home: [
					{ Overview: "index.md" },
					...this.buildNavFromPages(result.pages),
				],
			},
		];

		await this.writeConfig(topic, outputDir, nav);

		logger.info(`MkDocs site finalized at: ${outputDir}`);
		return outputDir;
	}

	async writeIndexPage(
		explanation: any,
		topic: string,
		outputDir: string,
	): Promise<void> {
		const docsDir = path.join(outputDir, "docs");

		// Format references
		const refs: string[] = [];
		if (explanation.references) {
			const r = explanation.references;
			if (r.official)
				refs.push(`- **Official**: [${r.official.name}](${r.official.url})`);
			if (r.bestTutorial)
				refs.push(
					`- **Tutorial**: [${r.bestTutorial.name}](${r.bestTutorial.url})`,
				);
			if (r.quickReference)
				refs.push(
					`- **Quick Reference**: [${r.quickReference.name}](${r.quickReference.url})`,
				);
			if (r.deepDive)
				refs.push(`- **Deep Dive**: [${r.deepDive.name}](${r.deepDive.url})`);
			if (r.others) {
				// biome-ignore lint/suspicious/noExplicitAny: complex type
				r.others.forEach((other: any) => {
					refs.push(`- [${other.name}](${other.url})`);
				});
			}
		}

		const content = `
# ${topic}

${explanation.elevatorPitch ? `> ${explanation.elevatorPitch}\n` : ""}

## Overview
${explanation.simpleExplanation}

${explanation.analogy ? `## Analogy\n${explanation.analogy}\n` : ""}

${explanation.diagram ? `## Diagram\n\`\`\`mermaid\n${explanation.diagram.mermaidCode}\n\`\`\`\n*${explanation.diagram.caption}*\n` : ""}

${explanation.whyExists ? `## Why it Exists\n**Before:** ${explanation.whyExists.before}\n**The Pain:** ${explanation.whyExists.pain}\n**After:** ${explanation.whyExists.after}\n` : ""}

${refs.length > 0 ? `## References\n${refs.join("\n")}\n` : ""}

**Note: Full detailed documentation is being generated...**
    `.trim();

		await fs.writeFile(path.join(docsDir, "index.md"), content);
		logger.info(`[MkDocs] Written initial index.md for ${topic}`);
	}

	// biome-ignore lint/suspicious/noExplicitAny: legacy structure
	private buildNavFromPages(pages: any[]): any[] {
		// Map directory paths to their corresponding pages
		// biome-ignore lint/suspicious/noExplicitAny: legacy structure
		const nodes = new Map<string, { page: any; children: any[] }>();

		// Initial pass: Create nodes for all pages
		pages.forEach((page) => {
			// Assuming fileName is like "folder/index.md", we use the folder as the key
			const dir = path.dirname(page.fileName);
			nodes.set(dir, { page, children: [] });
		});

		// biome-ignore lint/suspicious/noExplicitAny: legacy structure
		const roots: any[] = [];

		// Build the tree hierarchy
		// Sort directories to ensure deterministic order (e.g. 1_, 1_1_, 2_)
		const sortedDirs = Array.from(nodes.keys()).sort();

		sortedDirs.forEach((dir) => {
			// biome-ignore lint/style/noNonNullAssertion: guaranteed by keys()
			const node = nodes.get(dir)!;
			const parentDir = path.dirname(dir);

			if (nodes.has(parentDir)) {
				nodes.get(parentDir)?.children.push(node);
			} else {
				roots.push(node);
			}
		});

		// Recursive function to format the nav structure
		// biome-ignore lint/suspicious/noExplicitAny: recursive structure
		const buildTree = (node: any): any => {
			// Leaf node: just the page
			if (node.children.length === 0) {
				return { [node.page.title]: node.page.fileName };
			}

			// Branch node: Section with Overview + Children
			// biome-ignore lint/suspicious/noExplicitAny: recursive structure
			const childrenNav = node.children.map((child: any) => buildTree(child));

			return {
				[node.page.title]: [{ Overview: node.page.fileName }, ...childrenNav],
			};
		};

		return roots.map((root) => buildTree(root));
	}

	async writeConfig(
		topic: string,
		outputDir: string,
		nav: any[],
	): Promise<void> {
		const mkdocsConfig = `
site_name: "${topic} - Explained"
theme:
  name: material
  palette:
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
  features:
    - navigation.expand
    - navigation.tabs
    - navigation.sections
    - navigation.top
    - navigation.footer
    - content.code.copy
    - content.code.annotate

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
      line_spans: __span
      pygments_lang_class: true
  - pymdownx.inlinehilite
  - pymdownx.snippets
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.emoji:
      emoji_index: !!python/name:material.extensions.emoji.twemoji
      emoji_generator: !!python/name:material.extensions.emoji.to_svg
  - admonition
  - def_list
  - attr_list
  - md_in_html

nav:
${this.formatNav(nav, 2)}
    `;

		await fs.writeFile(path.join(outputDir, "mkdocs.yml"), mkdocsConfig.trim());
	}

	private formatNav(nav: any[], indent: number): string {
		return nav
			.map((item) => {
				const key = Object.keys(item)[0];
				const value = item[key];
				const spaces = " ".repeat(indent);
				if (typeof value === "string") {
					return `${spaces}- ${key}: ${value}`;
				} else {
					return `${spaces}- ${key}:\n${this.formatNav(value, indent + 2)}`;
				}
			})
			.join("\n");
	}

	public slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}
}
