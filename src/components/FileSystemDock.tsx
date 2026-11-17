import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FileCode2,
  FileJson,
  Folder,
  FolderOpen,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { CODE_FILES, resourceById } from "../data/resources";
import { cx } from "../lib/utils";
import type { CodeFile } from "../types";

function FileIcon({ file }: { file: CodeFile }) {
  if (file.language === "json") return <FileJson size={11} className="text-[#38BDF8]/75" />;
  if (file.language === "prompt") return <Sparkles size={11} className="text-acid/70" />;
  if (file.language === "md") return <FileCode2 size={11} className="text-zinc-500" />;
  return <FileCode2 size={11} className={file.language === "tsx" ? "text-[#38BDF8]/70" : "text-[#A3E635]/70"} />;
}

export function FileSystemDock() {
  const { activeFileId, openFile } = useEngine();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        const input = searchRef.current;
        // The dock is hidden on narrow windows; focusing a hidden input would
        // silently swallow the shortcut.
        if (!input || input.offsetParent === null) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const folders = useMemo(() => {
    const groups = new Map<string, CodeFile[]>();
    for (const file of CODE_FILES) {
      const folder = file.path.includes("/") ? file.path.split("/")[0] : "res://";
      const list = groups.get(folder) ?? [];
      list.push(file);
      groups.set(folder, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, []);

  const normalized = query.trim().toLowerCase();
  const matches = CODE_FILES.filter((file) => {
    if (!normalized) return true;
    return (file.path + " " + file.name).toLowerCase().includes(normalized);
  });
  const activeFile = resourceById(activeFileId);

  const open = (file: CodeFile) => {
    openFile(file.path);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-[26px] shrink-0 items-center gap-1 border-b border-line px-2">
        <span className="label-caps text-zinc-400">FileSystem</span>
        <span className="font-mono text-[8px] text-zinc-700">{CODE_FILES.length}</span>
        <div className="ml-auto flex items-center gap-1 font-mono text-[8px] text-zinc-700">
          <Folder size={10} />
          res://
        </div>
      </div>

      <div className="flex h-[25px] shrink-0 items-center gap-1 border-b border-line-soft px-1.5">
        <Search size={10} className="shrink-0 text-zinc-600" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files"
          aria-label="Search files"
          title="Search files  (Ctrl/Cmd+P)"
          spellCheck={false}
          className="h-[20px] min-w-0 flex-1 bg-transparent px-0.5 font-mono text-[10.5px] text-zinc-300 outline-none placeholder:text-zinc-600"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear file search"
            className="grid h-4 w-4 place-items-center text-zinc-600 hover:text-zinc-200"
          >
            <X size={9} />
          </button>
        ) : (
          <span className="font-mono text-[7.5px] text-zinc-700">⌘P</span>
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1">
        <div className="flex h-[22px] items-center gap-1 px-2 font-mono text-[10px] text-zinc-500">
          <ChevronRight size={9} className="rotate-90 text-zinc-600" />
          <FolderOpen size={11} className="text-zinc-600" />
          res://
          <span className="ml-auto text-[7.5px] text-zinc-700">{CODE_FILES.length} res</span>
        </div>

        {normalized ? (
          <div className="mt-0.5">
            {matches.length === 0 ? (
              <div className="px-3 py-3 text-center font-mono text-[9px] text-zinc-600">
                no resources found
              </div>
            ) : (
              matches.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => openFile(file.path)}
                  className={cx(
                    "flex h-[23px] w-full items-center gap-1.5 border-l-2 pl-4 pr-2 text-left font-mono text-[10.5px]",
                    activeFileId === file.id
                      ? "border-acid bg-elevated text-zinc-200"
                      : "border-transparent text-zinc-500 hover:bg-elevated/70 hover:text-zinc-300",
                  )}
                  title={file.path}
                >
                  <FileIcon file={file} />
                  <span className="truncate">{file.path}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          folders.map(([folder, files]) => {
            const isCollapsed = Boolean(collapsed[folder]);
            return (
              <div key={folder}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((current) => ({ ...current, [folder]: !current[folder] }))
                  }
                  className="flex h-[22px] w-full items-center gap-1 pl-4 pr-2 text-left font-mono text-[10px] text-zinc-500 hover:bg-elevated/60 hover:text-zinc-300"
                >
                  <ChevronRight
                    size={9}
                    className={cx("text-zinc-600 transition-transform", !isCollapsed && "rotate-90")}
                  />
                  {isCollapsed ? (
                    <Folder size={11} className="text-zinc-600" />
                  ) : (
                    <FolderOpen size={11} className="text-[#A3E635]/60" />
                  )}
                  <span className="truncate">{folder === "res://" ? folder : folder + "/"}</span>
                  <span className="ml-auto font-mono text-[7.5px] text-zinc-700">{files.length}</span>
                </button>
                {!isCollapsed
                  ? files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => open(file)}
                        className={cx(
                          "flex h-[23px] w-full items-center gap-1.5 border-l-2 pl-[34px] pr-2 text-left font-mono text-[10.5px]",
                          activeFileId === file.id
                            ? "border-acid bg-elevated text-zinc-200"
                            : "border-transparent text-zinc-500 hover:bg-elevated/70 hover:text-zinc-300",
                        )}
                        title={"res://" + file.path + " · " + file.language.toUpperCase()}
                      >
                        <FileIcon file={file} />
                        <span className="truncate">{file.name}</span>
                        {activeFileId === file.id ? (
                          <span className="ml-auto h-[3px] w-[3px] shrink-0 rounded-full bg-acid" />
                        ) : null}
                      </button>
                    ))
                  : null}
              </div>
            );
          })
        )}
      </div>

      <div className="flex h-[19px] shrink-0 items-center gap-1 border-t border-line-soft px-2 font-mono text-[7.5px] text-zinc-700">
        <span className="truncate">{activeFile ? "res://" + activeFile.path : "res://"}</span>
        <span className="ml-auto shrink-0">{activeFile?.language.toUpperCase() ?? "—"}</span>
      </div>
    </div>
  );
}
