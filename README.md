# Explain It

**Explain It** is an AI-powered learning assistant that uses the **Feynman Method** to explain complex topics. Built on a multi-agent orchestration architecture, it breaks down concepts, provides analogies, and verifies its own explanations to ensure clarity and accuracy.

## Features

- **The Feynman Method**: Explains concepts in simple terms, using analogies and avoiding jargon.
- **Deep Research**: Uses a "Scout" agent to research topics thoroughly before explaining.
- **Self-Correction**: A "Critic" agent reviews explanations and requests improvements from an "Iterator" agent.
- **Interactive TUI**: A terminal user interface built with Ink and React.
- **MkDocs Site Generation**: Automatically generates a deployable MkDocs documentation site for each topic.
- **Multi-Model Support**: Designed to work with Claude (primary), with OpenAI support planned.

## Prerequisites

- Node.js >= 18.0.0
- npm

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/explain-it.git
cd explain-it

# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the root directory:

```bash
# Required: Anthropic API Key
CLAUDE_API_KEY=sk-ant-...

# Optional: Other providers
OPENAI_API_KEY=sk-...
```

## Usage

### Run in Development Mode

```bash
npm start
```

### Run the Compiled Version

```bash
# Build TypeScript first
npm run build

# Run with Node.js
node dist/index.js
```

### How It Works

1. **Enter a Topic**: e.g. "Quantum Entanglement", "React Hooks", "Dark Matter".
2. **Select Depth**:
   - Level 1: Overview (ELI5)
   - Level 3: Moderate (Default)
   - Level 5: Expert Deep Dive
3. **Watch the Process**: The system will research, plan, draft, critique, and finalize the explanation.
4. **View Output**: The final guide is saved as a MkDocs site in the `output/` directory.

## Building

### Build TypeScript

Compile TypeScript to JavaScript in the `dist/` directory:

```bash
npm run build
```

### Build Portable Bundle

Create a single-file bundle that can be distributed and run on any system with Node.js:

```bash
npm run build:bundle
```

This creates `bundle/index.js` which contains all dependencies bundled together. To run it:

```bash
node bundle/index.js
```

**Note**: Ensure your `.env` file is in the working directory, or set the `CLAUDE_API_KEY` environment variable.

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run in development mode (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run build:bundle` | Create single-file portable bundle |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Check code style (Biome) |
| `npm run format` | Format code (Biome) |
| `npm run check` | Lint + format check |
| `npm run check:fix` | Auto-fix lint and format issues |

### Serving Generated Docs

After generating documentation for a topic, you can preview it locally:

```bash
./scripts/serve-rete-docs.sh
```

This script sets up a Python virtual environment, installs MkDocs, and serves the generated documentation at `http://localhost:8000`.

## Architecture

The system uses a **Multi-Agent Orchestrator** pattern:

1. **Clarifier**: Ensures user intent is clear.
2. **Scout**: Researches the topic.
3. **Decomposer**: Breaks the topic into sub-concepts.
4. **Validator**: Checks if the breakdown is accurate.
5. **Explainer**: Drafts the initial explanation.
6. **Critic**: Reviews the draft for clarity and correctness.
7. **Iterator**: Refines the draft based on feedback.
8. **Re-Decomposer**: Adjusts the plan if the topic is too complex.
9. **Builder**: Assembles the final guide.
10. **Synthesizer**: Polishes the final output.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on how to set up the development environment.

## License

MIT
