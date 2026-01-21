# Explain It 🧠

**Explain It** is an advanced AI-powered learning assistant that uses the **Feynman Method** to explain complex topics. Built on a sophisticated 10-agent orchestration architecture, it breaks down concepts, provides analogies, and verifies its own explanations to ensure clarity and accuracy.

![TUI Screenshot placeholder](https://via.placeholder.com/800x400?text=Explain+It+TUI)

## ✨ Features

- **The Feynman Method**: Explains concepts in simple terms, using analogies and avoiding jargon.
- **Deep Research**: Uses a "Scout" agent to research topics thoroughly before explaining.
- **Self-Correction**: A "Critic" agent reviews explanations and requests improvements from an "Iterator" agent.
- **Interactive TUI**: A beautiful terminal user interface built with Ink and React.
- **Micro-Website Generation**: Automatically generates a deployable MkDocs documentation site for each topic.
- **Multi-Model Support**: Designed to work with Claude (primary), OpenAI, and others.

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/explain-it.git
cd explain-it

# Install dependencies
npm install
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```bash
# Required: Anthropic API Key
CLAUDE_API_KEY=sk-ant-...

# Optional: Other providers
OPENAI_API_KEY=sk-...
```

## 🎮 Usage

Start the interactive terminal interface:

```bash
npm start
```

1. **Enter a Topic**: e.g. "Quantum Entanglement", "React Hooks", "Dark Matter".
2. **Select Depth**:
   - Level 1: Overview (ELI5)
   - Level 3: Moderate (Default)
   - Level 5: Expert Deep Dive
3. **Watch the Process**: The system will research, plan, draft, critique, and finalize the explanation.
4. **View Output**: The final guide is saved as a Markdown file and a ready-to-serve MkDocs site.

## 🏗️ Architecture

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

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on how to set up the development environment.

## 📄 License

MIT
