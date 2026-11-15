# Contributing and Architecture

This document is the project map. It describes the architecture, the editor conventions, the commands, the test approach, and the contribution agreement.

## Architecture

AcidMade is a local editor and runtime pair.

- The editor is a React app in `src/`.
- The runtime is a Node process in `server/`.
- The developer glue is in `scripts/`.
- The documentation is in `docs/`.
- The build output is in `dist/`.
- Local project metadata is in `.acidmade/`.

The editor and runtime communicate through the Vite proxy during development and through the same API surface in production.

### Source layout

- `src/components/` — editor UI.
- `src/data/` — scene, resources, node catalog, project data, signal graph, build script.
- `src/lib/` — persistence, runtime client, AI client, node actions, tabs, utils.
- `src/state/` — engine context.
- `src/main.tsx` — entry point.
- `src/index.css` — global styles.
- `src/App.tsx` — shell layout.
- `src/types.ts` — shared types.

### Server layout

- `server/index.mjs` — runtime HTTP server.
- `server/ai/chat.mjs` — provider proxy.
- `server/runtime/` — runtime core and tools.

### Editor layout

- `src/components/EngineBar.tsx` — top bar and menus.
- `src/components/SceneDeck` — scene tree and file system dock.
- `src/components/ViewportView.tsx` — preview canvas.
- `src/components/ScriptView.tsx` — script view.
- `src/components/SignalGraphView.tsx` — signal graph.
- `src/components/AgentHubView.tsx` — agent hub.
- `src/components/InspectorDock.tsx` — inspector.
- `src/components/BottomDock.tsx` — bottom output dock.
- `src/components/StatusBar.tsx` — status bar.
- `src/components/AddNodeModal.tsx` — add node modal.
- `src/components/AiPanel.tsx` — AI panel.
- `src/components/CommandPalette.tsx` — command palette.
- `src/components/ResizeHandle.tsx` — resize handles.
- `src/components/Preview/` — preview compositing.
- `src/components/inspector/` — inspector internals.

## Editor conventions

- The UI is dense and desktop-first: five resizable docks, mono labels, compact controls, no decorative chrome.
- Panels are resizable.
- The main region switches between workspace modes.
- The inspector edits node properties and overrides.
- The file system dock is the resource browser.
- The bottom dock holds output and secondary tabs.
- Keyboard shortcuts are part of the interface.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the frontend and the local runtime together. |
| `npm run dev:web` | Start the frontend only. |
| `npm run build` | Type-check and bundle the frontend. |
| `npm run typecheck` | Type-check only. |
| `npm run preview` | Preview the built frontend. |
| `npm run runtime` | Start the runtime only. |

### Developer scripts

- `scripts/dev.mjs` starts both processes and keeps them together.
- `scripts/gen-readme.mjs` regenerates the README badge and build-status placeholders.
- `scripts/gen-badge.mjs` writes the build badge.
- `scripts/check-readme.mjs` checks the README for missing sections.

## Test approach

The project is tested by running the editor and checking the behavior you care about.

- Visual checks are done in the browser preview.
- Build checks are done with `npm run build` and `npm run typecheck`.
- Persistence checks are done by adding nodes and overrides, reloading, and resetting.
- Provider checks are done with a real or mock provider through the runtime.

There is no heavy automated test suite yet. When you add one, keep it focused on the behavior the project actually exposes.

## Documentation conventions

- The README is the front door.
- The docs console in the editor renders `docs/` files.
- The docs files are the source of truth for deeper reference.
- The README badge and build-status placeholders are regenerated from scripts.
- If you change a documented behavior, update the docs and the README placeholders.

## Contribution agreement

- Keep the UI dense and desktop-first.
- Keep the scene format honest.
- Keep AI as a staging layer, not the executor.
- Keep the default scene contract stable.
- Keep keys out of files, commits, and localStorage.
- Update the docs when you change behavior.
- Do not merge a change that breaks the build or the default-scene contract without updating the docs and the README's tracked placeholders.
- If you add a feature, add or update the doc file that covers it.

## What not to change lightly

- The scene tree structure.
- The node kind set.
- The signal wiring in the default scene.
- The provider proxy's endpoint logic.
- The persistence schema version.
- The workspace snapshot fields.

These are the contracts the editor, docs, and provider all depend on.

## Future areas

- Hosting and accounts.
- Public deployment path.
- Cross-session project sync.
- Expanded test coverage.
- Larger resource set and project templates.
