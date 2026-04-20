# Research Notes

## Obsidian API and plugin architecture
- Use `ItemView` + `WorkspaceLeaf` for a first-class sidebar panel. This is the official way to mount custom functionality inside Obsidian UI.
- Register the view with `this.registerView(viewType, leaf => new View(...))`, then activate it through `workspace.getLeftLeaf(false)` or by reusing an existing leaf.
- Use `PluginSettingTab` and `Setting`/`SecretComponent` for plugin settings. `SecretStorage` is available on `app.secretStorage` starting with Obsidian `1.11.4`, which sets the practical minimum app version if we want built-in secret storage.
- Persist regular plugin data with `loadData()` / `saveData()`. For larger structured payloads, plugin data can be sharded into files under the plugin directory via the vault adapter, but the first implementation can use `data.json` safely if repositories are compact.
- Use `metadataCache` and `vault` events (`changed`, `resolved`, `create`, `rename`, `delete`) to build and maintain a graph-aware index.
- Community plugin manifest requires `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly`. Plugin IDs must not contain `obsidian`.
- Community releases should attach `main.js`, `manifest.json`, and `styles.css` directly to the GitHub release.

## esbuild and TypeScript
- Obsidian sample plugin bundles a single CommonJS `main.js` with `esbuild`, marks `obsidian` and Node built-ins as external, and uses `tsc --noEmit` for type-checking.
- React 18 can be mounted into a view DOM node with `createRoot(containerEl)` and unmounted in `onClose()`.

## OpenRouter API
- `POST /api/v1/chat/completions` is the main endpoint for completions and tool calling.
- `GET /api/v1/models` lists available models and limits.
- Official headers for app identification: `HTTP-Referer` and `X-Title`.
- Streaming uses SSE; the client should parse `data:` chunks until `[DONE]`.
- Error handling needs explicit mapping for 400/401/402/404/429/5xx and connectivity/timeout cases.

## Security and storage
- Preferred secret storage path in modern Obsidian is `app.secretStorage`.
- If `secretStorage` is unavailable, fallback should be explicit and documented. We will use a reversible obfuscation fallback only to avoid blocking older environments, but the plugin will target 1.11.4+ and therefore normally use real secret storage.

## Existing plugin patterns
- AI plugins for Obsidian commonly use a sidebar ItemView, command palette integration, vault-context gathering via `metadataCache`, and provider/model settings in the plugin setting tab.
- The right way to port Noteva is not to copy Electron IPC, but to keep the provider logic, memory logic, and context logic while replacing storage, eventing, and UI integration with Obsidian-native services.

## Concrete decisions for Noteva AI Agent plugin
- Plugin repository: `AI_Agent_Noteva`
- Plugin ID: `noteva-ai-agent` (cannot contain `obsidian`)
- Minimum app version: `1.11.4` due `SecretStorage`
- Rendering stack: React 18 mounted inside `ItemView`
- Storage: `loadData`/`saveData` for settings, chats, and memory in v1; repository abstraction will allow sharding later
- No calendar tools in v1
- Graph awareness is first-class: linked notes, backlinks, orphan detection, hub notes, local subgraph context
