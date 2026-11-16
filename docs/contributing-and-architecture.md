# Contributing and Architecture

This document is the project map. It describes the architecture, the editor conventions, the commands, the test approach, and the contribution agreement.

## Architecture

AcidMade is a local editor, runtime and desktop shell.

- The editor is a React app in `src/`.
- The runtime is a Node process in `server/`.
- The desktop shell is Electron in `electron/`.
- The developer glue is in `scripts/` and the packaging assets are in `build/`.
- The documentation is in `docs/`.
- The build output is in `dist/`, packaged installers in `release/`.
- Local project metadata is in `.acidmade/` (ignored by git).

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

### Desktop layout

- `electron/main.mjs` — window, application menu, runtime spawn, IPC handlers.
- `electron/preload.mjs` — `contextBridge` surface exposed as `window.acidmade`.
- `electron/projects.mjs` — project store: list, create, open, tree, read/write,
  create/rename/delete.
- `electron/acm.mjs` — `.acm` container reader and writer (zip, CRC32, no
  dependencies).
- `electron-builder.yml` — packaging targets for Linux, Windows and macOS.
- `build/` — generated icon and macOS entitlements.
- `.github/workflows/release.yml` — tag, draft release and artifact publishing.

### Project store IPC

The renderer never touches the filesystem. It calls `window.acidmade.projects`,
which maps to these channels, all handled in `electron/main.mjs`:

| Channel | Purpose |
| --- | --- |
| `acidmade:projects:list` | Projects in the projects folder |
| `acidmade:projects:create` | Create a `.acm` project |
| `acidmade:projects:open-dialog` | Pick an existing `.acm` |
| `acidmade:projects:reveal` | Show the file in the system file manager |
| `acidmade:projects:tree` | Entries, each tagged as a file or a directory |
| `acidmade:projects:read-file` | Read one entry |
| `acidmade:projects:write-file` | Rewrite one entry |
| `acidmade:projects:create-entry` | Add a file or a directory entry |
| `acidmade:projects:rename-entry` | Move a file, or a folder prefix |
| `acidmade:projects:delete-entry` | Remove a file, or a folder prefix |

Every channel is validated in the store, not in the renderer: paths are
normalised, traversal is rejected and collisions are refused.

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
| `npm run docs:pdf` | Regenerate `public/AcidMade-Documentation.pdf` from the manual. |
| `npm run icon` | Regenerate the application icon. |
| `npm run desktop` | Build the frontend and launch Electron. |
| `npm run package:linux` | AppImage and Flatpak installers. |
| `npm run package:win` | Setup, MSI and portable builds. |
| `npm run package:mac` | DMG, zip and the `.app` bundle. |

### Developer scripts

- `scripts/dev.mjs` starts both processes and keeps them together.
- `scripts/gen-readme.mjs` regenerates the README badge and build-status placeholders.
- `scripts/gen-badge.mjs` writes the build badge.
- `scripts/check-readme.mjs` checks the README for missing sections.
- `scripts/gen-icon.mjs` renders the application icon used by the installers.
- `scripts/gen-docs-pdf.mjs` turns `docs/acidmade-manual.md` into the PDF, with no
  system dependency (no LaTeX, no headless browser).

## Test approach

The project is verified by running it and checking the behavior you care about.

- Visual checks are done in the browser preview.
- Build checks are done with `npm run build` and `npm run typecheck`.
- Persistence checks are done by adding nodes and overrides, reloading, and resetting.
- Provider checks are done with a real or mock provider through the runtime.
- Container checks are done by creating a project in the desktop app, adding and
  moving resources, saving, then reopening the `.acm` with an archive tool.

There is no heavy automated suite yet. The project store can be exercised in
isolation with a small Node script against `createProjectStore`, which is how the
container format is checked before packaging. When you add tests, keep them
focused on the behavior the project actually exposes.

## Documentation conventions

- The README is the front door.
- The docs console in the editor renders `docs/` files.
- The docs files are the source of truth for deeper reference.
- The README badge and build-status placeholders are regenerated from scripts.
- If you change a documented behavior, update the docs and the README placeholders.

## Contribution agreement

- Keep the UI dense and desktop-first.
- Keep the scene format honest.
- Keep the `.acm` container the single project unit; do not reintroduce scattered
  project folders as the primary format.
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
