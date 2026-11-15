import { useMemo, useState } from "react";
import {
  Boxes,
  ChevronRight,
  FileCode2,
  FileJson,
  Folder,
  FolderOpen,
  GitBranch,
  Layers,
  Plus,
  Rocket,
  Search,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { CODE_FILES } from "../data/resources";
import { PROJECT_TEMPLATES, type Project } from "../data/projects";
import { cx, uid } from "../lib/utils";
import type { CodeFile } from "../types";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-project"
  );
}

function FileGlyph({ file }: { file: CodeFile }) {
  if (file.language === "json") return <FileJson size={11} className="text-[#38BDF8]/75" />;
  if (file.language === "prompt") return <Sparkles size={11} className="text-acid/70" />;
  return <FileCode2 size={11} className="text-[#A3E635]/70" />;
}

export function ProjectManager() {
  const { projects, project, launchProject, createProject, openFile } = useEngine();

  const [query, setQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [selectedId, setSelectedId] = useState(project.id);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    scenes: true,
    agents: true,
    api: true,
  });
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftTemplate, setDraftTemplate] = useState(PROJECT_TEMPLATES[0].id);

  const selected = projects.find((entry) => entry.id === selectedId) ?? projects[0];

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((entry) =>
      (entry.name + " " + entry.slug + " " + entry.branch + " " + entry.environment)
        .toLowerCase()
        .includes(needle),
    );
  }, [projects, query]);

  const folders = useMemo(() => {
    const needle = fileQuery.trim().toLowerCase();
    const groups = new Map<string, CodeFile[]>();
    for (const file of CODE_FILES) {
      if (needle && !(file.path + " " + file.name).toLowerCase().includes(needle)) continue;
      const folder = file.path.includes("/") ? file.path.split("/")[0] : "root";
      const list = groups.get(folder) ?? [];
      list.push(file);
      groups.set(folder, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [fileQuery]);

  const activeFile = CODE_FILES.find((file) => file.id === selectedFileId) ?? null;

  const enter = (target: Project, filePath?: string) => {
    launchProject(target);
    if (filePath) openFile(filePath);
  };

  const submitNewProject = () => {
    const name = draftName.trim();
    if (!name) return;
    const template = PROJECT_TEMPLATES.find((entry) => entry.id === draftTemplate) ?? PROJECT_TEMPLATES[0];
    const next: Project = {
      id: uid("project"),
      name,
      slug: slugify(name),
      branch: "main",
      environment: "Local",
      path: "~/AcidMade/" + slugify(name),
      summary: template.summary,
      scene: template.scene,
      template: template.name,
      updated: "just now",
      custom: true,
    };
    createProject(next);
    setSelectedId(next.id);
    setCreating(false);
    setDraftName("");
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

        <div className="ml-4 flex h-[26px] min-w-0 max-w-[420px] flex-1 items-center gap-1.5 border border-line bg-panel px-2">
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
          onClick={() => setCreating(true)}
          className="flex h-[26px] items-center gap-1.5 border border-line bg-panel px-2 text-[10.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <Plus size={11} />
          New project
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

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[214px] shrink-0 flex-col border-r border-line bg-panel sm:w-[248px] xl:w-[290px]">
          <div className="flex h-[26px] shrink-0 items-center gap-1 border-b border-line px-2">
            <span className="label-caps text-zinc-400">Projects</span>
            <span className="font-mono text-[8px] text-zinc-700">{projects.length}</span>
            <span className="ml-auto font-mono text-[8px] text-zinc-700">local</span>
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
                    active
                      ? "border-acid bg-acid/[0.06]"
                      : "border-transparent hover:bg-white/[0.03]",
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <Folder size={11} className={active ? "text-acid" : "text-zinc-600"} />
                    <span
                      className={cx(
                        "truncate text-[11px]",
                        active ? "text-zinc-100" : "text-zinc-400",
                      )}
                    >
                      {entry.name}
                    </span>
                    {entry.custom ? (
                      <span className="ml-auto font-mono text-[7px] uppercase tracking-[0.08em] text-acid/60">
                        new
                      </span>
                    ) : null}
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
              <p className="px-3 py-6 text-[10px] leading-relaxed text-zinc-600">
                No project matches “{query}”. Clear the search or create a new project.
              </p>
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
                    {selected?.name}
                  </h1>
                  <span className="border border-line px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-500">
                    {selected?.environment}
                  </span>
                  <span className="font-mono text-[8.5px] text-zinc-600">{selected?.slug}</span>
                </div>
                <p className="mt-1 max-w-[70ch] text-[10.5px] leading-relaxed text-zinc-500">
                  {selected?.summary ?? "No description yet."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => selected && enter(selected)}
                className="flex h-[26px] shrink-0 items-center gap-1.5 border border-acid/40 bg-acid/[0.1] px-2.5 text-[10px] font-medium text-acid transition-colors hover:bg-acid/[0.16]"
              >
                <Rocket size={11} />
                Open
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line-soft pt-2 font-mono text-[9px] md:grid-cols-4">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">branch</dt>
                <dd className="truncate text-zinc-400">{selected?.branch}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">scene</dt>
                <dd className="truncate text-zinc-400">{selected?.scene ?? "res://scenes/MainApp.acid"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">files</dt>
                <dd className="text-zinc-400">{CODE_FILES.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-zinc-700">updated</dt>
                <dd className="truncate text-zinc-400">{selected?.updated ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="flex h-[27px] shrink-0 items-center gap-1.5 border-b border-line bg-panel px-2">
            <span className="label-caps text-zinc-400">Files</span>
            <span className="font-mono text-[8px] text-zinc-700">res://</span>
            <div className="ml-auto flex h-[20px] w-[190px] items-center gap-1 border border-line-soft bg-void px-1.5">
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
            {folders.map(([folder, files]) => {
              const open = openFolders[folder] ?? false;
              return (
                <div key={folder}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFolders((current) => ({ ...current, [folder]: !open }))
                    }
                    className="flex h-[22px] w-full items-center gap-1.5 px-3 font-mono text-[10px] text-zinc-500 hover:bg-white/[0.03]"
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
                    <span className="ml-auto text-[7.5px] text-zinc-700">{files.length}</span>
                  </button>
                  {open
                    ? files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setSelectedFileId(file.id)}
                          onDoubleClick={() => enter(selected, file.path)}
                          className={cx(
                            "flex h-[21px] w-full items-center gap-1.5 pl-8 pr-3 text-left font-mono text-[10px] transition-colors",
                            selectedFileId === file.id
                              ? "bg-acid/[0.07] text-zinc-100"
                              : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
                          )}
                        >
                          <FileGlyph file={file} />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </main>

        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-line bg-panel xl:flex">
          <div className="flex h-[26px] shrink-0 items-center gap-1 border-b border-line px-2">
            <span className="label-caps text-zinc-400">{activeFile ? "File" : "Project"}</span>
            <span className="ml-auto font-mono text-[8px] text-zinc-700">res://</span>
          </div>

          {activeFile ? (
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
              <div className="flex items-center gap-1.5">
                <FileGlyph file={activeFile} />
                <span className="truncate text-[11px] text-zinc-200">{activeFile.name}</span>
              </div>
              <div className="mt-1 break-all font-mono text-[8.5px] text-zinc-600">
                res://{activeFile.path}
              </div>
              <dl className="mt-3 space-y-1 border-t border-line-soft pt-2 font-mono text-[9px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-700">language</dt>
                  <dd className="text-zinc-400">{activeFile.language}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-700">group</dt>
                  <dd className="text-zinc-400">{activeFile.group}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-700">origin</dt>
                  <dd className="truncate text-zinc-400">{activeFile.generatedBy}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-700">changes</dt>
                  <dd className="text-zinc-400">
                    +{activeFile.additions} / −{activeFile.deletions}
                  </dd>
                </div>
              </dl>
              <pre className="scroll-thin mt-3 max-h-[46vh] overflow-auto border border-line-soft bg-void p-2 font-mono text-[8.5px] leading-[1.55] text-zinc-500">
                {activeFile.content.slice(0, 1600)}
              </pre>
              <button
                type="button"
                onClick={() => enter(selected, activeFile.path)}
                className="mt-3 flex h-[26px] w-full items-center justify-center gap-1.5 border border-acid/40 bg-acid/[0.1] text-[10px] font-medium text-acid hover:bg-acid/[0.16]"
              >
                <TerminalSquare size={11} />
                Open in editor
              </button>
            </div>
          ) : (
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
              <p className="text-[10px] leading-relaxed text-zinc-600">
                Select a resource to inspect it. Double-click a project or a file to open it in the
                editor.
              </p>
              <div className="mt-3 border border-line-soft p-2">
                <div className="label-caps mb-1 text-zinc-500">Template</div>
                <div className="text-[10px] text-zinc-400">{selected?.template ?? "—"}</div>
              </div>
              <div className="mt-2 border border-line-soft p-2">
                <div className="label-caps mb-1 text-zinc-500">Path</div>
                <div className="break-all font-mono text-[9px] text-zinc-500">
                  {selected?.path ?? "~/AcidMade"}
                </div>
              </div>
              <div className="mt-2 border border-line-soft p-2">
                <div className="label-caps mb-1 text-zinc-500">Persistence</div>
                <div className="font-mono text-[9px] leading-relaxed text-zinc-500">
                  workspace key · acidmade.workspace.v1
                  <br />
                  launcher key · acidmade.launcher.v1
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-shell px-2 font-mono text-[8.5px] text-zinc-600">
        <span className="text-acid/70">● ready</span>
        <span>double-click to open</span>
        <span className="ml-auto">{projects.length} projects · {CODE_FILES.length} resources</span>
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
                    if (event.key === "Enter") submitNewProject();
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
                  onClick={submitNewProject}
                  disabled={!draftName.trim()}
                  className="flex h-[27px] flex-1 items-center justify-center gap-1 border border-acid/40 bg-acid/[0.1] text-[9.5px] font-medium text-acid hover:bg-acid/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-700"
                >
                  <Plus size={10} />
                  Create &amp; open
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
