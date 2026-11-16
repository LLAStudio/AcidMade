# AcidMade File System and Resources

AcidMade models its project as `res://` resources. The file system dock is the editor's resource browser, and the preview composites those resources into the scene.

## Project container (`.acm`)

A project is a single file with the `.acm` extension. Inside it is a zip archive
with stored entries, so the container stays inspectable and repairable with
ordinary archive tools. The reader also accepts deflated entries, so containers
produced elsewhere open without conversion.

| Entry | Required | Content |
| --- | --- | --- |
| `acidmade.json` | yes | Project manifest |
| `scenes/MainApp.acid` | yes | Entry scene |
| `acid.config.json` | no | Accent, density and radius tokens |
| `agents/*.agent.ts` | no | Agent scripts |
| `prompts/*.prompt` | no | Reusable agent prompts |
| `README.md` | no | Human notes |

Manifest fields: `format` (`acm/1.0`), `name`, `slug`, `branch`, `environment`,
`scene`, `template`, `summary`, `createdAt`, `updatedAt`. Every write rewrites
the archive and refreshes `updatedAt`; reads never mutate the file.

Guards: entry paths are normalised and rejected when they contain `..`, and a
resource larger than 2 MB is refused by the reader. Folder projects from older
builds, with an `acidmade.json` at their root, keep opening and editing normally.

## Managing resources

The file dock is also a manager. In the desktop app, where the project is backed
by a container on disk:

- **New file** writes an entry with starter content per extension: an `acid/1.0`
  scene skeleton for `.acid`, `{}` for `.json`, a short instruction for `.prompt`,
  a heading for `.md`.
- **New folder** writes a directory entry, so an empty folder stays visible.
- **Rename** moves one resource, or every entry under a folder. The target must
  not exist and `..` is rejected.
- **Delete** removes a file, or a folder with everything inside it, after a
  confirmation.
- **Drag and drop** a resource onto a folder header or an empty folder row to move
  it there; dropping on the `root` header moves it back to the project root. A
  folder cannot be dropped inside its own subtree.

All of these rewrite the archive through the same store, so the manifest
timestamp and the container's checksums stay consistent. In the browser preview
there is no filesystem access: the dock is read-only and the controls are
disabled.

## Resource model

A resource is a named file in the project's resource tree.

- The root is `res://`.
- Resources live under folders such as `scenes/`, `components/`, `agents/`, `api/`, and the root config.
- Every resource has an id, a path, a name, a group, a language, and optional content.
- Some resources are scenes, some are code, some are prompts, some are config.

## `res://` paths

The `res://` scheme is the shared name space for scenes, scripts, agents, components, and config.

- Scenes are JSON resources.
- Components, agents, and endpoints are code resources.
- Prompts are prompt resources.
- Project config is a JSON resource at the root.

The provider and runtime both use `res://` paths as the stable identifiers for resources.

## File system dock

The file system dock is the left dock's lower section.

### Features

- Browse `res://` resources grouped by folder.
- Expand and collapse folders.
- Search resources by name and path.
- Open a resource as a tab.
- Show the active file at the bottom of the dock.

### Groups

The file system dock groups resources by top-level folder. Each group shows a count and a folder icon, and the active file is highlighted.

### Search

Search matches against the resource path and name. When a query is active, the dock shows only matches.

## Resource types

### Scenes

Scenes are JSON resources that describe a subtree of the scene graph.

- `res://scenes/MainApp.acid` is the application root scene.
- Other scenes attach to nodes in the tree.
- Scenes carry the class, parent, layout, bindings, agents, and signals for their subtree.

### Code resources

Code resources are the scripts attached to nodes.

- Components are UI code.
- Agents are agent definitions.
- Endpoints are API code.
- Code resources are readable in the script view.

### Prompt resources

Prompt resources hold agent or operator instructions.

- The default project includes a prompt resource for the DataAnalystAgent.
- Prompt resources are readable in the script view.

### Config resources

Config resources hold project metadata and engine settings.

- `acid.config.json` holds project, runtime, build, and signal settings.

## Preview compositing

The preview renders the scene as a composited UI shell.

- The default scene renders as a Northwind-style dashboard shell.
- The shell includes a top navbar, a metrics grid, a live feed endpoint, and the agent overlay during runs.
- The viewport shows the preview inside a device frame, with zoom, grid, and chrome toggles.
- Added nodes that are not yet part of the composited preview are annotated in the viewport.

## Resource lifecycle

- Resources are opened as tabs from the file system dock.
- Tabs are part of the editor session and persist across reloads through the workspace snapshot.
- The active file id is part of the saved session.
- Closing a tab updates the saved session; reopening a resource clears its tab-closed state.

## Resource naming

- Resource names should be stable and readable.
- Scene names should match the node names they describe.
- Script names should match the class they implement where practical.
- The file system dock shows the language in uppercase under each file.

## Editing resources

- Resources are edited in the script view.
- The provider can stage scene changes that reference resources by `res://` path.
- The runtime can read and write resources scoped to `res://`.
- The inspector edits node properties; it does not edit raw resource files directly.

## Resource discovery

The editor discovers resources from the project's resource list, backed by the
`.acm` container when the project lives on disk.

- The container's entries are the source of truth for tab ids, file ids, and the file system dock contents.
- The provider context uses resource names and paths to describe the active scene.
- The runtime resolves `res://` paths when it reads or writes resources.

## Troubleshooting

### Resource not found

If a node references a resource that is not in the resource list, the editor cannot open it as a tab. Check that the resource exists in the file system dock.

### Preview does not reflect added node

Added nodes are annotated in the viewport until the scene is rebuilt. The preview composites the current scene, not every pending tree change.

### Tab does not reopen on reload

Tab state is part of the workspace snapshot. If a tab was closed, it stays closed until you reopen the resource. The default tabs reopen on reset.
