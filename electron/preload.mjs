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
  projects: {
    list: () => ipcRenderer.invoke("acidmade:projects:list"),
    create: (input) => ipcRenderer.invoke("acidmade:projects:create", input),
    openDialog: () => ipcRenderer.invoke("acidmade:projects:open-dialog"),
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
  },
});
