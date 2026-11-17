import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { loadLanguageSelection, saveLanguageSelection } from "../lib/languages";
import { LanguagePicker } from "./LanguagePicker";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelected(loadLanguageSelection() ?? []);
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
        className="w-[420px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
          <span className="text-[11px] font-semibold text-zinc-200">Settings</span>
          <button
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

        <div className="flex h-10 items-center justify-end gap-2 border-t border-line px-3">
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
