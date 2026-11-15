import { useState, useMemo } from "react";


interface ConsoleAppProps {
  docs: string[];
}

function renderInlineMarkdown(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  const flushCode = () => {
    if (!codeLines.length) return;
    const escaped = codeLines.map((l) => l.replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("\n");
    out.push(`<pre><code class="hljs language-${codeLang}">${escaped}</code></pre>`);
    codeLines = [];
    inCode = false;
    codeLang = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimEnd();

    if (trimmed.startsWith("```")) {
      flushCode();
      inCode = true;
      codeLang = trimmed.slice(3).trim();
      continue;
    }

    if (inCode) {
      codeLines.push(raw);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      out.push(`<h1>${escapeInline(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      out.push(`<h2>${escapeInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      out.push(`<h3>${escapeInline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("#### ")) {
      out.push(`<h4>${escapeInline(trimmed.slice(5))}</h4>`);
    } else if (trimmed.startsWith("|") && trimmed.includes("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
      out.push(`<table><tbody>${maybeTable(lines, i)}</tbody></table>`);
    } else if (/^\s*[-*+]\s/.test(trimmed) && /^[-*+]\s/.test(lines[i - 1] ?? "")) {
      out.push(`<ul><li>${inlineList(trimmed)}</li></ul>`);
    } else if (/^\s*[-*+]\s/.test(trimmed)) {
      out.push(`<ul><li>${inlineList(trimmed)}</li></ul>`);
    } else if (/^\d+\.\s/.test(trimmed) && /^\d+\.\s/.test(lines[i - 1] ?? "")) {
      out.push(`<ol><li>${inlineList(trimmed)}</li></ol>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      out.push(`<ol><li>${inlineList(trimmed)}</li></ol>`);
    } else if (trimmed === "") {
      out.push(`<p className="muted"> </p>`);
    } else {
      out.push(`<p>${inlineParagraph(trimmed)}</p>`);
    }
  }
  flushCode();
  return out.join("\n");
}

function maybeTable(lines: string[], start: number): string {
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length && lines[i].trim().startsWith("|")) {
    const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
    rows.push(cells);
    i++;
  }
  if (rows.length < 2) return "";
  const header = rows[0];
  const body = rows.slice(2);
  return (
    `<tr>${header.map((c) => `<th>${escapeInline(c)}</th>`).join("")}</tr>` +
    body
      .map(
        (row) =>
          `<tr>${row.map((c) => `<td>${escapeInline(c)}</td>`).join("")}</tr>`,
      )
      .join("")
  );
}

function inlineList(line: string): string {
  const text = line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
  return inlineParagraph(text);
}

function inlineParagraph(line: string): string {
  return linkifyCode(escapeInline(line));
}

function linkifyCode(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeInline(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function ConsoleApp({ docs }: ConsoleAppProps) {
  const [doc, setDoc] = useState(docs.at(0) ?? "acidmade-engine.md");
  const content = useMemo(() => {
    try {
      const raw = document.getElementById("doc-" + doc)?.textContent ?? "";
      if (!raw) return "Documentation file not found on this host.";
      return renderInlineMarkdown(raw);
    } catch {
      return "Documentation file not found on this host.";
    }
  }, [doc]);

  return (
    <div className="console-docs">
      <aside className="docs-nav">
        {docs.map((f) => (
          <button
            key={f}
            className={doc === f ? "active" : ""}
            onClick={() => setDoc(f)}
          >
            {f}
          </button>
        ))}
      </aside>
      <article className="docs-content" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
