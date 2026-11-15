import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const children = new Map();
let shuttingDown = false;

function launch(label, entry, args) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(
      "[acidmade] " + label + " exited" + (signal ? " via " + signal : " with code " + code),
    );

    if (label === "web") {
      shutdown(code ?? 1);
    } else {
      console.log("[acidmade] web stays up; engine will use the reference stream until runtime returns");
    }
  });

  children.set(label, child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) {
    if (!child.killed) child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

launch("runtime", path.join(root, "server/index.mjs"), []);
launch("web", path.join(root, "node_modules/vite/bin/vite.js"), process.argv.slice(2));
