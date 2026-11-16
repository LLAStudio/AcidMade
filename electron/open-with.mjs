/**
 * Which `.acm` file, if any, was passed to the app.
 *
 * Kept out of `main.mjs` so the parsing rules are testable without Electron:
 * a packaged launch passes the executable first, `electron .` passes the app
 * directory, and both can be followed by the file the OS opened.
 */
import fs from "node:fs";
import path from "node:path";

export function projectPathFromArgv(argv = [], cwd = process.cwd()) {
  for (const raw of argv) {
    if (typeof raw !== "string" || raw.startsWith("-")) continue;
    if (!raw.toLowerCase().endsWith(".acm")) continue;
    const candidate = path.resolve(cwd, raw);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // A stale association can name a file that no longer exists.
    }
  }
  return null;
}
