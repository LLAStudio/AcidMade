# AcidMade Engine

This is the engine reference. It covers the scene graph, nodes, signals, inspector, viewports, scripting, the agent runtime, persistence, projects and the build semantics.

## Scene graph

An AcidMade application is a tree of typed nodes.

- The root is a `root` node.
- Every node has a kind, a class name, an icon key, a status, a visibility flag, an attached script resource, and a list of signal definitions.
- Nodes can have children. The tree is the authoritative structure the editor and the preview both render from.

The default scene file is `res://scenes/MainApp.acid`. It is the application root and owns the workspace lifecycle.

### Node kinds

| Kind | Meaning |
| --- | --- |
| `root` | Application or scene root. |
| `ui` | Layout containers and screens. |
| `component` | Reusable UI pieces. |
| `api` | Endpoints and edge services. |
| `data` | Data layer nodes. |
| `agent` | Autonomous or assisted agents. |

### Node identity

Each node carries:

- `id` — stable node identifier, alphanumeric with `_` and `-`.
- `name` — the human label shown in the editor and preview annotations.
- `className` — the class this node represents.
- `icon` — icon key used in the editor chrome.
- `summary` — one-line description.
- `status` — current node status.
- `visible` — whether the node is visible in the viewport.
- `file` — the attached resource id, when present.
- `script` — the `res://` path of the attached script, when present.
- `signals` — signal definitions attached to this node.
- `children` — child nodes, when present.

Status values:

- `idle`
- `running`
- `healthy`
- `error`

### Visual semantics

The editor uses node kind and icon to drive tree icons, the inspector layout, and the viewport selection annotations.

- Root nodes get the acid ring in the viewport.
- New nodes added outside the built-in region are annotated as "new node · not composited" until the scene is rebuilt.
- Hidden nodes show a viewport warning banner.

## Signals

Signals are the wiring layer. A signal definition has:

- `id` — stable signal identifier.
- `name` — the signal name, e.g. `on_ready`, `on_build_error`.
- `args` — argument signature string.
- `description` — short human description.
- `connections` — list of `{ nodeId, method }` targets.

Signals describe intent. A connection says which node method is invoked when the signal fires. The editor and runtime treat signals as typed wiring, and the AI panel can stage a single signal-aware change only after confirmation.

### Signal discipline

- Keep signals named like events: `on_` for emitted events, verb phrases for actions when appropriate.
- Connections reference the target node by id, not by name.
- Diagnostics can mention signal wiring. The AI context includes the first five open problems.

## Inspector

The inspector is the right dock. It shows the selected node's class, kind, status, visibility, script resource, and editable properties with current overrides.

### Overrides

Overrides are per-node property edits. They are stored separately from the scene tree so the base scene can stay clean while the workspace carries local edits.

Kinds of editable keys:

- `ui`: `process`, `x`, `y`, `layoutMode`, `flexDirection`, `gap`, `padding`, `width`, `height`, `grow`, `tailwind`
- `api`: `process`, `method`, `timeout`, `retries`, `cache`, `rateLimit`
- `data`: `process`, `engine`, `region`, `schema`, `pool`
- `agent`: `process`, `model`, `autonomy`, `maxSteps`, `memoryScope`, `temperature`, `canReadFiles`, `canExecTerminal`, `canSelfHeal`, `canDeployProd`, `systemPrompt`

The inspector shows the effective value, including overrides, so the operator can see what the scene will actually use.

## Viewports

The viewport is the main preview canvas. It is zoomable, pannable, and has a device frame toggle.

### Viewport tools

- **Select** — inspect and annotate.
- **Move** — reorder and reposition.
- **Resize** — resize and reshape.

### Viewport features

- Grid snap toggle.
- Device chrome toggle.
- Grid visibility toggle.
- Live agent overlay, which shows during runs.
- Zoom scale from 50% to 150%.
- Desktop and mobile device frames.

### Preview compositing

The preview renders the scene as a composited UI shell. The default scene renders as a Northwind-style dashboard shell with a navbar, metrics grid, live feed endpoint, and the agent overlay during runs.

Added nodes that are not yet part of the composited preview are annotated in the viewport so the operator can see the gap between the tree and the preview.

## Scripting

Every node can carry a script resource at a `res://` path. The script is the node's behavior contract.

Script resources are ordinary code files in the file system dock:

- Scenes are JSON resources.
- Components, agents and endpoints are code resources.
- Prompts are prompt resources.

The file system dock groups resources by folder and lets the operator open any resource as a tab.

### Script view

The script view is the main-region tab that shows the currently active script. Switching tabs updates the active file id and the context the inspector and provider see.

## Agent runtime

The engine has a local runtime in `server/index.mjs`.

### Runtime surface

- `GET /api/runtime` — runtime description.
- `POST /api/runs` — start a build or deploy run.
- `GET /api/runs/:id/events` — SSE stream of run events.
- `POST /api/runs/:id/pause|resume` — pause or resume a run.
- `POST /api/runs/:id/stop` — stop a run.
- `GET /api/runs/:id` — run snapshot.

### Runtime tools

- Filesystem read/write scoped to `res://` resources.
- esbuild transforms for view modules.
- `tsc --noEmit` for scene validation.
- signal wiring helpers.
- gzip packaging for build artifacts.

### Run state

A run has:

- `kind` — build or deploy.
- `status` — idle, building, running, deploying, deployed, halted, failed.
- `progress` — percentage.
- `currentAgent` — the agent currently acting, when any.
- `startedAt`, `finishedAt` — timestamps.
- `session` — run session identifier.
- `events` — event list for the SSE stream.

The UI shows run status, progress, current agent and the live agent overlay during runs.

## Persistence

The editor persists local workspace state in a versioned localStorage snapshot.

### What persists

- The scene tree, including added nodes.
- Inspector overrides.
- Closed tab ids.
- Active file id.
- Workspace mode.
- Selected node id.
- Expanded tree state.

### Validation

Snapshots are validated on load:

- Version must match.
- The tree is sanitized: kinds, icons, ids, names, classes, paths, signals, and depth are validated.
- Overrides are validated against the loaded tree's node ids and allowed keys.
- Invalid or version-mismatched snapshots fall back to the default scene.

### Reset

Project → Reset Project to Defaults restores the built-in scene, clears overrides, restores default tabs, and resets the saved workspace for the browser.

## Projects

The editor ships with a small project switcher.

- Project switching changes the context the provider and runtime see.
- The default local project is the one the editor starts on.
- The slug is shown in the engine bar and in the provider context.

## Build semantics

The editor has its own build identity.

- Frontend build is TypeScript plus Vite.
- Build and deploy are separate run kinds in the runtime.
- The Export action stages a production build path.
- Scene validation can run through `tsc --noEmit`.

The project's build headline is "snapshots, not releases" because the current artifact is an editor build, not a public release.

## Editor chrome

The editor is dense and desktop-first.

### Engine bar

- Project name and slug.
- Scene, Project, Build, Agents, Editor, Help menus.
- Workspace mode toggles: Viewport, Script, Signal Graph, Agent Hub.
- Play, pause, stop, run current scene, export.
- AI toggle.

### Workspace modes

- **Viewport** — scene tree and preview.
- **Script** — script view.
- **Signal Graph** — signal visualization.
- **Agents** — agent hub.

### Bottom dock

- Output and secondary tabs.
- Toggle with the Editor → Toggle Output Panel action.

### Keyboard

- `F5` — play/build & run.
- `F6` — pause/resume agents.
- `F7` — stop execution.
- `⌘K` / `Ctrl+K` — command palette.
- `Q/W/E` — viewport tools.

## Security and trust

- The provider key is held in memory only. It is not written to disk or localStorage.
- Scene changes from the provider are staged and applied only after operator confirmation.
- Persistence stores editor session state only. It does not store keys.
- The runtime is the only process that talks to providers. The editor never sends keys directly.

## File layout

Top-level:

- `src/` — React app.
- `server/` — local runtime and AI proxy.
- `scripts/` — developer scripts.
- `docs/` — documentation.
- `dist/` — build output.
- `.acidmade/` — local project metadata.

Source layout:

- `src/components/` — editor UI.
- `src/data/` — scene, resources, node catalog, project data, signal graph, build script.
- `src/lib/` — persistence, runtime client, AI client, node actions, tabs, utils.
- `src/state/` — engine context.
