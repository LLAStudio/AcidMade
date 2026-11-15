import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SVG_BADGE =
  "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"98\" height=\"20\"><linearGradient id=\"g\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ccff00\"/><stop offset=\"1\" stop-color=\"#9ad500\"/></linearGradient><rect x=\"0\" y=\"0\" width=\"98\" height=\"20\" rx=\"4\" fill=\"url(#g)\"/><path d=\"M0 10.5 A10 10 0 0 1 20 10.5 H98 V9.5 A10 10 0 0 1 78 9.5 H98 V10.5 A10 10 0 0 1 98 10.5 Z\" fill=\"#0a0c04\"/><text x=\"16\" y=\"14.4\" fill=\"#0a0c04\" font-family=\"ui-monospace,Menlo,Consolas,monospace\" font-size=\"11\" font-weight=\"700\">acid/1.0</text></svg>";

const buildStatus = readFileSync(path.join(root, ".acidmade", "build.status.txt"), "utf8").trim();

function replaceFirst(text, token, value) {
  const idx = text.indexOf(token);
  if (idx < 0) return text;
  return text.slice(0, idx) + value + text.slice(idx + token.length);
}

let readme = readFileSync(path.join(root, "README.md"), "utf8");
readme = replaceFirst(readme, "<!--BADGE-->", SVG_BADGE);
readme = replaceFirst(readme, "<!--BUILD-STATUS-->", buildStatus);

writeFileSync(path.join(root, "README.md"), readme, "utf8");
console.log("README regenerated:", path.relative(root, path.join(root, "README.md")));
