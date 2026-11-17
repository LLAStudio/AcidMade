import { useState } from "react";
import { Languages } from "lucide-react";
import { loadLanguageSelection, saveLanguageSelection } from "../lib/languages";
import { LanguagePicker } from "./LanguagePicker";

function toggle(selection: string[], id: string): string[] {
  return selection.includes(id)
    ? selection.filter((entry) => entry !== id)
    : [...selection, id];
}

export function LanguageOnboarding({ onDone }: { onDone: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-onboarding-title"
        className="w-[440px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-[2px] bg-acid">
            <Languages size={14} className="text-[#0a0c04]" />
          </span>
          <div>
            <div
              id="language-onboarding-title"
              className="text-[12px] font-semibold text-zinc-100"
            >
              Choose your languages
            </div>
            <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-zinc-600">
              first launch · workspace setup
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Pick the languages you plan to use for agents and code. AcidMade keeps this
            selection on this device, and you can change it later in Settings.
          </p>
          <LanguagePicker
            selected={selected}
            autoFocus
            onToggle={(id) => setSelected((current) => toggle(current, id))}
          />
          <p className="font-mono text-[9px] text-zinc-600">
            {selected.length === 0
              ? "select at least one language"
              : `${selected.length} selected`}
          </p>
        </div>

        <div className="flex h-11 items-center justify-end border-t border-line px-3">
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => onDone(saveLanguageSelection(selected))}
            className="flex h-[26px] items-center gap-1.5 border border-acid/40 bg-acid/[0.1] px-3 text-[10.5px] font-medium text-acid transition-colors hover:border-acid/70 hover:bg-acid/[0.16] disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-zinc-600"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/** Renders the first-run screen only while no selection has been saved. */
export function FirstRunLanguages() {
  const [selection, setSelection] = useState<string[] | null>(() => loadLanguageSelection());
  if (selection) return null;
  return <LanguageOnboarding onDone={setSelection} />;
}
