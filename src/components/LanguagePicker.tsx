import { Check } from "lucide-react";
import { LANGUAGES } from "../lib/languages";
import { cx } from "../lib/utils";

export function LanguagePicker({
  selected,
  onToggle,
  autoFocus = false,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Languages"
      className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
    >
      {LANGUAGES.map((language, index) => {
        const active = selected.includes(language.id);
        return (
          <button
            key={language.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            autoFocus={autoFocus && index === 0}
            onClick={() => onToggle(language.id)}
            className={cx(
              "flex items-start gap-2 border px-2.5 py-2 text-left transition-colors",
              active
                ? "border-acid/60 bg-acid/[0.08]"
                : "border-line bg-panel hover:border-zinc-600",
            )}
          >
            <span
              className={cx(
                "mt-[1px] grid h-3.5 w-3.5 shrink-0 place-items-center border",
                active
                  ? "border-acid bg-acid text-[#0a0c04]"
                  : "border-zinc-700 text-transparent",
              )}
            >
              <Check size={9} strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span
                className={cx(
                  "block truncate text-[11px]",
                  active ? "text-zinc-100" : "text-zinc-300",
                )}
              >
                {language.label}
              </span>
              <span className="block truncate font-mono text-[8.5px] text-zinc-600">
                {language.detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
