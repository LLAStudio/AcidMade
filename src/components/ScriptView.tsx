import { useMemo } from "react";
import {
  Bot,
  Check,
  Clipboard,
  Code2,
  FileCode2,
  FileJson,
  Sparkles,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { CODE_FILES, resourceById } from "../data/resources";
import { tokenizeSource } from "../lib/highlight";
import { cx } from "../lib/utils";

function PromptLine({ text, number }: { text: string; number: number }) {
  if (!text.trim()) {
    return (
      <div className="flex min-h-[18px] gap-3">
        <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-[9px] text-zinc-800">
          {number}
        </span>
        <span className="h-[18px]" />
      </div>
    );
  }
  if (text.startsWith("# ")) {
    return (
      <div className="flex gap-3 bg-acid/[0.025]">
        <span className="w-9 shrink-0 select-none pr-2 pt-[1px] text-right font-mono text-[9px] text-acid/30">
          {number}
        </span>
        <span className="py-1 text-[15px] font-semibold tracking-[-0.01em] text-zinc-100">
          {text.replace(/^# /, "")}
        </span>
      </div>
    );
  }
  if (text.startsWith("## ")) {
    return (
      <div className="flex gap-3 pt-1">
        <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-[9px] text-zinc-700">
          {number}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-acid/70">
          {text.replace(/^## /, "")}
        </span>
      </div>
    );
  }
  if (text.startsWith("- ") || /^\d+\. /.test(text)) {
    return (
      <div className="flex gap-3">
        <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-[9px] text-zinc-800">
          {number}
        </span>
        <span className="flex gap-2 text-[12px] leading-[20px] text-zinc-400">
          <span className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-acid/60" />
          <span>{text.replace(/^(-\s|\d+\.\s)/, "")}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-[9px] text-zinc-800">
        {number}
      </span>
      <span className="text-[12px] leading-[20px] text-zinc-400">{text}</span>
    </div>
  );
}

export function ScriptView() {
  const { activeFileId, openFile, setAiOpen, pushLog } = useEngine();
  const activeFile = resourceById(activeFileId) ?? CODE_FILES[0];
  const promptMode = activeFile.language === "prompt";
  const tokenLines = useMemo(() => tokenizeSource(activeFile.content), [activeFile]);
  const rawLines = useMemo(() => activeFile.content.replace(/\n$/, "").split("\n"), [activeFile]);
  const pairedPrompt = activeFile.id === "data-agent" || activeFile.id === "data-agent-prompt";

  const LanguageIcon =
    activeFile.language === "json"
      ? FileJson
      : activeFile.language === "prompt"
        ? Sparkles
        : FileCode2;
  const languageColor =
    activeFile.language === "json"
      ? "text-[#38BDF8]"
      : activeFile.language === "prompt"
        ? "text-acid"
        : "text-[#A3E635]";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      pushLog("Operator", "ok", "copied res://" + activeFile.path + " to clipboard");
    } catch {
      pushLog("Operator", "warn", "clipboard unavailable · copy failed");
    }
  };

  const openAgentPrompt = (path: string) => {
    openFile(path);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-void">
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
        <LanguageIcon size={12} className={languageColor} />
        <div className="flex min-w-0 items-center gap-1 font-mono text-[9.5px] text-zinc-400">
          <span className="text-zinc-600">res://</span>
          <span className="truncate text-zinc-300">{activeFile.path}</span>
        </div>
        <span
          className={cx(
            "shrink-0 border px-1 font-mono text-[7.5px] uppercase tracking-[0.08em]",
            promptMode
              ? "border-acid/25 bg-acid/[0.05] text-acid/75"
              : "border-line bg-void text-zinc-600",
          )}
        >
          {promptMode ? "agent prompt" : activeFile.language}
        </span>
        <span className="hidden shrink-0 items-center gap-1 font-mono text-[8px] text-[#A3E635]/70 sm:flex">
          +{activeFile.additions}
          {activeFile.deletions > 0 ? (
            <span className="text-danger/60">−{activeFile.deletions}</span>
          ) : null}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {pairedPrompt ? (
            <div className="mr-1 flex h-[21px] items-center rounded-[2px] border border-line bg-void p-[1px]">
              <button
                type="button"
                onClick={() => openAgentPrompt("agents/DataAnalystAgent.agent.ts")}
                className={cx(
                  "flex h-[17px] items-center gap-1 px-1.5 text-[9px]",
                  activeFile.id === "data-agent"
                    ? "bg-elevated text-zinc-200"
                    : "text-zinc-600 hover:text-zinc-300",
                )}
              >
                <Code2 size={8} />
                Code
              </button>
              <button
                type="button"
                onClick={() => openAgentPrompt("agents/DataAnalystAgent.prompt")}
                className={cx(
                  "flex h-[17px] items-center gap-1 px-1.5 text-[9px]",
                  promptMode
                    ? "bg-elevated text-acid"
                    : "text-zinc-600 hover:text-zinc-300",
                )}
              >
                <Bot size={8} />
                Prompt
              </button>
            </div>
          ) : null}

          <span className="hidden items-center gap-1 font-mono text-[8px] text-zinc-700 xl:flex">
            <Check size={8} className="text-[#A3E635]/60" />
            {activeFile.generatedBy}
          </span>

          <button
            type="button"
            onClick={copy}
            title="Copy resource"
            className="grid h-[21px] w-[21px] place-items-center border border-transparent text-zinc-600 hover:border-line hover:bg-elevated hover:text-zinc-300"
          >
            <Clipboard size={10} />
          </button>

          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="flex h-[21px] items-center gap-1 border border-acid/30 bg-acid/[0.05] px-1.5 text-[9px] text-acid/80 hover:border-acid/50 hover:bg-acid/[0.1]"
          >
            <Sparkles size={9} />
            Ask AI
          </button>
        </div>
      </div>

      {promptMode ? (
        <div className="flex h-[25px] shrink-0 items-center gap-2 border-b border-line-soft bg-[#0b0d0f] px-2 font-mono text-[8px] text-zinc-600">
          <span className="text-zinc-700">agent prompt</span>
          <span className="text-zinc-800">|</span>
          <span>model claude-sonnet-4-6</span>
          <span className="text-zinc-800">|</span>
          <span>autonomy full-acid</span>
          <span className="text-zinc-800">|</span>
          <span>memory project-wide</span>
          <span className="ml-auto flex items-center gap-1 text-acid/45">
            <span className="h-1 w-1 rounded-full bg-acid/50" />
            attached to DataAnalystAgent
          </span>
        </div>
      ) : null}

      <div className="scroll-thin min-h-0 flex-1 overflow-auto bg-void select-text">
        <div className="min-w-max py-2">
          {promptMode
            ? rawLines.map((line, index) => (
                <PromptLine key={index} text={line} number={index + 1} />
              ))
            : tokenLines.map((tokens, index) => (
                <div
                  key={index}
                  className="group flex min-h-[19px] items-start hover:bg-white/[0.018]"
                >
                  <span className="w-[42px] shrink-0 select-none pr-3 text-right font-mono text-[9px] leading-[19px] text-zinc-800 group-hover:text-zinc-600">
                    {index + 1}
                  </span>
                  <span className="mr-2 h-[19px] w-[2px] shrink-0 bg-transparent group-hover:bg-acid/25" />
                  <code className="whitespace-pre pr-8 font-mono text-[11px] leading-[19px]">
                    {tokens.map((token, tokenIndex) => (
                      <span key={tokenIndex} className={token.style}>
                        {token.text}
                      </span>
                    ))}
                  </code>
                </div>
              ))}
        </div>
      </div>

      <div className="flex h-[19px] shrink-0 items-center gap-3 border-t border-line-soft bg-shell px-2 font-mono text-[7.5px] text-zinc-700">
        <span>res://{activeFile.path}</span>
        <span className="text-zinc-800">|</span>
        <span>UTF-8 · LF</span>
        <span className="text-zinc-800">|</span>
        <span>{promptMode ? "Markdown" : activeFile.language.toUpperCase()}</span>
        <span className="ml-auto">Ln {rawLines.length}, Col 1</span>
        <span className="text-zinc-800">|</span>
        <span>Spaces: 2</span>
        <span className="flex items-center gap-1 text-[#A3E635]/50">
          <span className="h-1 w-1 rounded-full bg-[#A3E635]/50" />
          generated by {activeFile.generatedBy}
        </span>
      </div>
    </div>
  );
}
