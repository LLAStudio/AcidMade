import {
  AlertTriangle,
  Boxes,
  GitBranch,
  PanelBottom,
  Radio,
  Server,
  Waypoints,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { countSceneNodes, scenePath } from "../data/scene";
import { cx } from "../lib/utils";

export function StatusBar() {
  const {
    project,
    tree,
    selectedNodeId,
    problems,
    runtime,
    refreshRuntime,
    run,
    agentsPaused,
    dockOpen,
    toggleDock,
  } = useEngine();

  const openProblems = problems.filter((problem) => !problem.healed).length;
  const trail = scenePath(tree, selectedNodeId);
  const path = trail.map((node) => node.name).join(" / ");
  const runLabel = agentsPaused
    ? "paused"
    : run.status === "building"
      ? "building"
      : run.status === "running"
        ? "scene live"
        : run.status === "deploying"
          ? "exporting"
          : run.status === "deployed"
            ? "artifact staged"
            : run.status === "failed"
              ? "runtime failed"
              : run.status === "halted"
                ? "halted"
                : "scene ready";

  return (
    <div className="flex h-[22px] shrink-0 items-center gap-2 border-t border-line bg-shell px-2 font-mono text-[9.5px] text-zinc-600">
      <span className="flex items-center gap-1 text-zinc-500">
        <span className="grid h-[13px] w-[13px] place-items-center bg-acid">
          <Boxes size={8} className="text-[#0a0c04]" />
        </span>
        AcidMade
      </span>
      <span className="text-zinc-800">|</span>
      <span className="flex items-center gap-1">
        <GitBranch size={8} />
        {project.branch}
      </span>
      <span className="hidden text-zinc-800 sm:inline">|</span>
      <span className="hidden truncate sm:inline">{project.slug}</span>
      <span className="hidden text-zinc-800 md:inline">|</span>
      <span className="hidden min-w-0 items-center gap-1 truncate md:flex">
        <Waypoints size={8} className="text-zinc-700" />
        {path}
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span className={cx("flex items-center gap-1", openProblems > 0 ? "text-danger/80" : "")}>
          <AlertTriangle size={8} className={openProblems > 0 ? "text-danger/70" : "text-zinc-700"} />
          {openProblems > 0 ? openProblems + " diagnostics" : "0 diagnostics"}
        </span>
        <span className="text-zinc-800">|</span>
        <span className="hidden items-center gap-1 lg:flex">
          <Radio size={8} className={run.status === "running" ? "text-acid/60" : "text-zinc-700"} />
          {runLabel}
        </span>
        <span className="hidden text-zinc-800 lg:inline">|</span>
        <span className="hidden items-center gap-1 lg:flex">{countSceneNodes(tree)} nodes</span>
        <span className="text-zinc-800">|</span>
        <button
          type="button"
          onClick={refreshRuntime}
          title="Re-probe local agent runtime"
          className="flex items-center gap-1 hover:text-zinc-300"
        >
          <Server size={8} className={runtime.status === "online" ? "text-acid/50" : "text-warn/60"} />
          <span className={runtime.status === "online" ? "text-acid/50" : "text-warn/60"}>
            {runtime.status === "online" ? "local runtime" : "reference runtime"}
          </span>
        </button>
        <span className="text-zinc-800">|</span>
        <span>UTF-8</span>
        <span className="hidden text-zinc-800 xl:inline">|</span>
        <span className="hidden xl:inline">Spaces: 2</span>
        <span className="text-zinc-800">|</span>
        <button
          type="button"
          onClick={toggleDock}
          title={dockOpen ? "Collapse output" : "Expand output"}
          className="flex items-center gap-1 text-zinc-700 hover:text-zinc-300"
        >
          <PanelBottom size={9} />
          <span className="hidden 2xl:inline">0.9.2</span>
        </button>
      </span>
    </div>
  );
}
