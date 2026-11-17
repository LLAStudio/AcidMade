import { useEffect, useState } from "react";
import { EngineBar } from "./components/EngineBar";
import { SceneDock } from "./components/SceneDock";
import { FileSystemDock } from "./components/FileSystemDock";
import { SceneTabs } from "./components/SceneTabs";
import { ViewportView } from "./components/ViewportView";
import { ScriptView } from "./components/ScriptView";
import { SignalGraphView } from "./components/SignalGraphView";
import { AgentHubView } from "./components/AgentHubView";
import { InspectorDock } from "./components/InspectorDock";
import { BottomDock } from "./components/BottomDock";
import { StatusBar } from "./components/StatusBar";
import { AddNodeModal } from "./components/AddNodeModal";
import { AiPanel } from "./components/AiPanel";
import { CommandPalette } from "./components/CommandPalette";
import { ProjectManager } from "./components/ProjectManager";
import { ResizeHandle } from "./components/ResizeHandle";
import { FirstRunLanguages } from "./components/LanguageOnboarding";
import { SettingsModal } from "./components/SettingsModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EngineProvider, useEngine } from "./state/EngineContext";
import { DEFAULT_LAYOUT, LAYOUT_RESET_EVENT, loadLayout, saveLayout } from "./lib/layout";
import { clamp } from "./lib/utils";

function EngineShell() {
  const { mode, dockOpen, launcherOpen, settingsOpen, setSettings, project } = useEngine();
  const [initialLayout] = useState(loadLayout);
  const [leftWidth, setLeftWidth] = useState(initialLayout.leftWidth);
  const [rightWidth, setRightWidth] = useState(initialLayout.rightWidth);
  const [dockHeight, setDockHeight] = useState(initialLayout.dockHeight);
  const [sceneHeight, setSceneHeight] = useState(initialLayout.sceneHeight);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveLayout({ leftWidth, rightWidth, dockHeight, sceneHeight });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [dockHeight, leftWidth, rightWidth, sceneHeight]);

  useEffect(() => {
    const reset = () => {
      setLeftWidth(DEFAULT_LAYOUT.leftWidth);
      setRightWidth(DEFAULT_LAYOUT.rightWidth);
      setDockHeight(DEFAULT_LAYOUT.dockHeight);
      setSceneHeight(DEFAULT_LAYOUT.sceneHeight);
    };
    window.addEventListener(LAYOUT_RESET_EVENT, reset);
    return () => window.removeEventListener(LAYOUT_RESET_EVENT, reset);
  }, []);

  useEffect(() => {
    document.title = launcherOpen
      ? "AcidMade — AI-Native Application Engine"
      : project.name + " — AcidMade";
  }, [launcherOpen, project.name]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setSettings(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSettings]);

  if (launcherOpen) {
    return (
      <>
        <ProjectManager />
        <SettingsModal open={settingsOpen} onClose={() => setSettings(false)} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-shell text-zinc-300">
      <EngineBar />

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ width: leftWidth }}
          className="hidden shrink-0 flex-col overflow-hidden bg-panel md:flex"
        >
          <div
            style={{ height: sceneHeight }}
            className="min-h-[150px] shrink-0 overflow-hidden"
          >
            <SceneDock />
          </div>
          <ResizeHandle
            orientation="horizontal"
            onResize={(delta) =>
              setSceneHeight((height) => clamp(height + delta, 150, 580))
            }
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <FileSystemDock />
          </div>
        </aside>
        <ResizeHandle
          orientation="vertical"
          className="hidden md:block"
          onResize={(delta) => setLeftWidth((width) => clamp(width + delta, 220, 360))}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <SceneTabs />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div key={mode} className="h-full animate-view-in">
              {mode === "viewport" ? <ViewportView /> : null}
              {mode === "script" ? <ScriptView /> : null}
              {mode === "signals" ? <SignalGraphView /> : null}
              {mode === "agents" ? <AgentHubView /> : null}
            </div>
          </div>

          {dockOpen ? (
            <ResizeHandle
              orientation="horizontal"
              className="hidden sm:block"
              onResize={(delta) =>
                setDockHeight((height) => clamp(height - delta, 132, 400))
              }
            />
          ) : null}

          <div
            style={{ height: dockOpen ? dockHeight : 27 }}
            className="shrink-0 overflow-hidden border-t border-line bg-panel"
          >
            <BottomDock />
          </div>
        </main>

        <ResizeHandle
          orientation="vertical"
          className="hidden lg:block"
          onResize={(delta) => setRightWidth((width) => clamp(width - delta, 268, 420))}
        />
        <aside
          style={{ width: rightWidth }}
          className="hidden shrink-0 flex-col overflow-hidden bg-panel lg:flex"
        >
          <InspectorDock />
        </aside>
      </div>

      <StatusBar />
      <AddNodeModal />
      <AiPanel />
      <CommandPalette />
      <SettingsModal open={settingsOpen} onClose={() => setSettings(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <EngineProvider>
        <EngineShell />
        <FirstRunLanguages />
      </EngineProvider>
    </ErrorBoundary>
  );
}
