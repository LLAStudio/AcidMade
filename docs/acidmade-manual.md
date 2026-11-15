# AcidMade Engine Manual

Complete reference for the AcidMade editor, scene format, agent runtime, AI
layer, persistence model and desktop packaging.

This document is generated from `docs/acidmade-manual.md` by
`npm run docs:pdf`. The same source is committed, so the PDF and the manual can
never drift apart.

The PDF is downloadable in two places: the README links to
`public/AcidMade-Documentation.pdf`, and the editor serves it from
**Help → Download Documentation (PDF)**.

## 1. What AcidMade is

AcidMade is an application engine with an editor attached. An application is
described as a tree of typed nodes; each node carries a class, a script
resource, a status and a set of signals. The editor renders that tree, the
runtime validates it, and an AI provider can reason about it and propose
changes that the operator confirms.

Three ideas define the product:

- **Structure is visible.** Every screen, component, endpoint, data source and
  agent is a node in one tree. There is no hidden component registry.
- **Wiring is declared.** Signals are named connections from a node to a method
  on another node. Intent is readable without tracing imports.
- **AI proposes, the operator disposes.** A provider can stage one scene action.
  The editor shows a confirmation card and applies it only after approval.

The editor is deliberately dense and desktop-first: five resizable docks,
compact monospace labels, keyboard-driven workspaces and no decorative chrome.

## 2. Requirements and installation

### 2.1 Desktop application

Installers are published on the repository releases page:

| Platform | Format | Install |
| --- | --- | --- |
| Windows | `Setup.exe` | Run the installer |
| Windows | `.msi` | Managed or group-policy install |
| Windows | `Portable.exe` | Run directly, no install |
| macOS | `.dmg` | Open and drag to Applications |
| macOS | `.app.zip` | Unzip and run |
| Linux | `.AppImage` | `chmod +x` then run |
| Linux | `.flatpak` | `flatpak install AcidMade.flatpak` |

Builds are unsigned, so Windows SmartScreen and macOS Gatekeeper warn on first
launch. That is expected for these builds; see section 20 for signing.

### 2.2 From source

Requirements: Node.js 20 or newer, and a provider key only if you want the AI
panel to reach a hosted provider.

```bash
npm install
npm run dev
```

`npm run dev` starts two processes:

- the Vite dev server on port 3000 (the editor),
- the local agent runtime on port 4317.

Open the printed URL. `npm run dev:web` starts the editor alone; the editor then
falls back to a reference event stream so the UI stays usable.

To run the desktop shell during development:

```bash
npm run desktop:dev     # Electron window pointed at http://127.0.0.1:3000
npm run desktop         # build the renderer, then open the desktop window
```

## 3. First run: the project and file manager

AcidMade does not drop you into a random scene. It opens a project manager,
which is the entry point for choosing a project and browsing its resources.

### 3.1 Project list

Each entry shows the project name, branch, environment and filesystem path.
Search filters across name, slug, branch and environment. A single click selects
and shows details; a double click opens the project in the editor.

Three projects ship with the editor:

| Project | Slug | Branch | Environment |
| --- | --- | --- | --- |
| Northwind Analytics | `northwind-analytics` | `main` | Preview |
| Flux Console | `flux-console` | `feat/agent-mesh` | Staging |
| AcidMade Core | `acidmade-core` | `main` | Local |

### 3.2 Creating a project

**New project** asks for a name and a template, then opens the new project
immediately. The name is slugified for the path and the slug field.

| Template | Scene | Nodes | Agents | Use |
| --- | --- | --- | --- | --- |
| Analytics dashboard | `res://scenes/MainApp.acid` | 9 | 2 | App shell plus dashboard and agent |
| Agent workspace | `res://scenes/AgentMesh.acid` | 5 | 3 | Agent-first, no UI shell |
| Blank scene | `res://scenes/MainApp.acid` | 1 | 0 | Start from a root node |

A project is a single `.acm` container file. Creating one writes the archive with
`acidmade.json`, `scenes/MainApp.acid`, `acid.config.json`, an `agents/` starter
for the agent template, and a short `README.md` inside it. Projects live under
`Documents/AcidMade` unless `ACIDMADE_PROJECTS_DIR` points elsewhere. In the
browser preview there is no filesystem access, so created projects stay in
`acidmade.launcher.v1` instead.

The container is a zip archive with stored (uncompressed) entries, so it stays
inspectable with ordinary tools. The reader also accepts deflated entries.
Directory projects from older builds, with an `acidmade.json` at their root, keep
working.

### 3.2.1 Open, reveal and save

- **Open project…** picks an existing `.acm` file; a manifest is added when the
  archive does not have one.
- **Reveal** shows the `.acm` file in the system file manager.
- Selecting a resource reads its entry from the container. `Ctrl`/`Cmd`+`S`
  rewrites the archive and updates `updatedAt` in the manifest. The browser
  preview is read-only.

### 3.3 Resource browser

The middle column lists every resource grouped by folder:

- `agents/` prompt and agent scripts,
- `api/` endpoint resources,
- `components/` reusable UI scripts,
- `scenes/` scene documents,
- `root/` project-level files.

Folders collapse, resources filter by name or path, and selecting a resource
opens the file inspector: language, group, origin, added and removed line counts,
and a content preview. **Open in editor** jumps straight to that resource in the
script workspace.

### 3.4 Returning to the manager

**Project → Projects & Files** reopens the manager from anywhere in the editor.
The editor keeps your workspace state while the manager is open.

### 3.5 The `.acm` container

An AcidMade project is one file with the `.acm` extension. Inside it is a zip
archive with stored entries:

| Entry | Required | Content |
| --- | --- | --- |
| `acidmade.json` | yes | Project manifest |
| `scenes/MainApp.acid` | yes | Entry scene, `acid/1.0` |
| `acid.config.json` | no | Accent, density and radius tokens |
| `agents/*.agent.ts` | no | Agent scripts |
| `prompts/*.prompt` | no | Reusable agent prompts |
| `README.md` | no | Human notes |

Manifest fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | string | `acm/1.0` |
| `name` | string | Display name |
| `slug` | string | Id derived from the file name |
| `branch` | string | Branch shown in the manager |
| `environment` | string | `Local`, `Preview`, `Staging` |
| `scene` | string | `res://` path of the entry scene |
| `template` | string | Template the project was created from |
| `summary` | string | One-line description |
| `createdAt` | ISO string | Creation time |
| `updatedAt` | ISO string | Rewritten on every save |

Behaviour:

- Reading an entry never mutates the file. Writing rewrites the whole archive
  with the replaced entry and a fresh `updatedAt`.
- Entry paths are normalised and rejected if they contain `..`, and a resource
  larger than 2 MB is refused by the reader.
- A `.acm` without a manifest is adopted: one is generated on open and written
  back on the next save.
- Folder projects from older builds still open and edit normally.

## 4. Workspace layout

The editor is one window with five resizable regions.

| Region | Contents |
| --- | --- |
| Engine bar | Logo, menus, workspace toggles, run controls, AI toggle |
| Left dock | Scene tree above, file system below, resizable split |
| Center | Tab strip, then viewport, script, signal graph or agent hub |
| Right dock | Inspector and Node & Signals tabs |
| Bottom dock | Output, Stream, Debugger, Build, Terminal |

Above the bottom dock sits the run strip: current scene resource, run state and
frame timing. Below it, the status bar reports diagnostics, node count, runtime
state, encoding and the active project path.

Dock sizes are drag handles, not fixed panels. The left dock splits between the
scene tree and the file system; the right dock is width-resizable; the bottom
dock height-resizes and collapses to a 27 px strip.

## 5. The scene model

### 5.1 Scene documents

Scenes are JSON resources with the `acid/1.0` schema. A minimal scene:

```json
{
  "acid": "1.0",
  "root": "MainApp",
  "class": "AppRoot",
  "entry": "res://scenes/DashboardPage.acid",
  "theme": { "accent": "#CCFF00", "density": "engine", "radius": 4 },
  "agents": ["res://agents/DataAnalystAgent.agent.ts"],
  "signals": { "on_ready": ["WorkspaceShell.mount"] }
}
```

Field reference:

| Field | Type | Meaning |
| --- | --- | --- |
| `acid` | string | Format version, always `1.0` |
| `root` | string | Display name of the root node |
| `class` | string | Root class from the node catalogue |
| `entry` | string | Scene loaded first when the app starts |
| `theme` | object | Accent, density and radius tokens |
| `agents` | string[] | Agent scripts attached at scene level |
| `signals` | object | Signal name to connection list |

### 5.2 Node schema

Every node in the tree has the same shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable machine id, unique in the tree |
| `name` | string | Display name shown in the tree |
| `className` | string | Class from the node catalogue |
| `kind` | enum | `root`, `ui`, `component`, `api`, `data`, `agent` |
| `icon` | enum | Icon key used by the tree and graph |
| `summary` | string | One-line description |
| `status` | enum | `idle`, `running`, `healthy`, `error` |
| `visible` | boolean | Hidden nodes stay in the tree but not in the viewport |
| `file` | string? | Scene resource this node belongs to |
| `script` | string? | Script resource attached to the node |
| `signals` | array | Signal definitions owned by the node |
| `children` | array? | Child nodes |

### 5.3 Node kinds

- `root` - application or scene roots. Owns lifecycle signals such as
  `on_ready`.
- `ui` - layout containers and screens. Mount, resize and visibility.
- `component` - reusable UI pieces with props and events.
- `api` - endpoints and edge services. Owns request and error signals.
- `data` - data layer nodes, caches and subscriptions.
- `agent` - autonomous or assisted agents. Owns run and heal signals.

### 5.4 Default scene tree

`res://scenes/MainApp.acid` is the root. It emits `on_ready`, connected to
`WorkspaceShell.mount`.

- **AuthGate** - route guard. Emits `on_user_login` to
  `AuthSuperAgent.grantSession`.
- **AuthSuperAgent** - identity agent. Emits `session_granted` to
  `AuthGate.unlock` and `auth_error` to `DataAnalystAgent.recoverAuth`.
- **WorkspaceShell** - layout container. Emits `on_mount` to
  `DashboardPage.mount`.
- **DashboardPage** - analytics view. Emits `on_scene_ready` to
  `WorkspaceShell.markReady` and `on_build_error` to
  `DataAnalystAgent.selfHeal`.
  - **TopNavbar** - global command bar.
  - **MetricsGrid** - KPI widget grid.
  - **LiveFeedAPI** - streaming endpoint. Emits `on_data_fetched` to
    `MetricsGrid.update` and `on_stream_error` to
    `DataAnalystAgent.reconnect`.
  - **DataAnalystAgent** - analytics worker. Emits `on_run_dispatched` to
    `LiveFeedAPI.subscribe` and `heal_complete` to `DashboardPage.refresh`.

### 5.5 Scene tree operations

| Operation | How |
| --- | --- |
| Select | Click a row |
| Expand or collapse | Click the disclosure arrow |
| Toggle visibility | Click the eye control |
| Create node | Scene menu, `N`, or command palette |
| Attach script | Scene → Attach Script |
| Rename | Inspector, or an AI staged rename |
| Filter | Search field above the tree |

Creating a node requires a parent, a name, a class and a kind. The editor derives
a unique id from the name, inserts the node under the parent, expands the
parent, selects the new node and switches the right dock to the inspector.

## 6. Signals

A signal is a declaration plus zero or more connections:

```json
{
  "id": "sig-ready",
  "name": "on_ready",
  "args": "()",
  "description": "Fired once the scene has mounted.",
  "connections": [{ "nodeId": "workspace-shell", "method": "mount" }]
}
```

Rules the editor and runtime both honour:

- A connection always targets a node id and a method name. No string event
  buses.
- Signals describe intent; the method owns behaviour.
- Renaming a node keeps connections valid because they reference ids.
- The signal graph view renders nodes as boxes and connections as edges.
- Diagnostics may reference signal wiring, and the AI context includes open
  diagnostics so a provider can reason about broken wiring.

The **Signal Graph** workspace is read-only visualisation: selecting a node there
selects it in the tree and inspector.

## 7. Inspector and overrides

The inspector edits the effective configuration of the selected node.

- Values come from the node, its class defaults and the override layer, in that
  order.
- Editing a value writes an override, not the base node. Overrides are keyed by
  node id, then by property key.
- The override count is shown in the panel header. **Reset** clears every
  override for that node.
- Overrides survive reloads and are validated on load: a node id that no longer
  exists is dropped.

Editable keys depend on node kind. Agent nodes expose model, autonomy, memory,
max steps, temperature, provider and instruction text; UI nodes expose layout,
visibility and density; API nodes expose endpoint, method and cache policy.

The **Node & Signals** tab shows the same node's class, kind, id, script and its
signal list with connections.

## 8. Viewport

The viewport renders the scene through the editor's compositor.

| Control | Meaning |
| --- | --- |
| Select / Move / Resize (`Q`, `W`, `E`) | Active manipulation tool |
| Desktop / Mobile | Device frame preset |
| Grid | Toggle the editor grid |
| Agent overlay | Show agent activity on top of the render |
| Zoom | 25% to 200%, with a reset action |
| Snap | Snap manipulation to the grid |

| State | Meaning |
| --- | --- |
| `idle` | Scene loaded, nothing running |
| `running` | A build or deploy run is active |
| frame time | Measured compositor frame time |

During a run, node statuses propagate to the viewport and the agent overlay
highlights the nodes the runtime reports as active.

## 9. Script workspace

The script workspace shows the active resource: scenes, agents, API modules,
components and prompts. Each resource carries a language (`tsx`, `ts`, `json`,
`css`, `md`, `prompt`), a group, the agent that generated it, and added and
deleted line counts.

Tabs are per resource. Closing a tab hides it without deleting the resource;
reopening happens from the file system dock, the project manager, or the command
palette. Closed tabs are persisted so the session restores exactly.

## 10. Agent hub

The agent hub lists every agent node with the state that matters:

| Field | Meaning |
| --- | --- |
| Model | Provider model id the agent runs on |
| Autonomy | `Full-Acid Auto`, `Ask Permission`, `Assisted` |
| Memory | `Project-Wide` or session-scoped |
| Max steps | Upper bound on tool steps per run |
| Temperature | Sampling temperature |
| Signals | Wired signals for the agent |
| Status | `idle`, `running`, `healthy` or `error` |

Hub actions: **Open Acid AI**, **Spawn agent** and per-agent **Inspect** or
**Prompt**. Inspecting selects the node and opens the inspector; prompting opens
Acid AI with the agent as context.

Autonomy governs whether the agent may act without confirmation. In this build
every scene mutation still requires the operator confirmation card; autonomy
affects prompting and the runtime plan, not the write path.

## 11. Acid AI

### 11.1 Providers

| Provider | Base URL | Key |
| --- | --- | --- |
| OpenAI / compatible | any `/chat/completions` endpoint | required |
| Anthropic | Messages API | required |
| Ollama | local daemon | not required |

Provider settings live in the AI panel and persist as provider id, base URL and
model. Keys are held in memory by the runtime process only: not on disk, not in
localStorage, not in the page.

### 11.2 What the provider receives

Each request assembles a context block:

- project name, slug and branch,
- selected node id, name, class and kind,
- active resource path,
- the first five open diagnostics,
- the last engine log lines,
- the scene tree trimmed to id, name, class, kind and parent,
- available classes from the node catalogue,
- editable keys for the selected kind,
- the selected node's effective configuration including overrides.

### 11.3 What the provider can do

- Inspect nodes, signals and diagnostics.
- Explain failures and propose fixes.
- Draft or rewrite an agent prompt.
- Stage exactly one scene action per turn: create a node, rename a node, or
  configure properties.

The provider cannot apply a change. The reply is parsed into a staged action, the
editor renders a confirmation card with the target and the diff of values, and
only the confirm button dispatches the mutation. Rejecting discards it.

### 11.4 Attachments

Up to four attachments per message: images up to 2 MB each, text-like files up
to 512 KB each. The runtime proxy forwards them to the selected provider. Large
bodies are rejected with `413`; malformed JSON with `400`.

### 11.5 Failure behaviour

If the runtime is unreachable, the AI panel stays usable for composing but
cannot send; the bottom dock reports the transport error. If a provider returns
an error, the runtime returns the provider status and message unchanged so the
panel can show it verbatim.

## 12. Agent runtime

The runtime is a local Node process (`server/index.mjs`). It owns run lifecycle,
tool execution and the AI proxy.

### 12.1 Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/runtime` | Capabilities, tools, planner, active run |
| `POST` | `/api/runs` | Start a build or deploy run |
| `GET` | `/api/runs/:id` | Run snapshot |
| `GET` | `/api/runs/:id/events` | SSE event stream |
| `POST` | `/api/runs/:id/pause` | Pause a run |
| `POST` | `/api/runs/:id/resume` | Resume a run |
| `POST` | `/api/runs/:id/stop` | Stop a run |
| `POST` | `/api/ai/chat` | Provider proxy |

### 12.2 Run lifecycle

A run moves through `building` or `deploying`, then `running` or `deployed`, and
ends in `completed`, `halted` or `failed`. Only one run may be active; starting
another returns `run_active` with the active run id, and the editor attaches to
that stream instead of starting a second one.

### 12.3 Event stream

Events are server-sent and sequence-numbered:

```
id: 12
event: log
data: {"seq":12,"runId":"run-7","type":"log","time":"10:19:36","agent":"BUILD","level":"info","message":"compiled res://api/LiveFeedAPI.ts"}
```

| Event type | Payload |
| --- | --- |
| `started` | kind, project, intent |
| `log` | time, agent, level, message, channel, nodeId, tool |
| `node` | nodeId, status |
| `progress` | value 0-100, agent |
| `problem` | diagnostic object |
| `healed` | problemId |
| `diff` | path, additions, deletions, preview, agent |
| `status` | completed, failed or halted |

The client reconnects on transport failure and fails the run if the stream never
opens within ten seconds. Malformed events are discarded and logged as a warning
rather than closing the stream.

### 12.4 Planner

The current planner is `local-reference`. It maps a run intent to a deterministic
step list covering mount, compile, validate, wire signals and package. It exists
so the editor, the SSE contract and the tool layer can be developed and tested
without a model in the loop.

## 13. Runtime tools

| Tool | Scope | Notes |
| --- | --- | --- |
| `fs.read` | `res://` | Returns text resources only |
| `fs.write` | `res://` | Creates or replaces a resource |
| `fs.patch` | `res://` | Applies a textual patch |
| `esbuild` | view modules | Transforms TSX to JS |
| `tsc` | project | `--noEmit` validation |
| `signals` | scene | Reads and rewrites connections |
| `gzip` | build output | Packages the artifact |

All filesystem tools are confined to `res://` resources. In the desktop app the
runtime runs with its working directory set to the application's user data
folder, so writes never target a read-only install directory.

## 14. Build and export

| Action | Kind | Result |
| --- | --- | --- |
| Play / Build & Run (`F5`) | `build` | Compiles, validates, then runs |
| Run current scene | `build` | Same pipeline scoped to the active scene |
| Export | `deploy` | Stages a production artifact |

The build pipeline emits progress, per-node status, diagnostics and diffs. A
diagnostic carries severity, file, line, message and a code, and can later be
marked healed. A diff carries path, added and removed counts and a preview.

Diagnostics and diffs are cleared when a new build starts. The bottom dock shows
them in **Build**, while **Output** keeps the chronological engine log and
**Stream** keeps agent chatter.

Build status is deliberately "snapshots, not releases": the artifact is an editor
build, not a public product build.

## 15. Keyboard and command palette

| Key | Action |
| --- | --- |
| `F5` | Play, build and run |
| `F6` | Pause or resume agents |
| `F7` | Stop execution |
| `Ctrl`/`Cmd` + `K` | Command palette |
| `Q` / `W` / `E` | Select, move, resize tool |
| `Ctrl`/`Cmd` + `S` | Save scene |
| `Ctrl`/`Cmd` + `P` | Focus file search |

The command palette lists navigation, node creation, run control, dock toggles
and documentation actions, and filters as you type.

## 16. Persistence

Two independent localStorage snapshots back the editor.

### 16.1 Workspace snapshot

Key: `acidmade.workspace.v1`.

Stored: scene tree, overrides, closed tab ids, active file id, workspace mode,
selected node id, expanded nodes.

Validation on load:

- node kinds, icon keys, ids, names, classes, file and script paths, signals and
  children are checked,
- statuses are reset to `idle`,
- overrides are pruned to ids and keys that still exist,
- a malformed or version-mismatched snapshot falls back to the default scene.

### 16.2 Launcher snapshot

Key: `acidmade.launcher.v1`.

Stored: created projects and the last opened project id. Only user-created
projects are persisted; the built-in three are always present.

### 16.3 Reset

**Project → Reset Project to Defaults** restores the built-in scene tree, clears
every override, restores default tabs, resets mode and selection, and clears the
workspace snapshot. It is disabled while a build or deploy is running and while
a run is active.

## 17. Configuration reference

### 17.1 Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ACIDMADE_RUNTIME_PORT` | `4317` | Runtime port |
| `ACIDMADE_RUNTIME_HOST` | `127.0.0.1` | Runtime bind address |
| `ACIDMADE_RUNTIME_URL` | `http://127.0.0.1:4317` | Vite proxy target |
| `ACIDMADE_DEV_URL` | unset | Electron loads this dev URL instead of `dist` |
| `ACIDMADE_PROJECTS_DIR` | `Documents/AcidMade` | Folder scanned for `.acm` projects |

### 17.2 Ports

| Port | Service |
| --- | --- |
| 3000 | Vite dev server |
| 4317 | Agent runtime and AI proxy |

## 18. Project conventions

- **One home per responsibility.** `src/components` for UI, `src/data` for the
  scene and resource catalogue, `src/lib` for clients and persistence,
  `src/state` for the reducer, `server` for runtime code, `scripts` for tooling.
- **Resources are the contract.** `res://` paths name scenes, scripts, agents and
  config, and both the file dock and the AI context use them.
- **Status is visible.** Node and run status appear in the UI, not only in logs.
- **AI is a copilot.** The provider proposes; the editor applies after
  confirmation.
- **Local first.** Editor and runtime are a local pair. Hosting and accounts are
  separate concerns.

## 19. Architecture map

```
electron/            main process, preload bridge, project store (projects.mjs)
server/              runtime, AI proxy, tools
src/components/      editor docks, panels, project manager
src/data/            scene tree, resources, projects, build script
src/lib/             persistence, runtime client, AI client, launcher, api base
src/state/           EngineContext reducer and actions
docs/                long-form documentation and this manual
scripts/             dev launcher, icon generation, PDF generation
```

Data flow for a run: the editor dispatches `run-start`, posts to
`/api/runs`, receives a run id, opens the SSE stream, folds each event into the
reducer, and renders node statuses, diagnostics and logs. If the runtime is
unavailable, a reference step list is replayed so the interface still
demonstrates the pipeline.

## 20. Desktop packaging

| Target | Format | Host requirement |
| --- | --- | --- |
| `nsis` | `Setup.exe` | Windows, or Linux with Wine |
| `msi` | `.msi` | Windows with WiX |
| `portable` | `Portable.exe` | Windows, or Linux with Wine |
| `dmg` | `.dmg` | macOS |
| `zip` + `dir` | `.app` bundle | macOS |
| `AppImage` | `.AppImage` | Linux |
| `flatpak` | `.flatpak` | Linux with flatpak-builder and runtimes |

Commands:

```bash
npm run icon            # regenerate build/icon.png and build/icons/*
npm run docs:pdf        # regenerate public/AcidMade-Documentation.pdf
npm run package         # current platform, all configured targets
npm run package:linux   # AppImage and Flatpak
npm run package:win     # Setup.exe, MSI, portable
npm run package:mac     # DMG and zip, plus the .app bundle
```

The release workflow builds every platform on its native runner and publishes
the artifacts. Pushing to `main` publishes the version in `package.json`;
pushing a `v*` tag publishes that tag. Optional formats (Flatpak, MSI) are
allowed to fail without blocking the rest.

Signing: set `CSC_LINK` and `CSC_KEY_PASSWORD` for Windows and macOS, plus
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for notarization,
then remove `identity: null` from `electron-builder.yml`.

## 21. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `runtime offline` in the status bar | Port 4317 not listening | `npm run runtime` |
| Editor runs but AI never answers | No provider key or wrong base URL | Open the AI panel and set provider and key |
| Port 3000 already in use | Another dev server | Stop it, or run Vite with another port |
| Build stops without logs | Runtime crashed mid-run | Check the runtime terminal output |
| Reload loses nodes | Browser storage blocked | Allow localStorage or use the desktop build |
| Save is disabled in the file inspector | Running in the browser preview | Use the desktop build for writes |
| A project is missing from the list | The file is not `.acm` or its archive is broken | Use **Open project…**, or check the archive |
| macOS refuses to open the app | Unsigned build | Right-click, Open, then confirm |
| Windows SmartScreen warning | Unsigned build | More info, Run anyway |

## 22. Glossary

- **Acid scene** - a `acid/1.0` JSON document describing a node tree.
- **Agent** - a node kind that runs with a model, autonomy and tool access.
- **Diagnostic** - a build finding with severity, file, line and code.
- **Override** - an inspector value stored on top of a node's base config.
- **Planner** - the component that turns an intent into runtime steps.
- **Run** - one build or deploy execution with its own event stream.
- **Signal** - a named connection from a node to a method on another node.
- **Super-agent** - an agent with its own session policy and tool set.
- **Tool** - a runtime capability with a declared scope, such as `fs.read`.

## 23. Documentation index

- `docs/acidmade-engine.md` - engine reference for the scene graph and runtime.
- `docs/ai-provider-setup.md` - provider setup, BYOK and staged actions.
- `docs/file-system-and-resources.md` - `res://` resources and compositing.
- `docs/desktop-packaging.md` - installers, host requirements and release flow.
- `docs/contributing-and-architecture.md` - architecture and contribution rules.
- `docs/acidmade-manual.md` - this manual; the source of the PDF.
