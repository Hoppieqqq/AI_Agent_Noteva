# Noteva AI Agent for Obsidian

Noteva AI Agent is a graph-aware OpenRouter chat plugin for Obsidian. It brings persistent multi-chat workflows, vault context, backlinks, linked-note awareness, memory, and safe note-writing actions into a native Obsidian sidebar.

## What it does
- Opens a dedicated AI sidebar view from the left ribbon
- Stores multiple chats locally inside the plugin data folder
- Streams OpenRouter responses into the chat UI
- Understands Obsidian structure through:
  - current note context
  - linked notes
  - backlinks
  - current folder
  - vault-wide note selection
  - graph neighborhood traversal
- Lets the agent use note tools to:
  - find related notes
  - inspect backlinks
  - build a topic map
  - suggest missing wikilinks
  - find orphan notes
  - create MOC notes
  - create new notes
  - append content to existing notes
- Requires confirmation before AI writes to notes
- Maintains manual and extracted memory facts that can be injected into future prompts

## Installation

### From GitHub release
Download these files from the latest release and place them in:

```text
<Vault>/.obsidian/plugins/noteva-ai-agent/
```

Required files:
- `main.js`
- `manifest.json`
- `styles.css`

Then open Obsidian and enable **Noteva AI Agent** in Community Plugins.

### For local development
```bash
npm install
npm run dev
```

For a production build:
```bash
npm run build
```

For faster local iteration, use the Obsidian Hot Reload plugin by pjeby.

## Setup
1. Open the plugin settings
2. Paste your OpenRouter API key
3. Refresh the model list or enter a model manually
4. Choose the context mode you want
5. Start a new chat from the sidebar

## Commands
- `Open AI Agent`
- `New chat`
- `Summarize current note`
- `Explain selection`
- `Find related notes`

## Settings
- OpenRouter API key
- Available models + refresh
- Manual model override
- System prompt
- Context mode
- Graph depth
- Token budget
- Streaming toggle
- Tool toggle
- Confirm-before-write toggle
- Memory toggle
- Auto-extract memory toggle
- Temperature
- Max completion tokens
- Debug toggles
- Rebuild index
- Test OpenRouter connection

## Storage and privacy
- Chat data and settings are stored locally in the plugin data folder
- The API key is stored through Obsidian secret storage when available, with a local fallback
- No telemetry is included
- Requests go only to OpenRouter when you send a message or refresh models

## Current scope
This plugin ports the Noteva AI Agent core into Obsidian. Calendar tools are intentionally excluded in this plugin and note-aware tools are prioritized instead.

## Release artifacts
GitHub releases attach:
- `main.js`
- `manifest.json`
- `styles.css`

## License
MIT
