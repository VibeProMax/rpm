# RPM - Review Pull Request Manager

A locally-run web UI for reviewing GitHub Pull Requests with inline comments. Uses GitHub CLI to fetch PR data and displays it in a clean, dark-themed interface with Monaco editor for diffs.

## Features

- 🔍 **Browse and search pull requests** - Filter by state (open/closed/all) and search
- 📝 **View diffs with syntax highlighting** - Powered by Monaco Editor
- 💬 **Review comments with context** - See all PR review comments with file paths and line numbers
- 🌳 **File tree navigation** - Easy file exploration with changed file indicators
- 🎨 **Clean dark theme** - VS Code-inspired interface
- ⚡ **Fast and reliable** - Local server with automatic retry, request cancellation, and error recovery
- 🤖 **AI-powered reviews** (optional) - OpenCode integration for AI-assisted code reviews

## Prerequisites

### Required

- **[Bun](https://bun.sh)** (v1.0.0+) - JavaScript runtime and package manager
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **[GitHub CLI](https://cli.github.com)** (v2.0.0+) - For GitHub authentication and API access
  ```bash
  # macOS
  brew install gh
  ```

### Optional

- **[OpenCode](https://opencode.ai)** - For AI-powered code reviews and chat features
  ```bash
  npm install -g @opencode-ai/cli
  # or visit https://opencode.ai for installation instructions
  ```

> **Note:** RPM works perfectly fine without OpenCode. AI features will be disabled gracefully if not installed.

## Installation

### 1. Authenticate with GitHub

Before installing RPM, authenticate with GitHub CLI:

```bash
gh auth login
```

Follow the prompts to authenticate with your GitHub account.

### 2. Clone and Install

```bash
# Clone the repository
git clone <this-repo>
cd rpm

# Install dependencies
bun install

# Install the rpm command globally
bun run setup
```

This will:
- ✅ Build the web app
- ✅ Use `bun link` to install the CLI globally
- ✅ Make `rpm` available from anywhere
- ✅ Automatic PATH management
- ✅ Easy updates (just `git pull` and `bun run setup`)

The `rpm` command will be available immediately in new terminal sessions!

### 3. Verify Installation

```bash
# Check that rpm is installed
rpm --help

# Verify GitHub CLI authentication
gh auth status
```

### Updating

To update RPM to the latest version:

```bash
cd rpm
git pull
bun run setup
```

### Uninstalling

```bash
cd rpm
bun run teardown
```

## Usage

Once installed, navigate to any GitHub repository and run:

```bash
cd ~/my-github-project
rpm start              # Start server and open browser
rpm pr 42              # Open specific PR #42
rpm --help             # Show all options
```

### Development

For developing RPM itself:

```bash
# Terminal 1: Frontend (with hot reload)
bun run dev:web

# Terminal 2: Backend (from a git repo with PRs)
cd /path/to/test/repo
bun run dev:server
```

### Keyboard Shortcuts

When viewing a PR:

- `Cmd/Ctrl + Shift + P` - Open command palette
- `Cmd/Ctrl + Shift + A` - Open TUI AI chat (requires OpenCode)
- `Cmd/Ctrl + K` - Focus AI chat input (requires OpenCode)

## Configuration

RPM can be configured using environment variables. Create a `.env` file in the server directory:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100        # Max requests per window

# AI Rate Limiting
AI_RATE_LIMIT_WINDOW=3600000  # 1 hour
AI_RATE_LIMIT_MAX=20          # Max AI requests per window
```

See `.env.example` for all available options.

## How It Works

1. **CLI** starts an Express server that wraps GitHub CLI and Octokit SDK
2. **Server** fetches PR data using GitHub API:
   - PR list with metadata
   - Diffs in unified format
   - Review comments with file paths and line numbers
   - Files changed with additions/deletions
3. **Web UI** displays everything in a React app with:
   - PR list with search/filter
   - Monaco editor for viewing diffs
   - Comments panel showing review feedback
   - File tree navigation with change indicators
   - AI chat integration (optional, requires OpenCode)

## Architecture

```
rpm/
├── packages/
│   ├── cli/          # Commander-based CLI entry point
│   ├── server/       # Express API + GitHub integration
│   │   ├── routes/   # API endpoints (prs, editor, opencode)
│   │   ├── services/ # GitHub & OpenCode services
│   │   └── utils/    # Validation and helpers
│   └── web/          # React + Vite + Tailwind + Monaco
│       ├── components/ # UI components
│       ├── context/    # State management
│       └── lib/        # API client and utilities
├── docs/            # Documentation
└── tests/           # Test suites 
```

## Security

## Acknowledgments

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [React](https://react.dev) - UI library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Vite](https://vitejs.dev) - Build tool
- [TailwindCSS](https://tailwindcss.com) - Styling
- [GitHub CLI](https://cli.github.com) - GitHub integration
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [OpenCode](https://opencode.ai) - AI-powered code reviews (optional)

---

**Note:** This tool runs locally and uses your GitHub CLI authentication. No data is sent to external servers. Your code and review data remain private on your machine.
