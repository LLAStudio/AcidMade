const BASE_TAB_FILE_IDS = new Set(["main-scene", "dashboard-scene", "data-agent-prompt"]);

export function tabIdForFile(fileId: string): string {
  return BASE_TAB_FILE_IDS.has(fileId) ? fileId : "file-" + fileId;
}

export function isKnownTabId(tabId: string): boolean {
  return BASE_TAB_FILE_IDS.has(tabId) || /^file-[a-z0-9-]+$/.test(tabId);
}
