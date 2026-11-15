// Kept intentionally light: the on-disk README is the single source of truth.
// This checks that nothing the documentation promises is obviously missing.
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(path.join(root, "README.md"), "utf8");

const checks = [
  ["Architecture", "Architecture & scene tree"],
  ["Signal graph", "Signal graph"],
  ["Agent runtime", "Agent runtime"],
  ["Provider-agnostic AI", "Provider-agnostic AI"],
  ["Build pipeline", "Build pipeline"],
  ["Local project", "local project"],
  ["Reset Project to Defaults", "Reset Project to Defaults"],
];

const missing = checks
  .map(([key]) => [key, !readme.includes(key)])
  .filter(([, ok]) => ok)
  .map(([name]) => name);

if (missing.length) {
  console.error("README checks failed; missing sections:", missing.join(", "));
  process.exit(1);
}

if (!existsSync(path.join(root, "index.html"))) {
  console.error("index.html missing; README build preview cannot render.");
  process.exit(1);
}

console.log("README checks passed.");
