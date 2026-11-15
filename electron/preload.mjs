import { contextBridge } from "electron";

const runtimePort = Number(process.env.ACIDMADE_RUNTIME_PORT ?? 4317);

contextBridge.exposeInMainWorld("acidmade", {
  runtimeUrl: "http://127.0.0.1:" + runtimePort,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
