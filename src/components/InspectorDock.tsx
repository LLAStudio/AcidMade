import {
  Bot,
  Box,
  Braces,
  ChevronRight,
  CircleSlash,
  Cpu,
  Database,
  Gauge,
  KeyRound,
  LayoutPanelTop,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Waypoints,
  Wrench,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { findSceneNode } from "../data/scene";
import {
  AGENT_DEFAULTS,
  AUTONOMY_OPTIONS,
  DIRECTION_OPTIONS,
  LAYOUT_OPTIONS,
  MEMORY_OPTIONS,
  MODEL_OPTIONS,
  defaultProps,
} from "../data/nodeProps";
import { NODE_KIND_META, SCENE_ICONS, STATUS_META } from "./nodeMeta";
import { NodeSignalsPanel } from "./NodeSignalsPanel";
import {
  CheckField,
  NumberField,
  PropertyRow,
  ReadOnlyField,
  Section,
  SelectField,
  SliderField,
  TextAreaField,
  TextField,
} from "./inspector/controls";
import { cx } from "../lib/utils";
import type { RightTab } from "../types";

const TABS: { id: RightTab; label: string; icon: typeof Settings2 }[] = [
  { id: "inspector", label: "Inspector", icon: SlidersHorizontal },
  { id: "node", label: "Node", icon: Waypoints },
];

export function InspectorDock() {
  const {
    tree,
    selectedNodeId,
    nodeStatuses,
    overrides,
    setOverride,
    resetOverrides,
    toggleVisibility,
    rightTab,
    setRightTab,
    setAiOpen,
  } = useEngine();

  const node = findSceneNode(tree, selectedNodeId) ?? tree;
  const meta = NODE_KIND_META[node.kind];
  const status = nodeStatuses[node.id] ?? node.status;
  const statusMeta = STATUS_META[status];
  const NodeIcon = SCENE_ICONS[node.icon] ?? SCENE_ICONS.control;
  const values = { ...defaultProps(node), ...(overrides[node.id] ?? {}) };
  const text = (key: string, fallback = "") =>
    typeof values[key] === "string" ? (values[key] as string) : fallback;
  const number = (key: string, fallback = 0) =>
    typeof values[key] === "number" ? (values[key] as number) : fallback;
  const boolean = (key: string, fallback = false) =>
    typeof values[key] === "boolean" ? (values[key] as boolean) : fallback;
  const set = (key: string, value: string | number | boolean) =>
    setOverride(node.id, key, value);
  const overrideCount = Object.keys(overrides[node.id] ?? {}).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-[28px] shrink-0 items-end border-b border-line bg-shell px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = rightTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRightTab(tab.id)}
              aria-pressed={active}
              className={cx(
                "relative flex h-[23px] items-center gap-1.5 border-x border-t px-2 text-[11px]",
                active
                  ? "border-line bg-panel text-zinc-200"
                  : "border-transparent text-zinc-500 hover:bg-elevated hover:text-zinc-300",
              )}
            >
              {active ? <span className="absolute left-0 right-0 top-0 h-[1.5px] bg-acid" /> : null}
              <Icon size={10} className={active ? "text-acid/80" : "text-zinc-600"} />
              {tab.label}
              {tab.id === "node" && node.signals.length > 0 ? (
                <span className="rounded-[1px] border border-line bg-void px-1 font-mono text-[7px] text-zinc-600">
                  {node.signals.length}
                </span>
              ) : null}
            </button>
          );
        })}
        {rightTab === "inspector" ? (
          <span className="ml-auto mb-1.5 font-mono text-[7.5px] text-zinc-700">res://</span>
        ) : null}
      </div>

      {rightTab === "node" ? (
        <NodeSignalsPanel />
      ) : (
        <>
          <div className="flex h-[44px] shrink-0 items-center gap-2 border-b border-line px-2">
            <span
              className={cx(
                "grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border",
                meta.border,
                meta.bg,
              )}
            >
              <NodeIcon size={14} className={meta.iconColor} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-[11px] font-semibold text-zinc-100">{node.name}</span>
                <span className="shrink-0 font-mono text-[8px] text-zinc-700">:</span>
                <span className={cx("truncate font-mono text-[8.5px]", meta.text)}>
                  {node.className}
                </span>
              </div>
              <div className="mt-[1px] flex items-center gap-1.5">
                <span className={cx("h-[4px] w-[4px] rounded-full", statusMeta.dot)} />
                <span className={cx("font-mono text-[7.5px] uppercase tracking-[0.1em]", statusMeta.text)}>
                  {statusMeta.label}
                </span>
                <span className="font-mono text-[7px] text-zinc-700">· {meta.label}</span>
              </div>
            </div>
            {node.kind === "agent" ? (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                title="Connect an AI provider / set API key"
                className="grid h-6 w-6 shrink-0 place-items-center border border-acid/25 bg-acid/[0.05] text-acid/75 hover:bg-acid/[0.1]"
              >
                <Sparkles size={11} />
              </button>
            ) : null}
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <Section title="Node" icon={Box} defaultOpen>
              <PropertyRow label="Name">
                <ReadOnlyField value={node.name} />
              </PropertyRow>
              <PropertyRow label="Class">
                <ReadOnlyField value={node.className} mono />
              </PropertyRow>
              <PropertyRow label="Visible">
                <CheckField
                  checked={node.visible}
                  onChange={() => toggleVisibility(node.id)}
                />
              </PropertyRow>
              <PropertyRow label="Process">
                <SelectField
                  value={text("process", "Inherit")}
                  onChange={(value) => set("process", value)}
                  options={["Inherit", "Always", "Disabled"]}
                />
              </PropertyRow>
              <PropertyRow label="Script">
                <ReadOnlyField value={node.script ?? "—"} mono />
              </PropertyRow>
            </Section>

            {node.kind === "agent" ? (
              <>
                <Section title="Agent Core" icon={Bot} defaultOpen>
                  <PropertyRow label="Model">
                    <SelectField
                      value={text("model", AGENT_DEFAULTS.model as string)}
                      onChange={(value) => set("model", value)}
                      options={MODEL_OPTIONS}
                    />
                  </PropertyRow>
                  <PropertyRow label="Autonomy">
                    <SelectField
                      value={text("autonomy", "Full-Acid Auto")}
                      onChange={(value) => set("autonomy", value)}
                      options={AUTONOMY_OPTIONS}
                    />
                  </PropertyRow>
                  <PropertyRow label="Max steps">
                    <NumberField
                      value={number("maxSteps", 25)}
                      onChange={(value) => set("maxSteps", value)}
                      min={1}
                      max={100}
                    />
                  </PropertyRow>
                  <PropertyRow label="Memory">
                    <SelectField
                      value={text("memoryScope", "Project-Wide")}
                      onChange={(value) => set("memoryScope", value)}
                      options={MEMORY_OPTIONS}
                    />
                  </PropertyRow>
                  <PropertyRow label="Temperature">
                    <SliderField
                      value={number("temperature", 0.4)}
                      onChange={(value) => set("temperature", value)}
                    />
                  </PropertyRow>
                  <PropertyRow label="Provider">
                    <button
                      type="button"
                      onClick={() => setAiOpen(true)}
                      className="flex h-[20px] w-full items-center gap-1.5 border border-acid/25 bg-acid/[0.04] px-1.5 text-left font-mono text-[9.5px] text-acid/75 hover:bg-acid/[0.09]"
                    >
                      <KeyRound size={9} />
                      <span className="truncate whitespace-nowrap">Connect provider</span>
                      <ChevronRight size={9} className="ml-auto text-acid/40" />
                    </button>
                  </PropertyRow>
                  <PropertyRow label="Instructions" stack>
                    <TextAreaField
                      value={text(
                        "systemPrompt",
                        "Inspect the scene graph, repair diagnostics and report every tool call.",
                      )}
                      onChange={(value) => set("systemPrompt", value)}
                      rows={4}
                    />
                  </PropertyRow>
                </Section>

                <Section title="Capabilities" icon={ShieldCheck} defaultOpen>
                  <PropertyRow label="Read / write files">
                    <CheckField
                      checked={boolean("canReadFiles", true)}
                      onChange={(value) => set("canReadFiles", value)}
                    />
                  </PropertyRow>
                  <PropertyRow label="Execute terminal">
                    <CheckField
                      checked={boolean("canExecTerminal", true)}
                      onChange={(value) => set("canExecTerminal", value)}
                    />
                  </PropertyRow>
                  <PropertyRow label="Self-heal build">
                    <CheckField
                      checked={boolean("canSelfHeal", true)}
                      onChange={(value) => set("canSelfHeal", value)}
                    />
                  </PropertyRow>
                  <PropertyRow label="Deploy prod" hint="gated">
                    <CheckField
                      checked={boolean("canDeployProd", false)}
                      onChange={(value) => set("canDeployProd", value)}
                    />
                  </PropertyRow>
                  <div className="mx-2 my-1.5 border border-line/70 bg-void/50 px-1.5 py-1 font-mono text-[7.5px] leading-relaxed text-zinc-700">
                    <span className="text-[#A3E635]/50">tools</span> fs · tsc · esbuild · signals ·
                    runtime · {boolean("canDeployProd", false) ? "deploy" : "deploy (blocked)"}
                  </div>
                </Section>
              </>
            ) : (
              <>
                <Section title="Transform" icon={LayoutPanelTop} defaultOpen>
                  <div className="grid grid-cols-2 gap-x-1 gap-y-[1px] px-1 py-1">
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-1 border border-line/60 bg-void/40 px-1 py-[1px]"
                      >
                        <span className="w-3 font-mono text-[8px] uppercase text-zinc-700">
                          {key === "width" ? "w" : key === "height" ? "h" : key}
                        </span>
                        <NumberField
                          value={number(key, key === "width" ? 720 : key === "height" ? 320 : 0)}
                          onChange={(value) => set(key, value)}
                        />
                      </label>
                    ))}
                  </div>
                  <PropertyRow label="Layout mode">
                    <SelectField
                      value={text("layoutMode", "Flex")}
                      onChange={(value) => set("layoutMode", value)}
                      options={LAYOUT_OPTIONS}
                    />
                  </PropertyRow>
                  <PropertyRow label="Direction">
                    <SelectField
                      value={text("flexDirection", "Column")}
                      onChange={(value) => set("flexDirection", value)}
                      options={DIRECTION_OPTIONS}
                    />
                  </PropertyRow>
                  <PropertyRow label="Gap">
                    <NumberField
                      value={number("gap", 12)}
                      onChange={(value) => set("gap", value)}
                      min={0}
                    />
                  </PropertyRow>
                  <PropertyRow label="Padding">
                    <NumberField
                      value={number("padding", 16)}
                      onChange={(value) => set("padding", value)}
                      min={0}
                    />
                  </PropertyRow>
                  <PropertyRow label="Grow">
                    <NumberField
                      value={number("grow", 1)}
                      onChange={(value) => set("grow", value)}
                      min={0}
                      max={12}
                    />
                  </PropertyRow>
                  <PropertyRow label="Tailwind" stack>
                    <TextAreaField
                      value={text("tailwind", "")}
                      onChange={(value) => set("tailwind", value)}
                      rows={2}
                      mono
                    />
                  </PropertyRow>
                </Section>
              </>
            )}

            {node.kind === "api" ? (
              <Section title="Endpoint" icon={Braces} defaultOpen>
                <PropertyRow label="Method">
                  <SelectField
                    value={text("method", "GET")}
                    onChange={(value) => set("method", value)}
                    options={["GET", "POST", "PATCH", "DELETE", "STREAM"]}
                  />
                </PropertyRow>
                <PropertyRow label="Timeout">
                  <NumberField
                    value={number("timeout", 2400)}
                    onChange={(value) => set("timeout", value)}
                    min={100}
                    step={100}
                  />
                </PropertyRow>
                <PropertyRow label="Retries">
                  <NumberField
                    value={number("retries", 2)}
                    onChange={(value) => set("retries", value)}
                    min={0}
                    max={10}
                  />
                </PropertyRow>
                <PropertyRow label="Cache">
                  <SelectField
                    value={text("cache", "Edge")}
                    onChange={(value) => set("cache", value)}
                    options={["Edge", "Bypass", "Stale", "ISR"]}
                  />
                </PropertyRow>
                <PropertyRow label="Rate limit">
                  <ReadOnlyField value={text("rateLimit", "120 req/min")} mono />
                </PropertyRow>
              </Section>
            ) : null}

            {node.kind === "data" ? (
              <Section title="Store" icon={Database} defaultOpen>
                <PropertyRow label="Engine">
                  <SelectField
                    value={text("engine", "Postgres")}
                    onChange={(value) => set("engine", value)}
                    options={["Postgres", "SQLite", "D1", "Redis"]}
                  />
                </PropertyRow>
                <PropertyRow label="Region">
                  <SelectField
                    value={text("region", "iad1")}
                    onChange={(value) => set("region", value)}
                    options={["iad1", "fra1", "sfo1", "sin1"]}
                  />
                </PropertyRow>
                <PropertyRow label="Schema">
                  <TextField
                    value={text("schema", "public")}
                    onChange={(value) => set("schema", value)}
                    mono
                  />
                </PropertyRow>
                <PropertyRow label="Pool">
                  <NumberField
                    value={number("pool", 12)}
                    onChange={(value) => set("pool", value)}
                    min={1}
                    max={100}
                  />
                </PropertyRow>
              </Section>
            ) : null}

            <Section title="Metadata" icon={Cpu} defaultOpen={false}>
              <PropertyRow label="Node ID">
                <ReadOnlyField value={node.id} mono />
              </PropertyRow>
              <PropertyRow label="Kind">
                <ReadOnlyField value={meta.label} mono />
              </PropertyRow>
              <PropertyRow label="Description" stack>
                <p className="py-1 text-[9px] leading-relaxed text-zinc-600">{node.summary}</p>
              </PropertyRow>
              <PropertyRow label="Signals">
                <button
                  type="button"
                  onClick={() => setRightTab("node")}
                  className="flex h-[19px] items-center gap-1 border border-line px-1.5 font-mono text-[8px] text-zinc-500 hover:text-acid/80"
                >
                  <Radio size={8} />
                  {node.signals.length} emitted
                  <ChevronRight size={8} />
                </button>
              </PropertyRow>
            </Section>
          </div>

          <div className="flex h-[21px] shrink-0 items-center gap-1 border-t border-line bg-shell px-2 font-mono text-[7px] text-zinc-700">
            <Wrench size={8} />
            <span>{node.id}</span>
            <span className="ml-auto">
              {overrideCount > 0 ? overrideCount + " overrides" : "no overrides"}
            </span>
            <button
              type="button"
              onClick={() => resetOverrides(node.id)}
              disabled={overrideCount === 0}
              className="flex h-[15px] items-center gap-1 border border-transparent px-1 text-zinc-600 hover:border-line hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
              title="Reset inspector overrides"
            >
              <RotateCcw size={8} />
              reset
            </button>
          </div>
        </>
      )}

      <div className="flex h-[19px] shrink-0 items-center gap-1.5 border-t border-line-soft px-2 font-mono text-[7px] text-zinc-700">
        <Gauge size={8} className="text-acid/40" />
        <span>live inspector</span>
        <span className="text-zinc-800">|</span>
        <span>auto-apply</span>
        <span className="ml-auto flex items-center gap-1">
          {node.kind === "agent" ? <ShieldCheck size={8} className="text-acid/40" /> : <CircleSlash size={8} />}
          {node.className}
        </span>
      </div>
    </div>
  );
}
