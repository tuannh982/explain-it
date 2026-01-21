import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { SynthesizerResult } from '../core/types';

export class MkDocsGenerator {
  async generate(topic: string, result: SynthesizerResult, outputDir: string): Promise<string> {
    logger.info(`Generating MkDocs site for: ${topic}`);

    const docsDir = path.join(outputDir, 'docs');
    const assetsDir = path.join(docsDir, 'assets');

    // 1. Scaffold Directories
    await fs.ensureDir(docsDir);
    await fs.ensureDir(assetsDir);

    // 2. Write Markdown Files
    // Index
    await fs.writeFile(path.join(docsDir, 'index.md'), result.indexContent);

    // Pages
    for (const page of result.pages) {
      const fullPath = path.join(docsDir, page.fileName);
      // Ensure parent dir exists (critical for nested pages like rete/alpha/index.md)
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, page.content);
    }

    // 3. Generate mkdocs.yml
    // We omit the 'nav' section to allow MkDocs to automatically generate the navigation
    // based on the directory structure, which supports nesting out-of-the-box.
    const mkdocsConfig = `
site_name: "${topic} - Explained"
theme:
  name: material
  features:
    - navigation.expand
    - content.code.copy
markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.inlinehilite
  - pymdownx.snippets
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
    `;

    await fs.writeFile(path.join(outputDir, 'mkdocs.yml'), mkdocsConfig.trim());

    logger.info(`MkDocs site generated at: ${outputDir}`);
    return outputDir;
  }
}
