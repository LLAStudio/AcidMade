/**
 * Generates public/AcidMade-Documentation.pdf from docs/acidmade-manual.md.
 *
 * Self-contained on purpose: no Chromium, no LaTeX, no system packages, so the
 * same command works on a laptop and on every CI runner.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE = path.join(root, "docs", "acidmade-manual.md");
const TARGET = path.join(root, "public", "AcidMade-Documentation.pdf");

const PAGE = { w: 595.28, h: 841.89 };
const M = { top: 70, bottom: 58, left: 58, right: 58 };
const CONTENT_W = PAGE.w - M.left - M.right;
const BODY = 9.6;
const LEADING = 14.4;

const INK = "#16180f";
const SOFT_INK = "#2f3524";
const MUTED = "#6d7264";
const ACCENT = "#5f7d00";
const ACCENT_SOFT = "#eef3d8";
const RULE = "#d9ddcd";
const CODE_BG = "#f4f5ef";
const DARK = "#0a0c04";

/* ------------------------------------------------------------------ text metrics */

function charWidth(ch) {
  if (ch === " ") return 0.278;
  if ("iljtfrI.,;:!|'`()[]".includes(ch)) return 0.3;
  if ("mwMW".includes(ch)) return 0.83;
  if (ch >= "A" && ch <= "Z") return 0.68;
  if (ch >= "0" && ch <= "9") return 0.556;
  if ("-–—".includes(ch)) return 0.36;
  return 0.52;
}

function textWidth(value, size, mono = false) {
  if (mono) return value.length * 0.6 * size;
  let width = 0;
  for (const ch of value) width += charWidth(ch) * size;
  return width;
}

/* ------------------------------------------------------------------ markdown parsing */

function toAscii(value) {
  return value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[·•▪]/g, "-")
    .replace(/[→⇒]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

function parseInline(value) {
  const runs = [];
  let last = 0;
  for (const match of value.matchAll(INLINE)) {
    if (match.index > last) runs.push({ text: value.slice(last, match.index), kind: "body" });
    const token = match[0];
    if (token.startsWith("**")) runs.push({ text: token.slice(2, -2), kind: "bold" });
    else if (token.startsWith("`")) runs.push({ text: token.slice(1, -1), kind: "ink" });
    else if (token.startsWith("*")) runs.push({ text: token.slice(1, -1), kind: "italic" });
    else runs.push({ text: token.slice(1, token.indexOf("]")), kind: "link" });
    last = match.index + token.length;
  }
  if (last < value.length) runs.push({ text: value.slice(last), kind: "body" });
  return runs.filter((run) => run.text.length > 0);
}

function parseMarkdown(markdown) {
  const lines = toAscii(markdown).split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", lines: body });
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        const cells = lines[index]
          .slice(1, lines[index].lastIndexOf("|"))
          .split("|")
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      if (rows.length > 0) blocks.push({ type: "table", head: rows[0], rows: rows.slice(1) });
      continue;
    }

    if (line.startsWith("> ")) {
      const body = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        body.push(lines[index].slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "quote", text: body.join(" ") });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,4}\s|```|\||> |[-*]\s|\d+\.\s|---+$)/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/* ------------------------------------------------------------------ page canvas */

function color(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4]
    .map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel.toFixed(3))
    .join(" ");
}

function escapePdf(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const FONTS = {
  body: ["/F1", false],
  bold: ["/F2", false],
  italic: ["/F4", false],
  code: ["/F3", true],
  ink: ["/F3", false],
  link: ["/F1", false],
};

const INK_COLORS = { link: ACCENT, ink: SOFT_INK };

function createCanvas() {
  const pages = [];
  let ops = [];
  let y = M.top;

  const pushPage = () => {
    ops = [];
    pages.push(ops);
    y = M.top;
  };
  pushPage();

  return {
    get pages() {
      return pages;
    },
    get y() {
      return y;
    },
    set y(value) {
      y = value;
    },
    newPage: pushPage,
    rect(x, top, width, height, fill) {
      ops.push(
        `q ${color(fill)} rg ${x.toFixed(2)} ${(PAGE.h - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`,
      );
    },
    text(value, x, top, size, kind = "body", fill = INK) {
      const [font] = FONTS[kind] ?? FONTS.body;
      const baseline = PAGE.h - top - size * 0.78;
      ops.push(
        `BT ${color(fill)} rg ${font} ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdf(value)}) Tj ET`,
      );
    },
    rule(x1, top, x2, fill = RULE) {
      ops.push(
        `q ${color(fill)} rg ${x1.toFixed(2)} ${(PAGE.h - top).toFixed(2)} ${(x2 - x1).toFixed(2)} 0.7 re f Q`,
      );
    },
    space(amount) {
      y += amount;
    },
    need(height) {
      if (y + height > PAGE.h - M.bottom) pushPage();
    },
  };
}

/* ------------------------------------------------------------------ inline layout */

function wrapRuns(runs, base, width) {
  const lines = [];
  let current = [];
  let used = 0;

  const breakLine = () => {
    if (current.length > 0) lines.push(current);
    current = [];
    used = 0;
  };

  for (const run of runs) {
    const size = run.kind === "ink" ? base * 0.9 : base;
    const mono = run.kind === "ink" || run.kind === "code";
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      const pieceWidth = textWidth(piece, size, mono);
      if (!piece.trim()) {
        if (current.length > 0) {
          current.push({ ...run, text: " ", size, mono });
          used += pieceWidth;
        }
        continue;
      }
      if (used + pieceWidth > width && current.length > 0) breakLine();
      current.push({ ...run, text: piece, size, mono });
      used += pieceWidth;
    }
  }
  breakLine();
  return lines;
}

function drawRuns(canvas, runs, x, fill) {
  let cursor = x;
  for (const run of runs) {
    const style = run.kind in FONTS ? run.kind : "body";
    const runFill = fill ?? INK_COLORS[run.kind] ?? INK;
    if (run.kind === "ink") {
      canvas.rect(cursor - 1.2, canvas.y + 1.2, textWidth(run.text, run.size, true) + 2.4, run.size + 3, CODE_BG);
    }
    canvas.text(run.text, cursor, canvas.y, run.size, style, runFill);
    cursor += textWidth(run.text, run.size, run.mono);
  }
}

function drawParagraph(canvas, markdown, options = {}) {
  const { size = BODY, leading = LEADING, indent = 0, fill } = options;
  const runs = parseInline(markdown);
  for (const lineRuns of wrapRuns(runs, size, CONTENT_W - indent)) {
    canvas.need(leading);
    drawRuns(canvas, lineRuns, M.left + indent, fill);
    canvas.space(leading);
  }
}

/* ------------------------------------------------------------------ block renderers */

function drawHeading(canvas, block) {
  if (block.level === 1) {
    canvas.need(130);
    canvas.space(12);
    canvas.rect(M.left, canvas.y, 34, 3, ACCENT);
    canvas.space(15);
    canvas.text(block.text, M.left, canvas.y, 19, "bold");
    canvas.space(26);
    return;
  }
  if (block.level === 2) {
    canvas.need(78);
    canvas.space(10);
    canvas.text(block.text, M.left, canvas.y, 13.2, "bold", INK);
    canvas.space(18);
    canvas.rule(M.left, canvas.y, PAGE.w - M.right);
    canvas.space(11);
    return;
  }
  if (block.level === 3) {
    canvas.need(54);
    canvas.space(5);
    canvas.text(block.text, M.left, canvas.y, 10.4, "bold", SOFT_INK);
    canvas.space(15);
    return;
  }
  canvas.need(40);
  canvas.space(2);
  canvas.text(block.text, M.left, canvas.y, 9.4, "bold", MUTED);
  canvas.space(13);
}

function drawCode(canvas, block) {
  const size = 7.9;
  const leading = 11;
  const padding = 8;
  const maxChars = Math.floor((CONTENT_W - padding * 2) / (0.6 * size));

  const lines = [];
  for (const source of block.lines) {
    let rest = source.replace(/\t/g, "  ");
    if (!rest.length) {
      lines.push("");
      continue;
    }
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    lines.push(rest);
  }

  let index = 0;
  while (index < lines.length) {
    const available = PAGE.h - M.bottom - canvas.y - padding * 2 - 6;
    const fit = Math.max(1, Math.floor(available / leading));
    const slice = lines.slice(index, index + fit);
    const blockHeight = slice.length * leading + padding * 2;
    canvas.need(blockHeight);
    canvas.rect(M.left, canvas.y, CONTENT_W, blockHeight, CODE_BG);
    canvas.rect(M.left, canvas.y, 2.4, blockHeight, "#c9d3a8");
    let top = canvas.y + padding;
    for (const codeLine of slice) {
      canvas.text(codeLine, M.left + padding, top, size, "code", SOFT_INK);
      top += leading;
    }
    canvas.y = top + padding;
    canvas.space(11);
    index += slice.length;
    if (index < lines.length) canvas.newPage();
  }
}

function drawList(canvas, block) {
  block.items.forEach((item, position) => {
    canvas.need(18);
    canvas.text(
      block.ordered ? `${position + 1}.` : "-",
      M.left + 2,
      canvas.y,
      BODY,
      block.ordered ? "bold" : "body",
      ACCENT,
    );
    drawParagraph(canvas, item, { indent: 18 });
    canvas.space(2.4);
  });
  canvas.space(4);
}

function drawQuote(canvas, block) {
  const runs = parseInline(block.text).map((run) => (run.kind === "bold" ? run : { ...run, kind: "italic" }));
  const lines = wrapRuns(runs, 9.4, CONTENT_W - 22);
  const height = lines.length * 13.6 + 10;
  canvas.need(height + 10);
  const quoteTop = canvas.y;
  canvas.rect(M.left, quoteTop, 2.4, height, ACCENT);
  let top = quoteTop + 5;
  for (const lineRuns of lines) {
    canvas.y = top;
    drawRuns(canvas, lineRuns, M.left + 14);
    top += 13.6;
  }
  canvas.y = quoteTop + height + 10;
}

function drawTable(canvas, block) {
  const size = 8.1;
  const leading = 11;
  const padding = 5;
  const rows = [block.head, ...block.rows];
  const columns = block.head.length;

  const weights = Array.from({ length: columns }, (_, column) => {
    const longest = Math.max(...rows.map((row) => (row[column] ?? "").length));
    return Math.max(7, Math.min(44, longest));
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => (weight / total) * CONTENT_W);

  rows.forEach((row, rowIndex) => {
    const cells = row.map((cell, column) =>
      wrapRuns(parseInline(cell ?? ""), size, widths[column] - padding * 2),
    );
    const tallest = Math.max(...cells.map((cell) => cell.length), 1);
    const height = tallest * leading + padding * 2;

    if (canvas.y + height > PAGE.h - M.bottom) canvas.newPage();
    const rowTop = canvas.y;
    if (rowIndex === 0) canvas.rect(M.left, rowTop, CONTENT_W, height, ACCENT_SOFT);
    canvas.rule(M.left, rowTop, PAGE.w - M.right);

    let x = M.left;
    cells.forEach((cellLines, column) => {
      let top = rowTop + padding;
      for (const cellRuns of cellLines) {
        canvas.y = top;
        const styled =
          rowIndex === 0 ? cellRuns.map((run) => ({ ...run, kind: "bold" })) : cellRuns;
        drawRuns(canvas, styled, x + padding);
        top += leading;
      }
      x += widths[column];
    });

    canvas.y = rowTop + height;
    canvas.rule(M.left, canvas.y, PAGE.w - M.right);
    canvas.space(1.5);
  });
  canvas.space(9);
}

/* ------------------------------------------------------------------ chrome */

const TOC_ROWS = 40;

function drawCover(canvas, meta) {
  canvas.rect(0, 0, PAGE.w, PAGE.h, DARK);
  canvas.rect(0, 0, PAGE.w, 6, "#ccff00");
  canvas.rect(M.left, 150, 64, 4, "#ccff00");

  canvas.text("ACIDMADE", M.left, 176, 42, "bold", "#f4f7e6");
  canvas.text("Engine Documentation", M.left, 232, 19, "body", "#ccff00");

  [
    "The complete reference: editor, scene format, signals, inspector,",
    "agent runtime, AI layer, persistence and desktop packaging.",
  ].forEach((value, index) => canvas.text(value, M.left, 286 + index * 17, 11, "body", "#b9c1a8"));

  canvas.rule(M.left, 360, PAGE.w - M.right, "#2a3020");

  [
    ["Version", meta.version],
    ["Format", "acid/1.0"],
    ["Sections", String(meta.sections)],
    ["Pages", String(meta.pages)],
    ["Generated", meta.date],
  ].forEach(([label, value], index) => {
    const top = 388 + index * 22;
    canvas.text(label.toUpperCase(), M.left, top, 8, "bold", "#6f7a5c");
    canvas.text(value, M.left + 110, top, 9.6, "body", "#e6ecd8");
  });

  canvas.text("Source: docs/acidmade-manual.md", M.left, 552, 9, "body", "#7c8768");
  canvas.text("Generated by scripts/gen-docs-pdf.mjs", M.left, 570, 9, "body", "#4d5540");

  canvas.rect(0, PAGE.h - 78, PAGE.w, 78, "#0f1208");
  canvas.text("AcidMade - AI-native application engine", M.left, PAGE.h - 58, 9.4, "bold", "#ccff00");
  canvas.text("github.com/LLAStudio/AcidMade", M.left, PAGE.h - 40, 9, "body", "#8d977a");
  canvas.newPage();
}

function drawTocPage(canvas, entries, pageIndex, totalPages) {
  if (pageIndex === 0) {
    canvas.text("Contents", M.left, canvas.y + 4, 21, "bold", INK);
    canvas.space(28);
    canvas.rule(M.left, canvas.y, PAGE.w - M.right);
    canvas.space(16);
  } else {
    canvas.text("Contents (continued)", M.left, canvas.y + 4, 11, "bold", MUTED);
    canvas.space(30);
  }

  for (const entry of entries) {
    const indent = entry.level === 3 ? 16 : 0;
    const size = entry.level === 2 ? 9.8 : 8.9;
    const kind = entry.level === 2 ? "bold" : "body";
    const labelWidth = textWidth(entry.title, size);
    canvas.text(entry.title, M.left + indent, canvas.y, size, kind, entry.level === 2 ? INK : MUTED);
    const pageText = String(entry.page);
    const pageWidth = textWidth(pageText, size);
    const startX = M.left + indent + labelWidth + 6;
    const endX = PAGE.w - M.right - pageWidth - 6;
    if (endX > startX) {
      const dots = ".".repeat(Math.max(0, Math.floor((endX - startX) / (0.5 * size))));
      canvas.text(dots, startX, canvas.y, size, "body", "#c2c8b4");
    }
    canvas.text(pageText, PAGE.w - M.right - pageWidth, canvas.y, size, "body", MUTED);
    canvas.space(15.5);
  }

  canvas.newPage();
  void totalPages;
}

function drawFooters(pages) {
  pages.forEach((ops, index) => {
    if (index === 0) return;
    const left = "AcidMade - Engine Documentation";
    const right = `${index + 1} / ${pages.length}`;
    const rightWidth = textWidth(right, 7.6);
    ops.push(
      `BT ${color("#9aa389")} rg /F1 7.6 Tf 1 0 0 1 ${M.left.toFixed(2)} ${(M.bottom - 24).toFixed(2)} Tm (${escapePdf(left)}) Tj ET`,
    );
    ops.push(
      `BT ${color("#9aa389")} rg /F1 7.6 Tf 1 0 0 1 ${(PAGE.w - M.right - rightWidth).toFixed(2)} ${(M.bottom - 24).toFixed(2)} Tm (${escapePdf(right)}) Tj ET`,
    );
    ops.push(
      `q ${color("#e4e7da")} rg ${M.left.toFixed(2)} ${(M.bottom - 32).toFixed(2)} ${CONTENT_W.toFixed(2)} 0.6 re f Q`,
    );
  });
}

/* ------------------------------------------------------------------ pdf assembly */

function buildPdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("PAGES_PLACEHOLDER");

  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const f3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  const f4 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");

  const pageIds = [];
  for (const ops of pages) {
    const content = ops.join("\n");
    const streamId = add(
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    );
    pageIds.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w.toFixed(2)} ${PAGE.h.toFixed(2)}] ` +
          `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R /F4 ${f4} 0 R >> >> ` +
          `/Contents ${streamId} 0 R >>`,
      ),
    );
  }

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/* ------------------------------------------------------------------ main */

function renderBody(blocks) {
  const canvas = createCanvas();
  const headings = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      if (block.level <= 3) {
        headings.push({ level: block.level, title: block.text, page: canvas.pages.length });
      }
      drawHeading(canvas, block);
      continue;
    }
    if (block.type === "paragraph") drawParagraph(canvas, block.text);
    else if (block.type === "code") drawCode(canvas, block);
    else if (block.type === "list") drawList(canvas, block);
    else if (block.type === "quote") drawQuote(canvas, block);
    else if (block.type === "table") drawTable(canvas, block);
    else if (block.type === "rule") {
      canvas.space(6);
      canvas.rule(M.left, canvas.y, PAGE.w - M.right);
      canvas.space(12);
    }
  }

  return { pages: canvas.pages, headings };
}

function main() {
  const markdown = readFileSync(SOURCE, "utf8");
  const blocks = parseMarkdown(markdown);
  const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  const date = new Date().toISOString().slice(0, 10);

  const body = renderBody(blocks);
  const entries = body.headings;

  const tocPages = Math.max(1, Math.ceil(entries.length / TOC_ROWS));
  const offset = 1 + tocPages;
  for (const entry of entries) entry.page += offset;

  const front = createCanvas();
  drawCover(front, {
    version: "v" + version,
    sections: String(entries.filter((entry) => entry.level === 2).length),
    pages: String(body.pages.length + offset),
    date,
  });
  for (let index = 0; index < tocPages; index += 1) {
    drawTocPage(front, entries.slice(index * TOC_ROWS, (index + 1) * TOC_ROWS), index, tocPages);
  }

  const pages = [...front.pages.slice(0, 1 + tocPages), ...body.pages];
  drawFooters(pages);

  const buffer = buildPdf(pages);
  mkdirSync(path.dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, buffer);

  console.log(
    `[acidmade] wrote ${path.relative(root, TARGET)} - ${pages.length} pages, ` +
      `${(buffer.length / 1024).toFixed(1)} KiB, ${entries.length} contents entries`,
  );
}

main();
