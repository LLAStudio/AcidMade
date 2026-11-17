export interface LayoutSnapshot {
  leftWidth: number;
  rightWidth: number;
  dockHeight: number;
  sceneHeight: number;
}

const STORAGE_KEY = "acidmade.layout.v1";

export const LAYOUT_RESET_EVENT = "acidmade:layout-reset";

export const DEFAULT_LAYOUT: LayoutSnapshot = {
  leftWidth: 258,
  rightWidth: 306,
  dockHeight: 172,
  sceneHeight: 430,
};

const LIMITS: Record<keyof LayoutSnapshot, [number, number]> = {
  leftWidth: [220, 360],
  rightWidth: [268, 420],
  dockHeight: [132, 400],
  sceneHeight: [150, 580],
};

function dimension(key: keyof LayoutSnapshot, value: unknown): number {
  const [min, max] = LIMITS[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LAYOUT[key];
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** Panel sizes are a per-device preference; a broken snapshot falls back to defaults. */
export function loadLayout(): LayoutSnapshot {
  if (typeof window === "undefined") return { ...DEFAULT_LAYOUT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<Record<keyof LayoutSnapshot, unknown>>;
    return {
      leftWidth: dimension("leftWidth", parsed.leftWidth),
      rightWidth: dimension("rightWidth", parsed.rightWidth),
      dockHeight: dimension("dockHeight", parsed.dockHeight),
      sceneHeight: dimension("sceneHeight", parsed.sceneHeight),
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveLayout(snapshot: LayoutSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leftWidth: dimension("leftWidth", snapshot.leftWidth),
        rightWidth: dimension("rightWidth", snapshot.rightWidth),
        dockHeight: dimension("dockHeight", snapshot.dockHeight),
        sceneHeight: dimension("sceneHeight", snapshot.sceneHeight),
      }),
    );
  } catch {
    /* storage full or blocked · panel sizes are not critical */
  }
}

export function clearLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore blocked storage */
  }
  window.dispatchEvent(new Event(LAYOUT_RESET_EVENT));
}
