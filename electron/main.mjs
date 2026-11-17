import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStore } from "./projects.mjs";
import { projectPathFromArgv } from "./open-with.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const devUrl = process.env.ACIDMADE_DEV_URL ?? "";
const runtimePort = Number(process.env.ACIDMADE_RUNTIME_PORT ?? 4317);
const isDev = Boolean(devUrl);

let mainWindow = null;
let runtimeProcess = null;
// A .acm opened before the renderer is listening waits here, then moves to the
// window as soon as the renderer says it is ready.
let pendingProjectPath = null;
let rendererReady = false;

let projectStore = null;

// Created lazily: app.getPath() is only reliable once Electron is ready.
function store() {
  if (!projectStore) {
    const root = process.env.ACIDMADE_PROJECTS_DIR
      ? path.resolve(process.env.ACIDMADE_PROJECTS_DIR)
      : path.join(app.getPath("documents"), "AcidMade");
    projectStore = createProjectStore({ rootDir: root });
  }
  return projectStore;
}

function registerProjectIpc() {
  ipcMain.handle("acidmade:projects:list", async () => {
    await store().seedIfEmpty();
    return { root: store().root, projects: await store().list() };
  });

  ipcMain.handle("acidmade:projects:create", (_event, input) =>
    store().create({ name: input?.name, template: input?.template }),
  );

  ipcMain.handle("acidmade:projects:open-dialog", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open AcidMade project",
      buttonLabel: "Open project",
      properties: ["openFile"],
      filters: [{ name: "AcidMade project", extensions: ["acm"] }],
      defaultPath: store().root,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return store().open(result.filePaths[0]);
  });

  ipcMain.handle("acidmade:projects:open-path", (_event, projectPath) =>
    store().open(projectPath),
  );

  // The renderer pulls a project opened during startup, then announces itself
  // so later double-clicks can be pushed straight to the window.
  ipcMain.handle("acidmade:projects:take-pending", () => {
    const next = pendingProjectPath;
    pendingProjectPath = null;
    return next;
  });

  ipcMain.handle("acidmade:projects:renderer-ready", () => {
    rendererReady = true;
    if (pendingProjectPath && mainWindow) {
      mainWindow.webContents.send("acidmade:projects:open-file", pendingProjectPath);
      pendingProjectPath = null;
    }
    return true;
  });

  ipcMain.handle("acidmade:projects:reveal", (_event, projectPath) => {
    if (typeof projectPath === "string" && projectPath.length > 0) {
      shell.showItemInFolder(projectPath);
    }
  });

  ipcMain.handle("acidmade:projects:tree", (_event, projectPath) => store().tree(projectPath));

  ipcMain.handle("acidmade:projects:read-file", (_event, payload) =>
    store().readFile(payload?.projectPath, payload?.relative),
  );

  ipcMain.handle("acidmade:projects:write-file", (_event, payload) =>
    store().writeFile(payload?.projectPath, payload?.relative, payload?.content),
  );

  ipcMain.handle("acidmade:projects:create-entry", (_event, payload) =>
    store().createEntry(payload?.projectPath, payload?.relative, { kind: payload?.kind }),
  );

  ipcMain.handle("acidmade:projects:rename-entry", (_event, payload) =>
    store().renameEntry(payload?.projectPath, payload?.from, payload?.to),
  );

  ipcMain.handle("acidmade:projects:duplicate-entry", (_event, payload) =>
    store().duplicateEntry(payload?.projectPath, payload?.relative),
  );

  ipcMain.handle("acidmade:projects:delete-entry", (_event, payload) =>
    store().deleteEntry(payload?.projectPath, payload?.relative),
  );

  ipcMain.handle("acidmade:projects:rename", (_event, payload) =>
    store().rename(payload?.projectPath, payload?.name),
  );

  ipcMain.handle("acidmade:projects:duplicate", (_event, payload) =>
    store().duplicate(payload?.projectPath),
  );

  ipcMain.handle("acidmade:projects:delete", (_event, payload) =>
    store().remove(payload?.projectPath),
  );
}

function startRuntime() {
  const entry = path.join(appRoot, "server", "index.mjs");
  runtimeProcess = spawn(process.execPath, [entry], {
    // The packaged runtime writes res:// resources, so keep it out of the
    // read-only application directory.
    cwd: app.getPath("userData"),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ACIDMADE_RUNTIME_PORT: String(runtimePort),
      ACIDMADE_RUNTIME_HOST: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  runtimeProcess.stdout?.on("data", (chunk) => {
    process.stdout.write("[runtime] " + chunk.toString());
  });
  runtimeProcess.stderr?.on("data", (chunk) => {
    process.stderr.write("[runtime] " + chunk.toString());
  });
  runtimeProcess.on("exit", (code, signal) => {
    runtimeProcess = null;
    if (code !== 0 && signal !== "SIGTERM") {
      console.error("[acidmade] runtime exited with code " + code);
    }
  });
}

function buildMenu(window) {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => window.webContents.reload(),
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "AcidMade on GitHub",
          click: () => shell.openExternal("https://github.com/LLAStudio/AcidMade"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Called for a double-clicked .acm, a file passed on the command line, and the
// macOS open-file event. Before the renderer is ready the path is queued.
function announceProject(filePath) {
  if (!filePath) return;
  focusWindow();
  if (mainWindow && rendererReady) {
    mainWindow.webContents.send("acidmade:projects:open-file", filePath);
    return;
  }
  pendingProjectPath = filePath;
}

function registerUpdateIpc() {
  ipcMain.handle("acidmade:updates:latest", async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(
        "https://api.github.com/repos/LLAStudio/AcidMade/releases/latest",
        {
          signal: controller.signal,
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": "AcidMade-update-check",
          },
        },
      );
      if (!response.ok) return null;
      const payload = await response.json();
      if (typeof payload?.tag_name !== "string" || typeof payload?.html_url !== "string") {
        return null;
      }
      return { tag: payload.tag_name, url: payload.html_url };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#050505",
    show: false,
    autoHideMenuBar: process.platform !== "darwin",
    title: "AcidMade",
    webPreferences: {
      preload: path.join(here, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
    rendererReady = false;
  });

  // Keep the renderer inside the app; open external links in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  buildMenu(mainWindow);

  if (isDev) {
    void mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(appRoot, "dist", "index.html"));
  }
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, workingDirectory) => {
    const opened = projectPathFromArgv(argv, workingDirectory || process.cwd());
    if (opened) announceProject(opened);
    else focusWindow();
  });

  // macOS delivers Finder double-clicks here, sometimes before `whenReady`.
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    announceProject(projectPathFromArgv([filePath]));
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") app.setAppUserModelId("com.acidmade.app");
    const initialProject = projectPathFromArgv(process.argv.slice(1), process.cwd());
    if (initialProject) pendingProjectPath = initialProject;
    registerProjectIpc();
    registerUpdateIpc();
    startRuntime();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (runtimeProcess && !runtimeProcess.killed) {
    runtimeProcess.kill("SIGTERM");
    runtimeProcess = null;
  }
});
