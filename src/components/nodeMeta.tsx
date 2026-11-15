import {
  Activity,
  Bot,
  Boxes,
  ChartColumn,
  Database,
  FileCode2,
  LayoutDashboard,
  PanelsTopLeft,
  PanelTop,
  ShieldCheck,
  SquareMousePointer,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind, NodeStatus, SceneIconKey } from "../types";

export interface NodeKindMeta {
  label: string;
  text: string;
  iconColor: string;
  border: string;
  bg: string;
  hex: string;
}

export const NODE_KIND_META: Record<NodeKind, NodeKindMeta> = {
  root: {
    label: "Root",
    text: "text-[#FACC15]",
    iconColor: "text-[#FACC15]",
    border: "border-[#FACC15]/30",
    bg: "bg-[#FACC15]/10",
    hex: "#FACC15",
  },
  ui: {
    label: "UI / View",
    text: "text-[#38BDF8]",
    iconColor: "text-[#38BDF8]",
    border: "border-[#38BDF8]/25",
    bg: "bg-[#38BDF8]/10",
    hex: "#38BDF8",
  },
  component: {
    label: "Component",
    text: "text-[#38BDF8]",
    iconColor: "text-[#38BDF8]",
    border: "border-[#38BDF8]/25",
    bg: "bg-[#38BDF8]/10",
    hex: "#38BDF8",
  },
  api: {
    label: "API",
    text: "text-[#A3E635]",
    iconColor: "text-[#A3E635]",
    border: "border-[#A3E635]/25",
    bg: "bg-[#A3E635]/10",
    hex: "#A3E635",
  },
  data: {
    label: "Data",
    text: "text-[#A3E635]",
    iconColor: "text-[#A3E635]",
    border: "border-[#A3E635]/25",
    bg: "bg-[#A3E635]/10",
    hex: "#A3E635",
  },
  agent: {
    label: "Super-Agent",
    text: "text-acid",
    iconColor: "text-acid",
    border: "border-acid/30",
    bg: "bg-acid/10",
    hex: "#CCFF00",
  },
};

export const SCENE_ICONS: Record<SceneIconKey, LucideIcon> = {
  root: Boxes,
  guard: ShieldCheck,
  layout: PanelsTopLeft,
  navbar: PanelTop,
  view: LayoutDashboard,
  widget: ChartColumn,
  agent: Bot,
  api: Waypoints,
  control: SquareMousePointer,
  data: Database,
};

export const STATUS_META: Record<
  NodeStatus,
  { label: string; text: string; dot: string; border: string }
> = {
  idle: {
    label: "idle",
    text: "text-zinc-600",
    dot: "bg-zinc-600",
    border: "border-line",
  },
  running: {
    label: "running",
    text: "text-acid",
    dot: "bg-acid status-pulse",
    border: "border-acid/40",
  },
  healthy: {
    label: "healthy",
    text: "text-[#A3E635]",
    dot: "bg-[#A3E635]",
    border: "border-[#A3E635]/30",
  },
  error: {
    label: "error",
    text: "text-danger",
    dot: "bg-danger",
    border: "border-danger/40",
  },
};

const AGENT_TONES: Record<string, string> = {
  DataAnalystAgent: "text-acid",
  AuthSuperAgent: "text-acid",
  ScaffolderAgent: "text-acid",
  ReviewerAgent: "text-acid",
  OpsAgent: "text-acid",
  UIComposer: "text-[#38BDF8]",
  SignalWrangler: "text-[#A3E635]",
  EdgeAPI: "text-[#A3E635]",
  SelfHealer: "text-warn",
  Build: "text-[#38BDF8]/80",
  AcidEngine: "text-zinc-500",
  AcidAI: "text-acid",
  Operator: "text-zinc-400",
  ORCHESTRATOR: "text-acid",
  "AUTH-GUARD": "text-acid",
  "UI-COMPOSER": "text-[#38BDF8]",
  "EDGE-API": "text-[#A3E635]",
  "SELF-HEALER": "text-warn",
  BUILD: "text-[#38BDF8]/80",
  ENGINE: "text-zinc-500",
};

export function agentTone(agent: string): string {
  return AGENT_TONES[agent] ?? "text-zinc-400";
}

export function agentInitials(agent: string): string {
  const clean = agent.replace(/[^A-Za-z]/g, "");
  if (!clean) return "AI";
  const upper = clean.match(/[A-Z]/g);
  if (upper && upper.length > 1) return upper.slice(0, 2).join("");
  return clean.slice(0, 2).toUpperCase();
}

export const FILE_ICONS: Record<string, LucideIcon> = {
  ts: FileCode2,
  tsx: FileCode2,
  json: Activity,
  md: Bot,
  prompt: Bot,
  css: FileCode2,
};
