import { contextBridge, ipcRenderer } from "electron";

const runtimePort = Number(process.env.ACIDMADE_RUNTIME_PORT ?? 4317);

contextBridge.exposeInMainWorld("acidmade", {
  runtimeUrl: "http://127.0.0.1:" + runtimePort,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  updates: {
    latest: () => ipcRenderer.invoke("acidmade:updates:latest"),
  },
  projects: {
    list: () => ipcRenderer.invoke("acidmade:projects:list"),
    create: (input) => ipcRenderer.invoke("acidmade:projects:create", input),
    openDialog: () => ipcRenderer.invoke("acidmade:projects:open-dialog"),
    openPath: (projectPath) => ipcRenderer.invoke("acidmade:projects:open-path", projectPath),
    takePending: () => ipcRenderer.invoke("acidmade:projects:take-pending"),
    markReady: () => ipcRenderer.invoke("acidmade:projects:renderer-ready"),
    onOpenFile: (callback) => {
      const listener = (_event, projectPath) => callback(projectPath);
      ipcRenderer.on("acidmade:projects:open-file", listener);
      return () => ipcRenderer.removeListener("acidmade:projects:open-file", listener);
    },
    reveal: (projectPath) => ipcRenderer.invoke("acidmade:projects:reveal", projectPath),
    tree: (projectPath) => ipcRenderer.invoke("acidmade:projects:tree", projectPath),
    readFile: (projectPath, relative) =>
      ipcRenderer.invoke("acidmade:projects:read-file", { projectPath, relative }),
    writeFile: (projectPath, relative, content) =>
      ipcRenderer.invoke("acidmade:projects:write-file", { projectPath, relative, content }),
    createEntry: (projectPath, relative, kind) =>
      ipcRenderer.invoke("acidmade:projects:create-entry", { projectPath, relative, kind }),
    renameEntry: (projectPath, from, to) =>
      ipcRenderer.invoke("acidmade:projects:rename-entry", { projectPath, from, to }),
    duplicateEntry: (projectPath, relative) =>
      ipcRenderer.invoke("acidmade:projects:duplicate-entry", { projectPath, relative }),
    deleteEntry: (projectPath, relative) =>
      ipcRenderer.invoke("acidmade:projects:delete-entry", { projectPath, relative }),
    renameProject: (projectPath, name) =>
      ipcRenderer.invoke("acidmade:projects:rename", { projectPath, name }),
    duplicateProject: (projectPath) =>
      ipcRenderer.invoke("acidmade:projects:duplicate", { projectPath }),
    deleteProject: (projectPath) =>
      ipcRenderer.invoke("acidmade:projects:delete", { projectPath }),
  },
});
