# Noteva AI Agent for Obsidian

Graph-aware AI sidebar plugin for Obsidian, adapted from the AI Agent architecture used in Noteva.

## Implemented
- Left-sidebar `ItemView` with ribbon button and commands
- Persistent multi-chat storage with create, rename, delete, search, and clear
- OpenRouter integration with:
  - API key storage via Obsidian secret storage when available
  - model list refresh
  - manual model override
  - streaming responses
  - connection test
- Context modes:
  - no context
  - current note
  - current note + linked notes
  - current note + backlinks
  - current folder
  - vault-wide context
  - graph neighborhood
- Graph-aware vault index using Obsidian `metadataCache`
- Memory panel with add, edit, delete, and clear
- Note tools:
  - find related notes
  - backlinks
  - topic map
  - wikilink suggestions
  - orphan notes
  - create MOC note
  - create note
  - append to note
- Confirmation modal before AI writes to notes

## Commands
- `Open AI Agent`
- `New chat`
- `Summarize current note`
- `Explain selection`
- `Find related notes`

## Local development
```bash
npm install
npm run dev
```

For a production bundle:
```bash
npm run build
```

Copy or symlink these files into your vault:
```text
<Vault>/.obsidian/plugins/noteva-ai-agent/
  main.js
  manifest.json
  styles.css
```

For smoother local iteration, use the Obsidian Hot Reload plugin by pjeby.

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

## Current scope
This plugin intentionally ports the Noteva AI Agent core without calendar tools. It is focused on vault context, graph awareness, memory, and note operations.

## Release artifacts
GitHub releases must attach:
- `main.js`
- `manifest.json`
- `styles.css`

## License
MIT
