import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  FileCode2,
  FileJson,
  Plus,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { CODE_FILES, resourceById } from "../data/resources";
import { findSceneNode, isDescendant } from "../data/scene";
import { tabIdForFile } from "../lib/tabs";
import { cx } from "../lib/utils";
import type { CodeFile } from "../types";

interface SceneTab {
  id: string;
  label: string;
  path: string;
  fileId?: string;
  nodeId?: string;
  viewport?: boolean;
  prompt?: boolean;
  dirty?: boolean;
}

const BASE_TABS: SceneTab[] = [
  {
    id: "main-scene",
    label: "MainApp.acid",
    path: "scenes/MainApp.acid",
    fileId: "main-scene",
    nodeId: "main-app",
    viewport: true,
    dirty: true,
  },
  {
    id: "dashboard-scene",
    label: "DashboardPage.acid",
    path: "scenes/DashboardPage.acid",
    fileId: "dashboard-scene",
    nodeId: "dashboard-page",
    viewport: true,
  },
  {
    id: "data-agent-prompt",
    label: "DataAnalystAgent.prompt",
    path: "agents/DataAnalystAgent.prompt",
    fileId: "data-agent-prompt",
    prompt: true,
  },
];

function TabIcon({ tab, size = 11 }: { tab: SceneTab; size?: number }) {
  if (tab.prompt) return <Bot size={size} className="text-acid/70" />;
  if (tab.path.endsWith(".json")) return <FileJson size={size} className="text-[#38BDF8]/70" />;
  return <FileCode2 size={size} className="text-zinc-500" />;
}

export function SceneTabs() {
  const {
    mode,
    setMode,
    tree,
    selectedNodeId,
    selectNode,
    activeFileId,
    openFile,
    closedTabIds,
    closeTab,
    openTab,
  } = useEngine();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const activeFile = resourceById(activeFileId);
  const selected = findSceneNode(tree, selectedNodeId);
  const inDashboard =
    selectedNodeId === "dashboard-page" ||
    isDescendant(tree, "dashboard-page", selectedNodeId);
  const viewportTabId = inDashboard ? "dashboard-scene" : "main-scene";

  const dynamicTab: SceneTab | null = useMemo(() => {
    if (!activeFile) return null;
    if (BASE_TABS.some((tab) => tab.fileId === activeFile.id)) return null;
    return {
      id: "file-" + activeFile.id,
      label: activeFile.name,
      path: activeFile.path,
      fileId: activeFile.id,
      prompt: activeFile.language === "prompt",
    };
  }, [activeFile]);

  const activeTabId =
    mode === "script" && activeFile
      ? BASE_TABS.find((tab) => tab.fileId === activeFile.id)?.id ?? dynamicTab?.id
      : viewportTabId;
  const closedTabs = useMemo(() => new Set(closedTabIds), [closedTabIds]);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [pickerOpen]);

  const tabs = BASE_TABS.filter((tab) => !closedTabs.has(tab.id));
  if (dynamicTab && !closedTabs.has(dynamicTab.id)) tabs.push(dynamicTab);

  const activate = (tab: SceneTab) => {
    if (tab.viewport && tab.nodeId) {
      setMode("viewport");
      selectNode(tab.nodeId);
      return;
    }
    if (tab.fileId) {
      const file = CODE_FILES.find((entry) => entry.id === tab.fileId);
      if (file) openFile(file.path);
    }
  };

  const handleCloseTab = (tab: SceneTab) => {
    closeTab(tab.id);
    if (activeTabId !== tab.id) return;
    setMode("viewport");
    selectNode(viewportTabId === "dashboard-scene" ? "dashboard-page" : "main-app");
  };

  const openResource = (file: CodeFile) => {
    openTab(tabIdForFile(file.id));
    setPickerOpen(false);
    if (file.id === "main-scene") {
      setMode("viewport");
      selectNode("main-app");
      return;
    }
    if (file.id === "dashboard-scene") {
      setMode("viewport");
      selectNode("dashboard-page");
      return;
    }
    openFile(file.path);
  };

  const breadcrumb =
    mode === "script" && activeFile
      ? "res://" + activeFile.path
      : inDashboard
        ? "res://scenes/DashboardPage.acid"
        : "res://scenes/MainApp.acid";

  return (
    <div className="flex h-7 shrink-0 items-stretch border-b border-line bg-panel">
      <div className="relative flex min-w-0 flex-1 items-end overflow-visible px-1">
        <div className="flex min-w-0 items-end gap-[2px] overflow-x-auto scroll-thin">
          {tabs.map((tab) => {
            const active = activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                className={cx(
                  "group relative flex h-[23px] min-w-[92px] max-w-[190px] shrink items-center border-x border-t",
                  active
                    ? "border-line bg-void text-zinc-200"
                    : "border-transparent bg-panel text-zinc-500 hover:bg-elevated hover:text-zinc-300",
                )}
              >
                {active ? <span className="absolute left-0 right-0 top-0 h-[1.5px] bg-acid" /> : null}
                <button
                  type="button"
                  onClick={() => activate(tab)}
                  className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 pr-1 text-[11px]"
                  title={tab.path}
                >
                  <TabIcon tab={tab} />
                  <span className="truncate">{tab.label}</span>
                  {tab.dirty ? <span className="text-acid/70">*</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseTab(tab)}
                  aria-label={"Close " + tab.label}
                  className={cx(
                    "mr-1 grid h-[15px] w-[15px] place-items-center text-zinc-600 hover:bg-white/[0.07] hover:text-zinc-200",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setPickerOpen((open) => !open)}
            title="Open resource"
            className={cx(
              "mb-[2px] ml-0.5 grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[1px] text-zinc-600 hover:bg-elevated hover:text-zinc-300",
              pickerOpen && "bg-elevated text-acid",
            )}
          >
            <Plus size={11} />
          </button>
        </div>

        {pickerOpen ? (
          <div
            ref={pickerRef}
            className="absolute left-1 top-[26px] z-50 w-[270px] border border-line bg-panel py-1 shadow-[0_14px_30px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-1 px-2.5 py-1">
              <span className="label-caps">Open resource</span>
              <ChevronDown size={9} className="ml-auto text-zinc-600" />
            </div>
            <div className="max-h-[300px] overflow-y-auto scroll-thin">
              {CODE_FILES.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => openResource(file)}
                  className="flex h-[24px] w-full items-center gap-2 px-2.5 text-left text-[10.5px] text-zinc-400 hover:bg-elevated hover:text-zinc-100"
                >
                  {file.language === "json" ? (
                    <FileJson size={10} className="text-[#38BDF8]/70" />
                  ) : file.language === "prompt" ? (
                    <Bot size={10} className="text-acid/70" />
                  ) : (
                    <FileCode2 size={10} className="text-zinc-600" />
                  )}
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="font-mono text-[8px] text-zinc-700">{file.group}/</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden min-w-0 shrink-0 items-center gap-1.5 border-l border-line px-2.5 font-mono text-[9px] text-zinc-600 xl:flex">
        <span className={cx("h-1 w-1 rounded-full", selected?.status === "error" ? "bg-danger" : "bg-acid/60")} />
        <span className="truncate">{breadcrumb}</span>
      </div>
    </div>
  );
}
