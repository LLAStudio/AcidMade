interface DesktopBridge {
  runtimeUrl?: string;
}

function bridge(): DesktopBridge | undefined {
  return (globalThis as { acidmade?: DesktopBridge }).acidmade;
}

/**
 * Absolute API base for the local runtime.
 *
 * On the web the Vite dev server proxies `/api` to the runtime, so a relative
 * URL is correct. In the packaged desktop app the renderer is loaded from
 * `file://`, where relative URLs cannot reach the runtime, so the Electron
 * preload injects the loopback origin instead.
 */
export function apiBase(): string {
  return bridge()?.runtimeUrl ?? "";
}

export function apiUrl(path: string): string {
  return apiBase() + path;
}
