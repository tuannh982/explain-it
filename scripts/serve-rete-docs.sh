#!/bin/bash
set -e

# Resolve the project root assuming the script is in [root]/scripts/
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/output/rete-test"

# Verify docs directory exists
if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: Directory $DOCS_DIR does not exist."
    exit 1
fi

echo "Targeting docs at: $DOCS_DIR"

# Navigate to the docs directory
cd "$DOCS_DIR"

# Check if venv exists, if not create it
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install mkdocs and theme if not present
# We check for mkdocs-material specifically since the yml uses 'material' theme
if ! command -v mkdocs &> /dev/null || ! pip show mkdocs-material &> /dev/null; then
    echo "Installing requirements from requirements.txt..."
    pip install -r "$SCRIPT_DIR/requirements.txt"
fi

echo "Starting mkdocs server..."
mkdocs serve
