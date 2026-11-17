import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { loadLanguageSelection, saveLanguageSelection } from "../lib/languages";
import { clearLayout } from "../lib/layout";
import { APP_VERSION } from "../lib/version";
import { LanguagePicker } from "./LanguagePicker";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [layoutReset, setLayoutReset] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(loadLanguageSelection() ?? []);
    setLayoutReset(false);
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const save = () => {
    saveLanguageSelection(selected);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-black/65 p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-[420px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
          <span id="settings-title" className="text-[11px] font-semibold text-zinc-200">
            Settings
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
            aria-label="Close settings"
          >
            <X size={12} />
          </button>
        </div>

        <div className="space-y-3 p-3.5">
          <div>
            <span className="label-caps text-zinc-400">Languages</span>
            <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-500">
              The languages you plan to use for agents and code. Stored on this device.
            </p>
          </div>
          <LanguagePicker selected={selected} onToggle={toggle} />
          <p className="font-mono text-[9px] text-zinc-600">
            {selected.length === 0
              ? "keep at least one language selected"
              : `${selected.length} selected`}
          </p>
        </div>

        <div className="border-t border-line p-3.5">
          <span className="label-caps text-zinc-400">Workspace</span>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-[10.5px] leading-relaxed text-zinc-500">
              Panel sizes are remembered on this device.
            </p>
            <button
              type="button"
              onClick={() => {
                clearLayout();
                setLayoutReset(true);
              }}
              className="flex h-[25px] shrink-0 items-center gap-1 border border-line bg-panel px-2 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              <RotateCcw size={10} />
              Reset layout
            </button>
          </div>
          {layoutReset ? (
            <p role="status" className="mt-1 font-mono text-[8.5px] text-acid/70">
              panel sizes reset to defaults
            </p>
          ) : null}
        </div>

        <div className="flex h-10 items-center justify-end gap-2 border-t border-line px-3">
          <span className="mr-auto font-mono text-[8.5px] text-zinc-700">
            AcidMade v{APP_VERSION}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[25px] items-center border border-line bg-panel px-2.5 text-[10.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={selected.length === 0}
            className="flex h-[25px] items-center border border-acid/40 bg-acid/[0.1] px-2.5 text-[10.5px] font-medium text-acid transition-colors hover:border-acid/70 hover:bg-acid/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
