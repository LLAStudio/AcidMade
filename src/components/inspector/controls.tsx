import { useState, type ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

export function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line-soft">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-[22px] w-full items-center gap-1.5 bg-shell/70 px-2 text-left hover:bg-[#0c0e10]"
      >
        <ChevronRight
          size={9}
          className={cx("shrink-0 text-zinc-700 transition-transform", open && "rotate-90")}
        />
        {Icon ? <Icon size={9} className="shrink-0 text-zinc-600" /> : null}
        <span className="label-caps flex-1 text-[9px] text-zinc-500">{title}</span>
        {badge ? <span className="font-mono text-[7.5px] text-zinc-700">{badge}</span> : null}
      </button>
      {open ? <div className="animate-fade-in">{children}</div> : null}
    </section>
  );
}

export function PropertyRow({
  label,
  children,
  hint,
  stack,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  stack?: boolean;
}) {
  return (
    <div
      className={cx(
        "group border-b border-line-soft/60 px-2 py-[2px] last:border-0 hover:bg-white/[0.018]",
        stack ? "py-1" : "flex min-h-[23px] items-center gap-2",
      )}
    >
      <div
        className={cx(
          "shrink-0 text-[10.5px] text-zinc-500 group-hover:text-zinc-400",
          stack ? "mb-1 block" : "w-[88px] truncate",
        )}
        title={label}
      >
        {label}
      </div>
      <div className={cx(stack ? "w-full" : "min-w-0 flex-1")}>{children}</div>
      {hint ? <span className="shrink-0 font-mono text-[7px] text-zinc-700">{hint}</span> : null}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  mono,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      placeholder={placeholder}
      className={cx("engine-input", mono && "font-mono text-[10.5px]")}
    />
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
      className="engine-input font-mono text-[10.5px]"
    />
  );
}

export function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="engine-select text-[10.5px]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function CheckField({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex h-[19px] items-center gap-1.5 text-[10.5px] transition-colors",
        disabled ? "cursor-not-allowed opacity-45" : "hover:text-zinc-200",
        checked ? "text-zinc-300" : "text-zinc-600",
      )}
    >
      <span
        className={cx(
          "grid h-[11px] w-[11px] place-items-center border",
          checked
            ? "border-acid/60 bg-acid/10 text-acid"
            : "border-line bg-void text-transparent",
        )}
      >
        <Check size={8} strokeWidth={2.6} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function SliderField({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-[3px] min-w-0 flex-1 cursor-pointer appearance-none rounded-none bg-[#2a3136] accent-[#ccff00]"
      />
      <span className="w-6 shrink-0 text-right font-mono text-[8px] text-zinc-500">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function ReadOnlyField({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <span
      className={cx(
        "block truncate text-[9.5px] text-zinc-500",
        mono && "font-mono text-[8.5px] text-zinc-600",
      )}
      title={value}
    >
      {value}
    </span>
  );
}

export function TextAreaField({
  value,
  onChange,
  rows = 3,
  mono,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      spellCheck={false}
      className={cx(
        "scroll-thin w-full rounded-[2px] border border-line bg-elevated px-1.5 py-1 text-[9.5px] leading-relaxed text-zinc-300 outline-none focus:border-acid/40",
        mono && "font-mono text-[8.5px]",
      )}
    />
  );
}
