<svg xmlns="http://www.w3.org/2000/svg" width="98" height="20"><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#ccff00"/><stop offset="1" stop-color="#9ad500"/></linearGradient><rect x="0" y="0" width="98" height="20" rx="4" fill="url(#g)"/><path d="M0 10.5 A10 10 0 0 1 20 10.5 H98 V9.5 A10 10 0 0 1 78 9.5 H98 V10.5 A10 10 0 0 1 98 10.5 Z" fill="#0a0c04"/><text x="16" y="14.4" fill="#0a0c04" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="11" font-weight="700">acid/1.0</text></svg> build — snapshots, not releases

# AcidMade

A Godot-4-fidelity, AI-native application engine built in React, TypeScript and Tailwind, with a local tool-executing agent runtime and provider-agnostic AI agents.

AcidMade is a scene editor first. The document you are reading is the full project reference; see [The documentation](#the-documentation) for the docs console and the individual doc files.

## Why

Most web apps hide their structure behind abstraction layers. AcidMade puts the structure on the desk: nodes, scenes and signals at one scale, agents and provider chat at another, and a local runtime that can inspect, build and patch the same scene the editor shows. The UI is deliberately dense and desktop-first, modeled on Godot 4's editor density rather than web convention.

## What it is

- **Scene editor:** a five-dock workspace — scene tree, file system, viewports/scripts/signals/agents, inspector and bottom output panel — with resizable panes, a zoomable viewport, and a live agent overlay during runs.
- **Acid scene format:** `acid/1.0` scenes live as JSON resources and describe an application as a tree of typed nodes with attached script resources and signal definitions.
- **Node, scene and signal architecture:** nodes have kinds (`root`, `ui`, `component`, `api`, `data`, `agent`), classes, icons, status, visibility, attached scripts, and signals with typed connections.
- **Local agent runtime:** a Node runtime in `server/index.mjs` exposes `/api/runtime`, run endpoints, pause/resume/stop, and SSE event streaming. Tools include filesystem access, esbuild transforms, tsc noEmit type checks, gzip packaging, and a local-reference planner.
- **Provider-agnostic AI:** the Acid AI panel connects an OpenAI-compatible, Anthropic or local Ollama provider and uses the scene context, diagnostics and node configuration in its prompt. Image and text attachments are supported.
- **Staged scene changes:** the provider can stage a single create, rename or configure action; the editor shows a confirmation card and nothing touches the scene until the operator confirms.
- **Local persistence:** added nodes, inspector overrides and the tab/mode/selection session survive a reload through a versioned, validated localStorage snapshot. Project → Reset Project to Defaults restores the built-in scene, overrides, and saved workspace.

## Where it runs

This is a local/browser project right now:

- **Frontend:** React app served by Vite on port 3000.
- **Runtime:** a Node process on port 4317 that proxies AI calls and manages runs.
- **Development:** `npm run dev` starts both processes together through `scripts/dev.mjs`.
- **Build:** `npm run build` runs `tsc -b && vite build`.

No public hosted backend is wired in yet. If you add one later, the runtime and AI chat paths are the natural place to start, not the editor shell.

## Run it locally

Requirements:

- Node.js. This repository ships its own lockfile; keep it.
- A provider key only if you want the Acid AI panel to reach OpenAI or Anthropic. Ollama runs locally with no key.

Steps:

```bash
npm install
npm run dev
```

Then open the Vite preview. The editor starts on the default scene with the DataAnalystAgent script tab active and the bottom output panel open.

If you only want the frontend for a quick check, `npm run dev:web` starts Vite alone. The editor will fall back to the reference runtime stream until the runtime process comes back.

## The documentation

The README is the front door. The deeper documentation lives in `docs/` and can be read in two ways:

- In the editor, open **Help → Engine Documentation**. The documentation console renders the doc files in-dock so the reference is available while you work.
- On disk, read `docs/` directly or regenerate the README's badge and build-status placeholders from the scripts in `scripts/`.

Doc files:

- [acidmade-engine.md](docs/acidmade-engine.md) — the engine reference: scene graph, nodes, signals, inspector, viewports, scripting, agent runtime, persistence, project and build semantics.
- [ai-provider-setup.md](docs/ai-provider-setup.md) — connecting an AI provider, BYOK behavior, attachments, staged scene actions, and the runtime proxy.
- [file-system-and-resources.md](docs/file-system-and-resources.md) — res:// resources, the file system dock, code file groups, preview compositing, and how resources become scene scripts.
- [contributing-and-architecture.md](docs/contributing-and-architecture.md) — architecture map, editors and commands, test approach, and the contribution agreement.

## Architecture & scene tree

AcidMade models an application as a tree of scene nodes.

The default scene, `res://scenes/MainApp.acid`, is the root. It owns the workspace lifecycle and emits `on_ready`, which connects to `WorkspaceShell.mount`.

Under the root:

- **AuthGate** — a route guard. It emits `on_user_login`, which routes to `AuthSuperAgent.grantSession`.
- **AuthSuperAgent** — an autonomous identity agent. It emits `session_granted` back to `AuthGate.unlock`, and `auth_error` to `DataAnalystAgent.recoverAuth`.
- **WorkspaceShell** — the primary layout container. It emits `on_mount`, which routes to `DashboardPage.mount`.
- **DashboardPage** — the primary analytics view. It emits `on_scene_ready` back to `WorkspaceShell.markReady`, and `on_build_error` to `DataAnalystAgent.selfHeal`.
  - **TopNavbar** — the global command bar.
  - **MetricsGrid** — the KPI widget grid.
  - **LiveFeedAPI** — the streaming edge endpoint. It emits `on_data_fetched` to `MetricsGrid.update`, and `on_stream_error` to `DataAnalystAgent.reconnect`.
  - **DataAnalystAgent** — the autonomous analytics worker. It emits `on_run_dispatched` to `LiveFeedAPI.subscribe`, and `heal_complete` to `DashboardPage.refresh`.

Node kinds:

- `root` — application or scene roots.
- `ui` — layout containers and screens.
- `component` — reusable UI pieces.
- `api` — endpoints and edge services.
- `data` — data layer nodes.
- `agent` — autonomous or assisted agents.

Every node has an attached script resource, an icon key, a status, and a visibility flag. Signal definitions carry a name, argument signature, description, and typed connections to another node's method.

## Signal graph

Signals are the wiring layer. Each signal has a name and a list of connections of the form `{ nodeId, method }`. The editor shows signals on each node, and the **Signal Graph** workspace visualizes connections across the tree.

Signal discipline in this project:

- Signals describe intent, not implementation. A connection says which node method is invoked when a signal fires.
- The editor and runtime treat signals as typed wiring. The provider only wires them through staged actions after confirmation.
- Diagnostics can mention signal wiring. The AI context surface includes the first five open problems so the provider can reason about build errors alongside the scene.

## Agent runtime

The runtime is a local Node process. Its public surface:

- `GET /api/runtime` — runtime description.
- `POST /api/runs` — start a build or deploy run.
- `GET /api/runs/:id/events` — SSE stream of run events.
- `POST /api/runs/:id/pause|resume` — pause or resume a run.
- `POST /api/runs/:id/stop` — stop a run.
- `GET /api/runs/:id` — run snapshot.

Tools available to the runtime:

- Filesystem read/write scoped to `res://` resources.
- esbuild transforms for view modules.
- `tsc --noEmit` for scene validation.
- signal wiring helpers.
- gzip packaging for build artifacts.

Planner: `local-reference`. This is the project's current execution-planning layer.

## Provider-agnostic AI

The Acid AI panel supports three providers:

- **OpenAI / compatible** — any `/chat/completions` endpoint.
- **Anthropic** — native Messages API.
- **Ollama** — local, no key required.

What the provider sees:

- The current project and branch.
- The selected node, with class, kind and id.
- The active resource.
- Open diagnostics, trimmed to the first five.
- Recent engine log lines.
- The active scene tree, id/name/class/kind/parent, trimmed.
- Available classes.
- Editable keys by kind.
- The selected node's effective configuration, including overrides.

What the provider can do:

- Inspect nodes, signals and diagnostics.
- Draft agent prompts.
- Stage one scene change at a time — create, rename or configure.
- It cannot apply a change itself. The editor stages the action, shows a confirmation card, and applies it only when the operator confirms.

Attachments:

- Up to four per message.
- Images up to 2 MB each.
- Text-like files up to 512 KB each.
- The provider proxy forwards images and text to the chosen provider. Keys are held in memory, not written to disk or localStorage.

## Build pipeline

The editor has a separate build identity from the runtime:

- **Build artifact:** `dist/` output from Vite, plus TypeScript compilation of the app. The project's build status headline is "snapshots, not releases" because the current artifact is an editor build, not a public release.
- **Deploy:** the Export action stages a production build path. In this project it is wired as a menu action and a runtime run kind; the runtime treat deploy and build as separate run kinds.
- **Validation:** scene validation can run through `tsc --noEmit`. The provider and runtime both know the project's typecheck tool.

Commands:

- `npm run dev` — run the full local stack.
- `npm run dev:web` — run the frontend only.
- `npm run build` — type-check and bundle.
- `npm run typecheck` — type-check only.
- `npm run preview` — preview the built frontend.

## Local project

The editor ships with one built-in local project and a small project switcher:

- **Northwind Analytics** — the default workspace, on branch `main`, environment Preview.
- **Flux Console** — a second project sample, on `feat/agent-mesh`, environment Staging.
- **AcidMade Core** — the engine's own local project entry.

Project switching changes the context the provider and runtime see. Scene persistence is per browser, not per project file.

## Interface

The editor is dense by design. The main chrome:

- **EngineBar** — project name, scene/project/build/agents/editor/help menus, workspace mode toggles, and the play/pause/stop/run/export controls.
- **Scene tree dock** — the hierarchy with expand/collapse and selection.
- **File system dock** — `res://` file browser with search, grouped by folder.
- **Tabs** — scene/script/signal/agent tabs across the top of the main region.
- **Viewport** — the live composited preview with zoom, device frame, grid, agent overlay and selection annotations.
- **Script view** — the active script resource.
- **Signal graph** — connection visualization.
- **Agent hub** — agent-oriented workspace.
- **Inspector** — property editor with overrides.
- **Bottom dock** — output and a few secondary tabs.

Keyboard:

- `F5` — play/build & run.
- `F6` — pause/resume agents.
- `F7` — stop execution.
- `⌘K` / `Ctrl+K` — command palette.
- `Q/W/E` — viewport select/move/resize tools.

## Persistence

Added nodes and inspector overrides survive a reload through a versioned localStorage snapshot keyed `acidmade.workspace.v1`. The snapshot stores the scene tree, overrides, closed tab ids, active file id, mode, selected node, and expanded tree state.

Validation:

- The tree is sanitized on load: node kinds, icon keys, ids, names, classes, file/script paths, signals and children are validated; status returns to `idle`.
- Overrides are validated against the loaded tree's node ids and keys.
- Malformed or version-mismatched snapshots fall back to the default scene.

Reset:

- **Project → Reset Project to Defaults** restores the built-in scene tree, clears every override, restores the default tabs, resets the mode and selection, and clears the saved workspace for the browser.
- The reset action is disabled while a build or deploy is active.

## Project conventions

- **One home per responsibility.** The source tree is split by layer: components, data, lib, state, server, and scripts. Runtime code lives under `server/`, editor code under `src/`, and project glue under `scripts/`.
- **Resources are the contract.** `res://` paths are the shared names for scenes, scripts, agents, components and config. The file system dock and the provider context both use them.
- **Status is visible.** Node status and run status are shown in the UI, not buried in logs.
- **AI is a copilot, not the executor.** The provider proposes; the editor applies after confirmation.
- **Local first.** The project is a local editor and runtime pair. Hosting, accounts and public deployment are separate concerns and are not wired in here yet.

## Configuration

Right now the only persisted user config is the provider identity in the Acid AI panel: provider id, base URL and model. API keys are held in memory only. The workspace snapshot is separate and stores editor session state only.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the frontend and the local runtime together. |
| `npm run dev:web` | Start the frontend only. |
| `npm run build` | Type-check and bundle the frontend. |
| `npm run typecheck` | Type-check only. |
| `npm run preview` | Preview the built frontend. |

## Status

Local editor and runtime, provider chat and staged scene actions working, persistence and reset working. Not a hosted product yet.

## The documentation

The editor can show the documentation in-dock from **Help → Engine Documentation**. The same files live in `docs/` on disk. Regenerate the README badge and build-status placeholders with the scripts in `scripts/` if you edit the source.

## Contributing

See [contributing-and-architecture.md](docs/contributing-and-architecture.md).

The short version: keep the UI dense and desktop-first, keep the scene format honest, keep AI as a staging layer, and do not merge a change that breaks the build or the default-scene contract without updating the docs and the README's tracked placeholders.

## License

This project does not have a LICENSE file yet. If you plan to share it, add one before you do.

## Acknowledgments

- Godot 4, for the editor-density and dock mental model this UI is explicitly trying to match.
- The surrounding open-source React, TypeScript and Tailwind tooling this project is built on.
