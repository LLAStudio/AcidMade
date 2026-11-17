import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Boxes,
  ChevronRight,
  Copy,
  FileCode2,
  FileJson,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  GitBranch,
  HardDrive,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings2,
  Sparkles,
  SquareArrowOutUpRight,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { CODE_FILES } from "../data/resources";
import { PROJECT_TEMPLATES, type Project } from "../data/projects";
import {
  createProjectEntry,
  deleteProjectEntry,
  duplicateProjectEntry,
  isDiskBacked,
  listProjects,
  openProjectFile,
  projectFiles,
  readProjectFile,
  renameProjectEntry,
  revealProject,
  writeProjectFile,
  type ProjectFileContent,
  type ProjectFileInfo,
} from "../lib/projects";
import { cx } from "../lib/utils";
import { SettingsModal } from "./SettingsModal";

function FileGlyph({ language }: { language: string }) {
  if (language === "json") return <FileJson size={11} className="text-[#38BDF8]/75" />;
  if (language === "prompt") return <Sparkles size={11} className="text-acid/70" />;
  return <FileCode2 size={11} className="text-[#A3E635]/70" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function ProjectManager() {
  const {
    projects,
    project,
    launchProject,
    createProject,
    openFile,
    refreshProjects,
    pushLog,
  } = useEngine();

  const disk = isDiskBacked();

  const [root, setRoot] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [selectedId, setSelectedId] = useState(project.id);
  const [files, setFiles] = useState<ProjectFileInfo[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [activePath, setActivePath] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<{ path: string; kind: "file" | "dir" } | null>(null);
  const [entryDialog, setEntryDialog] = useState<{ mode: "file" | "dir" | "rename"; value: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; kind: "file" | "dir" } | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    kind: "file" | "dir";
  } | null>(null);
  const [fileData, setFileData] = useState<ProjectFileContent | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftTemplate, setDraftTemplate] = useState(PROJECT_TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);
  const noteTimer = useRef<number | null>(null);

  const selected = projects.find((entry) => entry.id === selectedId) ?? projects[0] ?? project;

  const flash = useCallback((message: string) => {
    setNote(message);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 4000);
  }, []);

  useEffect(() => {
    void listProjects()
      .then((result) => {
        if (result.diskBacked) setRoot(result.root);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!projects.some((entry) => entry.id === selectedId) && projects[0]) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setFilesLoading(true);
    setActivePath(null);
    setSelectedEntry(null);
    setFileData(null);
    setDraft("");

    projectFiles(selected)
      .then((result) => {
        if (cancelled) return;
        setFiles(result);
        const firstFolder = result[0]?.path.split("/")[0];
        if (firstFolder) setOpenFolders((current) => ({ ...current, [firstFolder]: true }));
      })
      .catch((error: unknown) => {
        if (!cancelled) flash("Could not read project folder: " + String(error));
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, flash, selected]);

  const folders = useMemo(() => {
    const needle = fileQuery.trim().toLowerCase();
    const groups = new Map<string, ProjectFileInfo[]>();
    const implicit = new Set<string>();
    for (const file of files) {
      if (file.kind === "dir") continue;
      const segments = file.path.split("/").slice(0, -1);
      for (let index = 1; index <= segments.length; index += 1) {
        implicit.add(segments.slice(0, index).join("/"));
      }
    }
    for (const file of files) {
      if (file.kind === "dir" && implicit.has(file.path)) continue;
      if (needle && !(file.path + " " + file.name).toLowerCase().includes(needle)) continue;
      const folder = file.path.includes("/") ? file.path.split("/")[0] : "root";
      const list = groups.get(folder) ?? [];
      list.push(file);
      groups.set(folder, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files, fileQuery]);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((entry) =>
      (entry.name + " " + entry.slug + " " + entry.branch + " " + entry.environment)
        .toLowerCase()
        .includes(needle),
    );
  }, [projects, query]);

  const dirty = fileData ? draft !== fileData.content : false;

  const enter = (target: Project, filePath?: string) => {
    launchProject(target);
    if (filePath && CODE_FILES.some((entry) => entry.path === filePath)) openFile(filePath);
  };

  const selectFile = async (file: ProjectFileInfo) => {
    if (!selected) return;
    setSelectedEntry({ path: file.path, kind: "file" });
    setActivePath(file.path);
    try {
      const data = await readProjectFile(selected, file.path);
      setFileData(data);
      setDraft(data.content);
    } catch (error: unknown) {
      setFileData(null);
      setDraft("");
      flash("Could not read " + file.path + ": " + String(error));
    }
  };

  const save = async () => {
    if (!selected || !activePath || !fileData || saving) return;
    setSaving(true);
    try {
      const result = await writeProjectFile(selected, activePath, draft);
      setFileData({ ...fileData, content: draft, size: result.size, mtime: result.mtime });
      setFiles((current) =>
        current.map((entry) =>
          entry.path === activePath ? { ...entry, size: result.size, mtime: result.mtime } : entry,
        ),
      );
      flash("Saved " + activePath);
      pushLog("AcidEngine", "ok", "wrote res://" + activePath + " · " + formatSize(result.size));
      refreshProjects();
    } catch (error: unknown) {
      flash("Save failed: " + String(error));
    } finally {
      setSaving(false);
    }
  };

  const refreshTree = async () => {
    if (!selected) return;
    try {
      setFiles(await projectFiles(selected));
    } catch (error: unknown) {
      flash("Could not refresh resources: " + String(error));
    }
  };

  const submitEntry = async () => {
    if (!selected || !entryDialog || entryBusy) return;
    const value = entryDialog.value.trim();
    if (!value) return;
    setEntryBusy(true);
    try {
      if (entryDialog.mode === "rename") {
        if (!selectedEntry) return;
        const result = await renameProjectEntry(selected, selectedEntry.path, value);
        if (activePath === selectedEntry.path) setActivePath(result.path);
        setSelectedEntry({ path: result.path, kind: selectedEntry.kind });
        flash("Renamed to " + result.path);
        pushLog("AcidEngine", "ok", "renamed res://" + selectedEntry.path + " to res://" + result.path);
      } else {
        const kind = entryDialog.mode;
        await createProjectEntry(selected, value, kind);
        flash((kind === "dir" ? "Created folder " : "Created file ") + value);
        pushLog("AcidEngine", "ok", "created res://" + value);
      }
      await refreshTree();
      refreshProjects();
      setEntryDialog(null);
    } catch (error: unknown) {
      flash("Could not update resources: " + String(error));
    } finally {
      setEntryBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!selected || !deleteTarget || entryBusy) return;
    setEntryBusy(true);
    try {
      const target = deleteTarget;
      const result = await deleteProjectEntry(selected, target.path);
      if (activePath && (activePath === target.path || activePath.startsWith(target.path + "/"))) {
        setActivePath(null);
        setFileData(null);
        setDraft("");
      }
      if (
        selectedEntry &&
        (selectedEntry.path === target.path || selectedEntry.path.startsWith(target.path + "/"))
      ) {
        setSelectedEntry(null);
      }
      flash(
        "Deleted " +
          target.path +
          (result.removed && result.removed > 1 ? " · " + result.removed + " entries" : ""),
      );
      pushLog("AcidEngine", "warn", "deleted res://" + target.path);
      await refreshTree();
      refreshProjects();
      setDeleteTarget(null);
    } catch (error: unknown) {
      flash("Delete failed: " + String(error));
    } finally {
      setEntryBusy(false);
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const openEntry = (entry: { path: string; kind: "file" | "dir" }) => {
    setContextMenu(null);
    if (entry.kind === "dir") {
      const folder = entry.path.split("/")[0];
      setOpenFolders((current) => ({ ...current, [folder]: true }));
      return;
    }
    if (CODE_FILES.some((item) => item.path === entry.path)) {
      enter(selected, entry.path);
      return;
    }
    flash("res://" + entry.path + " is read in the inspector; it has no editor tab");
  };

  const duplicateEntry = async (entry: { path: string; kind: "file" | "dir" }) => {
    setContextMenu(null);
    if (!selected || entryBusy) return;
    setEntryBusy(true);
    try {
      const result = await duplicateProjectEntry(selected, entry.path);
      flash("Duplicated to res://" + result.path);
      pushLog("AcidEngine", "ok", "duplicated res://" + entry.path + " to res://" + result.path);
      await refreshTree();
      refreshProjects();
    } catch (error: unknown) {
      flash("Duplicate failed: " + String(error));
    } finally {
      setEntryBusy(false);
    }
  };

  const moveEntry = async (source: string, into: string) => {
    if (!selected || entryBusy) return;
    const name = source.split("/").at(-1) ?? source;
    const targetPath = into === "root" ? name : into + "/" + name;
    if (targetPath === source) return;
    if (into !== "root" && (into === source || into.startsWith(source + "/"))) {
      flash("A folder cannot be moved inside itself");
      return;
    }
    setEntryBusy(true);
    try {
      const result = await renameProjectEntry(selected, source, targetPath);
      if (activePath === source) setActivePath(result.path);
      if (selectedEntry?.path === source) {
        setSelectedEntry({ path: result.path, kind: selectedEntry.kind });
      }
      flash("Moved res://" + source + " to " + (into === "root" ? "res://" : "res://" + into + "/"));
      pushLog("AcidEngine", "ok", "moved res://" + source + " to res://" + targetPath);
      await refreshTree();
      refreshProjects();
    } catch (error: unknown) {
      flash("Move failed: " + String(error));
    } finally {
      setEntryBusy(false);
    }
  };

  const dropHandlers = (target: string) => ({
    onDragOver: (event: DragEvent) => {
      if (!dragPath) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(target);
    },
    onDragLeave: () => setDropTarget((current) => (current === target ? null : current)),
    onDrop: (event: DragEvent) => {
      if (!dragPath) return;
      event.preventDefault();
      const source = dragPath;
      setDragPath(null);
      setDropTarget(null);
      void moveEntry(source, target);
    },
  });

  const openFolder = async () => {
    if (!disk) {
      flash("Opening a .acm project requires the desktop app");
      return;
    }
    setBusy(true);
    try {
      const opened = await openProjectFile();
      if (opened) {
        refreshProjects();
        setSelectedId(opened.id);
        flash("Opened " + opened.path);
      }
    } catch (error: unknown) {
      flash("Could not open folder: " + String(error));
    } finally {
      setBusy(false);
    }
  };

  const submitNewProject = async () => {
    const name = draftName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const next = await createProject({ name, template: draftTemplate });
      setSelectedId(next.id);
      setCreating(false);
      setDraftName("");
      flash("Created " + next.name + (disk ? " on disk" : " in the browser preview"));
      refreshProjects();
    } catch (error: unknown) {
      flash("Could not create project: " + String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-shell text-zinc-300">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-shell px-3">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[2px] bg-acid shadow-[0_0_12px_rgba(204,255,0,0.16)]">
          <Layers size={13} strokeWidth={2.4} className="text-[#0a0c04]" />
        </span>
        <span className="text-[12px] font-semibold tracking-[-0.01em] text-zinc-100">AcidMade</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-acid/50">
          project manager
        </span>

        <div className="ml-4 flex h-[26px] min-w-0 max-w-[360px] flex-1 items-center gap-1.5 border border-line bg-panel px-2">
          <Search size={11} className="shrink-0 text-zinc-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, branches, environments"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-[10.5px] text-zinc-300 outline-none placeholder:text-zinc-600"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear project search"
              className="grid h-4 w-4 place-items-center text-zinc-600 hover:text-zinc-200"
            >
              <X size={9} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={openFolder}
          disabled={busy}
          className="flex h-[26px] items-center gap-1.5 border border-line bg-panel px-2 text-[10.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:text-zinc-700"
        >
          <FolderSearch size={11} />
          Open project
        </button>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-[26px] items-center gap-1.5 border border-line bg-panel px-2 text-[10.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <Plus size={11} />
          New project
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
          className="grid h-[26px] w-[26px] shrink-0 place-items-center border border-line bg-panel text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <Settings2 size={12} />
        </button>
        <button
          type="button"
          onClick={() => enter(selected)}
          className="flex h-[26px] items-center gap-1.5 border border-acid/40 bg-acid/[0.1] px-2.5 text-[10.5px] font-medium text-acid transition-colors hover:border-acid/70 hover:bg-acid/[0.16]"
        >
          <Boxes size={11} />
          Open editor
        </button>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[214px] shrink-0 flex-col border-r border-line bg-panel sm:w-[248px] xl:w-[286px]">
          <div className="flex h-[26px] shrink-0 items-center gap-1 border-b border-line px-2">
            <span className="label-caps text-zinc-400">Projects</span>
            <span className="font-mono text-[8px] text-zinc-700">{projects.length}</span>
            <span className="ml-auto font-mono text-[8px] text-zinc-700">
              {disk ? ".acm" : "preview"}
            </span>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1">
            {filteredProjects.map((entry) => {
              const active = entry.id === selected?.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  onDoubleClick={() => enter(entry)}
                  className={cx(
                    "group flex w-full flex-col gap-1 border-l-2 px-2.5 py-2 text-left transition-colors",
                    active ? "border-acid bg-acid/[0.06]" : "border-transparent hover:bg-white/[0.03]",
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <Folder size={11} className={active ? "text-acid" : "text-zinc-600"} />
                    <span className={cx("truncate text-[11px]", active ? "text-zinc-100" : "text-zinc-400")}>
                      {entry.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 truncate font-mono text-[8.5px] text-zinc-600">
                    <GitBranch size={8} />
                    {entry.branch}
                    <span className="text-zinc-700">·</span>
                    {entry.environment}
                  </span>
                  <span className="truncate font-mono text-[8px] text-zinc-700">
                    {entry.path ?? "res://"}
                  </span>
                </button>
              );
            })}
            {filteredProjects.length === 0 ? (
              <div className="px-3 py-6">
                <p className="text-[10px] leading-relaxed text-zinc-600">
                  No project matches “{query}”. Clear the search, create one, or open an existing
                  folder.
                </p>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-line p-2">
            <div className="mb-1.5 label-caps text-zinc-500">Templates</div>
            <div className="grid gap-1">
              {PROJECT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setDraftTemplate(template.id);
                    setCreating(true);
                  }}
                  className="flex items-center gap-1.5 border border-line-soft px-2 py-1.5 text-left transition-colors hover:border-zinc-600"
                >
                  <Sparkles size={10} className="shrink-0 text-acid/60" />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">
                    {template.name}
                  </span>
                  <span className="font-mono text-[8px] text-zinc-700">{template.nodes}n</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 basis-[420px] flex-col">
          <div className="shrink-0 border-b border-line bg-panel px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[2px] border border-acid/30 bg-acid/[0.08]">
                <FolderOpen size={16} className="text-acid" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-100">
                    {selected?.name ?? "No project"}
                  </h1>
                  <span className="border border-line px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-500">
                    {selected?.environment ?? "—"}
                  </span>
                  <span className="font-mono text-[8.5px] text-zinc-600">{selected?.slug}</span>
                </div>
                <p className="mt-1 max-w-[70ch] text-[10.5px] leading-relaxed text-zinc-500">
                  {selected?.summary || "No description yet."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!selected) return;
                    void revealProject(selected).then((ok) => {
                      if (!ok) flash("Reveal requires the desktop app");
                    });
                  }}
                  title="Reveal project file"
                  className="flex h-[26px] items-center gap-1.5 border border-line px-2 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                >
                  <SquareArrowOutUpRight size={11} />
                  Reveal
                </button>
                <button
                  type="button"
                  onClick={() => selected && enter(selected)}
                  className="flex h-[26px] items-center gap-1.5 border border-acid/40 bg-acid/[0.1] px-2.5 text-[10px] font-medium text-acid transition-colors hover:bg-acid/[0.16]"
                >
                  <Rocket size={11} />
                  Open
                </button>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line-soft pt-2 font-mono text-[9px] md:grid-cols-4">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">branch</dt>
                <dd className="truncate text-zinc-400">{selected?.branch ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">scene</dt>
                <dd className="truncate text-zinc-400">{selected?.scene ?? "res://scenes/MainApp.acid"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">files</dt>
                <dd className="text-zinc-400">{files.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">updated</dt>
                <dd className="truncate text-zinc-400">{selected?.updated ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="flex h-[27px] shrink-0 items-center gap-1.5 border-b border-line bg-panel px-2">
            <span className="label-caps text-zinc-400">Files</span>
            <span className="font-mono text-[8px] text-zinc-700">{disk ? ".acm" : "catalogue"}</span>
            {filesLoading ? (
              <span className="font-mono text-[8.5px] text-zinc-600">reading…</span>
            ) : null}
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                title="New file"
                aria-label="New file"
                disabled={!disk}
                onClick={() => setEntryDialog({ mode: "file", value: "" })}
                className="grid h-[18px] w-[18px] place-items-center text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-800 disabled:hover:bg-transparent"
              >
                <FilePlus2 size={10} />
              </button>
              <button
                type="button"
                title="New folder"
                aria-label="New folder"
                disabled={!disk}
                onClick={() => setEntryDialog({ mode: "dir", value: "" })}
                className="grid h-[18px] w-[18px] place-items-center text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-800 disabled:hover:bg-transparent"
              >
                <FolderPlus size={10} />
              </button>
              <button
                type="button"
                title="Rename"
                aria-label="Rename selected resource"
                disabled={!disk || !selectedEntry}
                onClick={() =>
                  selectedEntry && setEntryDialog({ mode: "rename", value: selectedEntry.path })
                }
                className="grid h-[18px] w-[18px] place-items-center text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-800 disabled:hover:bg-transparent"
              >
                <Pencil size={9} />
              </button>
              <button
                type="button"
                title="Delete"
                aria-label="Delete selected resource"
                disabled={!disk || !selectedEntry}
                onClick={() => selectedEntry && setDeleteTarget(selectedEntry)}
                className="grid h-[18px] w-[18px] place-items-center text-zinc-600 hover:bg-white/[0.05] hover:text-danger disabled:cursor-not-allowed disabled:text-zinc-800 disabled:hover:bg-transparent"
              >
                <Trash2 size={9} />
              </button>
            </div>
            <div className="flex h-[20px] w-[150px] items-center gap-1 border border-line-soft bg-void px-1.5">
              <Search size={9} className="shrink-0 text-zinc-600" />
              <input
                value={fileQuery}
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder="Filter resources"
                spellCheck={false}
                className="h-full min-w-0 flex-1 bg-transparent font-mono text-[9.5px] text-zinc-300 outline-none placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1">
            {folders.length === 0 && !filesLoading ? (
              <p className="px-4 py-6 text-[10px] leading-relaxed text-zinc-600">
                This project container is empty. Create a scene or write a file from the inspector.
              </p>
            ) : null}
            {folders.map(([folder, entries]) => {
              const open = openFolders[folder] ?? false;
              return (
                <div key={folder}>
                  <button
                    type="button"
                    onClick={() => setOpenFolders((current) => ({ ...current, [folder]: !open }))}
                    title={
                      folder === "root"
                        ? "Drop here to move a resource to the project root"
                        : "Drop here to move a resource into " + folder
                    }
                    {...dropHandlers(folder)}
                    className={cx(
                      "flex h-[22px] w-full items-center gap-1.5 px-3 font-mono text-[10px] hover:bg-white/[0.03]",
                      dropTarget === folder
                        ? "bg-acid/[0.12] text-acid"
                        : "text-zinc-500",
                    )}
                  >
                    <ChevronRight
                      size={9}
                      className={cx("shrink-0 text-zinc-600 transition-transform", open && "rotate-90")}
                    />
                    {open ? (
                      <FolderOpen size={11} className="text-zinc-600" />
                    ) : (
                      <Folder size={11} className="text-zinc-600" />
                    )}
                    {folder}
                    <span className="ml-auto text-[7.5px] text-zinc-700">{entries.length}</span>
                  </button>
                  {open
                    ? entries.map((file) => {
                        if (file.kind === "dir") {
                          return (
                            <button
                              key={"dir:" + file.path}
                              type="button"
                              draggable={disk}
                              onClick={() => setSelectedEntry({ path: file.path, kind: "dir" })}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                setSelectedEntry({ path: file.path, kind: "dir" });
                                setContextMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                  path: file.path,
                                  kind: "dir",
                                });
                              }}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", file.path);
                                setDragPath(file.path);
                              }}
                              onDragEnd={() => {
                                setDragPath(null);
                                setDropTarget(null);
                              }}
                              {...dropHandlers(file.path)}
                              title={"Drop here to move a resource into " + file.path}
                              className={cx(
                                "flex h-[21px] w-full items-center gap-1.5 pl-8 pr-3 text-left font-mono text-[10px] transition-colors",
                                dropTarget === file.path
                                  ? "bg-acid/[0.12] text-acid"
                                  : selectedEntry?.path === file.path && selectedEntry.kind === "dir"
                                    ? "bg-white/[0.05] text-zinc-100"
                                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
                              )}
                            >
                              <Folder size={11} className="text-zinc-600" />
                              <span className="truncate">{file.name}</span>
                              <span className="ml-auto shrink-0 text-[7.5px] text-zinc-700">empty</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            key={file.path}
                            type="button"
                            draggable={disk}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", file.path);
                              setDragPath(file.path);
                            }}
                            onDragEnd={() => {
                              setDragPath(null);
                              setDropTarget(null);
                            }}
                            onClick={() => void selectFile(file)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setSelectedEntry({ path: file.path, kind: "file" });
                              void selectFile(file);
                              setContextMenu({
                                x: event.clientX,
                                y: event.clientY,
                                path: file.path,
                                kind: "file",
                              });
                            }}
                            onDoubleClick={() => {
                              if (CODE_FILES.some((entry) => entry.path === file.path)) {
                                enter(selected, file.path);
                              } else {
                                flash("res://" + file.path + " is inside the .acm but not in the editor catalogue");
                              }
                            }}
                            className={cx(
                              "flex h-[21px] w-full items-center gap-1.5 pl-8 pr-3 text-left font-mono text-[10px] transition-colors",
                              activePath === file.path
                                ? "bg-acid/[0.07] text-zinc-100"
                                : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
                            )}
                          >
                            <FileGlyph language={file.language} />
                            <span className="truncate">{file.name}</span>
                            <span className="ml-auto shrink-0 text-[7.5px] text-zinc-700">
                              {formatSize(file.size)}
                            </span>
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })}
          </div>
        </main>

        <aside className="hidden w-[320px] shrink-0 flex-col border-l border-line bg-panel xl:flex">
          <div className="flex h-[26px] shrink-0 items-center gap-1 border-b border-line px-2">
            <span className="label-caps text-zinc-400">{activePath ? "File" : "Project"}</span>
            <span className="ml-auto font-mono text-[8px] text-zinc-700">res://</span>
          </div>

          {activePath && fileData ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-line px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <FileGlyph language={fileData.language} />
                  <span className="truncate text-[11px] text-zinc-200">
                    {activePath.split("/").at(-1)}
                  </span>
                  {dirty ? (
                    <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.08em] text-warn">
                      edited
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 break-all font-mono text-[8.5px] text-zinc-600">
                  res://{activePath}
                </div>
                <div className="mt-1 flex gap-3 font-mono text-[8.5px] text-zinc-700">
                  <span>{formatSize(fileData.size)}</span>
                  <span>{fileData.language}</span>
                  <span>{new Date(fileData.mtime).toLocaleString()}</span>
                </div>
              </div>

              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void save();
                  }
                }}
                spellCheck={false}
                readOnly={!disk}
                className="scroll-thin min-h-0 flex-1 resize-none bg-void p-2 font-mono text-[9px] leading-[1.6] text-zinc-400 outline-none"
              />

              <div className="flex shrink-0 items-center gap-1.5 border-t border-line p-2">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!dirty || saving || !disk}
                  className="flex h-[26px] flex-1 items-center justify-center gap-1.5 border border-acid/40 bg-acid/[0.1] text-[10px] font-medium text-acid hover:bg-acid/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-700"
                >
                  <Save size={11} />
                  {saving ? "Saving…" : disk ? "Save to disk" : "Read-only"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (CODE_FILES.some((entry) => entry.path === activePath)) {
                      setActivePath(null);
                      enter(selected, activePath);
                    } else {
                      flash("Not in the editor catalogue · edit it here instead");
                    }
                  }}
                  className="flex h-[26px] items-center gap-1.5 border border-line px-2 text-[10px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
                >
                  <TerminalSquare size={11} />
                  Editor
                </button>
              </div>
            </div>
          ) : (
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
              <p className="text-[10px] leading-relaxed text-zinc-600">
                Select a file to read it from the .acm container. The desktop build writes it back
                when you save; the browser preview is read-only.
              </p>
              <div className="mt-3 border border-line-soft p-2">
                <div className="label-caps mb-1 text-zinc-500">Project file</div>
                <div className="break-all font-mono text-[9px] text-zinc-500">
                  {selected?.path ?? "~/AcidMade"}
                </div>
              </div>
              <div className="mt-2 border border-line-soft p-2">
                <div className="label-caps mb-1 text-zinc-500">Template</div>
                <div className="text-[10px] text-zinc-400">{selected?.template ?? "—"}</div>
              </div>
              <div className="mt-2 flex items-center gap-2 border border-line-soft p-2">
                <HardDrive size={12} className={disk ? "text-acid" : "text-zinc-600"} />
                <div className="font-mono text-[9px] leading-relaxed text-zinc-500">
                  {disk ? "filesystem · IPC" : "browser preview · read-only"}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-shell px-2 font-mono text-[8.5px] text-zinc-600">
        <span className="text-acid/70">● {disk ? "disk" : "preview"}</span>
        <span className="truncate">{root || "res:// (browser preview)"}</span>
        {note ? <span className="truncate text-zinc-300">{note}</span> : null}
        <span className="ml-auto shrink-0">
          {projects.length} projects · {files.length} files
        </span>
        <button
          type="button"
          onClick={() => {
            refreshProjects();
            if (selected) void projectFiles(selected).then(setFiles).catch(() => undefined);
          }}
          className="grid h-4 w-4 place-items-center text-zinc-600 hover:text-zinc-300"
          aria-label="Refresh projects"
        >
          <RefreshCw size={9} />
        </button>
      </footer>

      {creating ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-6"
          onMouseDown={() => setCreating(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="w-[380px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
              <span id="new-project-title" className="text-[11px] font-semibold text-zinc-200">
                New project
              </span>
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Close new project dialog"
                className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
              >
                <X size={12} />
              </button>
            </div>
            <div className="space-y-3 p-3.5">
              <label className="block">
                <span className="label-caps text-zinc-500">Name</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitNewProject();
                  }}
                  placeholder="Orbital Console"
                  autoFocus
                  spellCheck={false}
                  className="mt-1 h-[26px] w-full border border-line bg-void px-2 font-mono text-[10.5px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-acid/50"
                />
              </label>
              <div>
                <span className="label-caps text-zinc-500">Template</span>
                <div className="mt-1 grid gap-1">
                  {PROJECT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setDraftTemplate(template.id)}
                      className={cx(
                        "border px-2 py-1.5 text-left transition-colors",
                        draftTemplate === template.id
                          ? "border-acid/50 bg-acid/[0.07]"
                          : "border-line hover:border-zinc-600",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-300">{template.name}</span>
                        <span className="ml-auto font-mono text-[8px] text-zinc-600">
                          {template.nodes} nodes · {template.agents} agents
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-600">
                        {template.summary}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[9px] leading-relaxed text-zinc-600">
                {disk
                  ? "The folder, scene and manifest are written to your AcidMade projects directory."
                  : "The browser preview keeps this project in local storage; the desktop build writes a real folder."}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="flex h-[27px] flex-1 items-center justify-center border border-line text-[9.5px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitNewProject()}
                  disabled={!draftName.trim() || busy}
                  className="flex h-[27px] flex-1 items-center justify-center gap-1 border border-acid/40 bg-acid/[0.1] text-[9.5px] font-medium text-acid hover:bg-acid/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-700"
                >
                  <Plus size={10} />
                  {busy ? "Creating…" : "Create & open"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          role="menu"
          aria-label={"Actions for res://" + contextMenu.path}
          className="fixed z-[90] w-[188px] border border-line bg-panel py-1 shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 196),
            top: Math.min(contextMenu.y, window.innerHeight - 164),
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="truncate px-2 pb-1 font-mono text-[8px] text-zinc-600">
            res://{contextMenu.path}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => openEntry(contextMenu)}
            className="flex h-[24px] w-full items-center gap-2 px-2 text-left text-[10px] text-zinc-300 hover:bg-white/[0.05]"
          >
            <SquareArrowOutUpRight size={10} className="text-zinc-500" />
            Open
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!disk}
            onClick={() => {
              const target = { path: contextMenu.path, kind: contextMenu.kind };
              setContextMenu(null);
              setEntryDialog({ mode: "rename", value: target.path });
            }}
            className="flex h-[24px] w-full items-center gap-2 px-2 text-left text-[10px] text-zinc-300 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
          >
            <Pencil size={9} className="text-zinc-500" />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!disk}
            onClick={() => void duplicateEntry(contextMenu)}
            className="flex h-[24px] w-full items-center gap-2 px-2 text-left text-[10px] text-zinc-300 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
          >
            <Copy size={9} className="text-zinc-500" />
            Duplicate
          </button>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            disabled={!disk}
            onClick={() => {
              const target = { path: contextMenu.path, kind: contextMenu.kind };
              setContextMenu(null);
              setDeleteTarget(target);
            }}
            className="flex h-[24px] w-full items-center gap-2 px-2 text-left text-[10px] text-danger hover:bg-danger/[0.08] disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
          >
            <Trash2 size={9} />
            Delete
          </button>
        </div>
      ) : null}

      {entryDialog ? (
        <div
          className="fixed inset-0 z-[85] grid place-items-center bg-black/70 p-6"
          onMouseDown={() => setEntryDialog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-dialog-title"
            className="w-[340px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
              <span id="entry-dialog-title" className="text-[11px] font-semibold text-zinc-200">
                {entryDialog.mode === "rename"
                  ? "Rename resource"
                  : entryDialog.mode === "dir"
                    ? "New folder"
                    : "New file"}
              </span>
              <button
                type="button"
                onClick={() => setEntryDialog(null)}
                aria-label="Close resource dialog"
                className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
              >
                <X size={12} />
              </button>
            </div>
            <div className="space-y-2 p-3">
              <label className="block">
                <span className="label-caps text-zinc-500">
                  {entryDialog.mode === "rename" ? "New path" : "Path inside the container"}
                </span>
                <input
                  value={entryDialog.value}
                  onChange={(event) =>
                    setEntryDialog((current) =>
                      current ? { ...current, value: event.target.value } : current,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitEntry();
                  }}
                  placeholder={entryDialog.mode === "dir" ? "systems" : "scenes/NewScene.acid"}
                  autoFocus
                  spellCheck={false}
                  className="mt-1 h-[26px] w-full border border-line bg-void px-2 font-mono text-[10.5px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-acid/50"
                />
              </label>
              <p className="text-[9px] leading-relaxed text-zinc-600">
                {entryDialog.mode === "rename"
                  ? "Renaming a folder moves every resource inside it. The path must not already exist."
                  : entryDialog.mode === "dir"
                    ? "Folders are entries in the .acm container; an empty folder stays visible in this list."
                    : "The file is written into the .acm container with starter content for known extensions."}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEntryDialog(null)}
                  className="flex h-[27px] flex-1 items-center justify-center border border-line text-[9.5px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitEntry()}
                  disabled={!entryDialog.value.trim() || entryBusy}
                  className="flex h-[27px] flex-1 items-center justify-center gap-1 border border-acid/40 bg-acid/[0.1] text-[9.5px] font-medium text-acid hover:bg-acid/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-700"
                >
                  {entryBusy ? "Working…" : entryDialog.mode === "rename" ? "Rename" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[85] grid place-items-center bg-black/70 p-6"
          onMouseDown={() => setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-[340px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
              <span id="delete-dialog-title" className="text-[11px] font-semibold text-zinc-200">
                Delete {deleteTarget.kind === "dir" ? "folder" : "file"}
              </span>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                aria-label="Close delete dialog"
                className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
              >
                <X size={12} />
              </button>
            </div>
            <div className="space-y-2 p-3">
              <p className="break-all font-mono text-[10px] text-zinc-300">res://{deleteTarget.path}</p>
              <p className="text-[9px] leading-relaxed text-zinc-500">
                {deleteTarget.kind === "dir"
                  ? "The folder and everything inside it are removed from the container."
                  : "The resource is removed from the container. This cannot be undone."}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex h-[27px] flex-1 items-center justify-center border border-line text-[9.5px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitDelete()}
                  disabled={entryBusy}
                  className="flex h-[27px] flex-1 items-center justify-center gap-1 border border-danger/40 bg-danger/[0.1] text-[9.5px] font-medium text-danger hover:bg-danger/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-700"
                >
                  <Trash2 size={10} />
                  {entryBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
