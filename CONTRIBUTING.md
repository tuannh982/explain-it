# Contributing to Explain It

We welcome contributions! Here's how to get started.

## Development Setup

1. **Prerequisites**:
   - Node.js (v18+)
   - npm

2. **Clone & Install**:
   ```bash
   git clone https://github.com/yourusername/explain-it.git
   cd explain-it
   npm install
   ```

3. **Environment**:
   Copy `.env.example` to `.env` (if provided) or create one with your `CLAUDE_API_KEY`.

## Project Structure

- `src/agents/`: Individual agent implementations.
- `src/core/`: Core infrastructure (Orchestrator, State, LLM Client).
- `src/tui/`: Terminal UI components (Ink/React).
- `src/prompts/`: Markdown prompt templates.
- `docs/`: Project documentation.

## Running Tests

We use a unified test runner that executes TypeScript tests via `tsx`.

```bash
# Run all tests
npm test
```

Tests cover:
- Unit tests for agents.
- core logic (State, Circuit Breaker).
- End-to-End Orchestrator flow (`test-phase5.ts`).

## Making Changes

1. Create a feature branch.
2. Make your changes.
3. Add a test case if applicable.
4. Run `npm test` to ensure no regressions.
5. Open a Pull Request.

## Guidelines

- **Prompt Engineering**: When modifying prompts in `src/prompts/`, always keep the JSON output format strict. Small models rely heavily on consistent structure.
- **Types**: Maintain strict typing. Avoid `any` wherever possible.
- **Logs**: Use the `logger` utility, not `console.log` directly in core logic.
