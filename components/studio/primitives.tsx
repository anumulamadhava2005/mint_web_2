"use client";

// ═══════════════════════════════════════════════════════════════
// Studio primitives — the shared vocabulary every ProEditor surface
// is built from. One set of controls so an input/select/toggle/
// section behaves identically across the State Manager, Auth editor,
// Workflow editor, etc. (PRODUCT.md principle: "Consistency is trust").
// ═══════════════════════════════════════════════════════════════

import {
  forwardRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ── Inspector shell ──────────────────────────────────────────────

export function Inspector({
  title,
  tabs,
  children,
}: {
  title: string;
  tabs?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside
      className="flex h-full w-[300px] shrink-0 flex-col border-l"
      style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
    >
      <div
        className="flex h-11 shrink-0 items-center justify-between border-b px-3.5"
        style={{ borderColor: "var(--st-border)" }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--st-text-2)" }}
        >
          {title}
        </span>
        {tabs}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

export function InspectorTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; icon: ReactNode; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            title={t.label}
            aria-label={t.label}
            aria-pressed={active}
            className="st-pressable grid h-6 w-6 place-items-center rounded-[var(--st-r-sm)] active:scale-[0.92]"
            style={{
              color: active ? "var(--st-brand)" : "var(--st-text-3)",
              background: active ? "var(--st-brand-tint)" : "transparent",
            }}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}

// ── Collapsible section ──────────────────────────────────────────

export function Section({
  title,
  badge,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b" style={{ borderColor: "var(--st-border)" }}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
          aria-expanded={open}
        >
          <ChevronDown
            size={13}
            strokeWidth={2.5}
            className="shrink-0"
            style={{ color: "var(--st-text-3)", transform: open ? "none" : "rotate(-90deg)", transition: "transform var(--st-dur-fast) var(--st-ease-out)" }}
          />
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--st-text-2)" }}
          >
            {title}
          </span>
          {badge != null && (
            <span
              className="ml-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold tabular-nums"
              style={{ background: "var(--st-surface-2)", color: "var(--st-text-2)" }}
            >
              {badge}
            </span>
          )}
        </button>
        {right && <div className="pr-2.5">{right}</div>}
      </div>
      {open && <div className="px-3.5 pb-3.5 pt-0.5">{children}</div>}
    </section>
  );
}

// ── Field row ────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium"
        style={{ color: "var(--st-text-2)" }}
      >
        {label}
        {hint && (
          <span className="font-normal" style={{ color: "var(--st-text-3)" }}>
            · {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const fieldBase =
  "w-full rounded-[var(--st-r-md)] px-2.5 py-1.5 text-[12.5px] outline-none transition-shadow placeholder:text-[var(--st-text-3)]";

function fieldStyle(): React.CSSProperties {
  return {
    background: "var(--st-bg)",
    color: "var(--st-text)",
    boxShadow: "inset 0 0 0 1px var(--st-border-2)",
  };
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  function TextField({ className, mono, onFocus, onBlur, style, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={cx(fieldBase, mono && "font-[family-name:var(--st-mono)]", className)}
        style={{ ...fieldStyle(), ...style }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "inset 0 0 0 1px var(--st-focus)";
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "inset 0 0 0 1px var(--st-border-2)";
          onBlur?.(e);
        }}
      />
    );
  }
);

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ className, children, style, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          {...props}
          className={cx(fieldBase, "cursor-pointer appearance-none pr-7", className)}
          style={{ ...fieldStyle(), ...style }}
        >
          {children}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--st-text-3)" }}
        />
      </div>
    );
  }
);

// ── Segmented control ────────────────────────────────────────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className="inline-flex w-full gap-0.5 rounded-[var(--st-r-md)] p-0.5"
      style={{ background: "var(--st-bg)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "st-pressable flex-1 rounded-[5px] font-medium active:scale-[0.97]",
              size === "sm" ? "py-1 text-[10.5px]" : "py-1.5 text-[12px]"
            )}
            style={{
              background: active ? "var(--st-elevated)" : "transparent",
              color: active ? "var(--st-text)" : "var(--st-text-3)",
              boxShadow: active ? "var(--st-shadow-raised)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[18px] w-8 shrink-0 rounded-full transition-colors active:opacity-80"
      style={{ background: checked ? "var(--st-brand)" : "var(--st-border-3)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-[14px] w-[14px] rounded-full bg-white"
        style={{ transform: checked ? "translateX(14px)" : "none", transition: "transform var(--st-dur) var(--st-ease-out)" }}
      />
    </button>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 last:mb-0">
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium" style={{ color: "var(--st-text)" }}>
          {label}
        </div>
        {hint && (
          <div className="text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
            {hint}
          </div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

// ── Buttons ──────────────────────────────────────────────────────

type BtnVariant = "primary" | "ghost" | "outline" | "danger";

export function Btn({
  variant = "ghost",
  size = "md",
  className,
  style,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: "var(--st-brand)", color: "#fff" },
    ghost: { background: "transparent", color: "var(--st-text-2)" },
    outline: { background: "transparent", color: "var(--st-text)", boxShadow: "inset 0 0 0 1px var(--st-border-2)" },
    danger: { background: "transparent", color: "var(--st-error)" },
  };
  return (
    <button
      {...props}
      className={cx(
        "st-pressable inline-flex items-center justify-center gap-1.5 rounded-[var(--st-r-md)] font-medium active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12px]",
        variant === "ghost" && "hover:bg-white/[0.05]",
        className
      )}
      style={{ ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  className,
  style,
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        "st-pressable grid h-7 w-7 place-items-center rounded-[var(--st-r-md)] active:scale-[0.97] hover:bg-white/[0.06]",
        className
      )}
      style={{
        color: active ? "var(--st-brand)" : "var(--st-text-2)",
        background: active ? "var(--st-brand-tint)" : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Pill / badge ─────────────────────────────────────────────────

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "info";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--st-surface-2)", fg: "var(--st-text-2)" },
    brand: { bg: "var(--st-brand-tint)", fg: "var(--st-brand)" },
    success: { bg: "rgba(74,222,128,0.14)", fg: "var(--st-success)" },
    warning: { bg: "rgba(251,191,36,0.14)", fg: "var(--st-warning)" },
    info: { bg: "rgba(96,165,250,0.14)", fg: "var(--st-info)" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--st-r-sm)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

// ── Empty state ──────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div
          className="mb-4 grid h-12 w-12 place-items-center rounded-[var(--st-r-lg)]"
          style={{ background: "var(--st-surface)", color: "var(--st-text-3)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}
        >
          {icon}
        </div>
        <h3 className="mb-1.5 text-[14px] font-semibold" style={{ color: "var(--st-text)" }}>
          {title}
        </h3>
        <p className="mb-5 text-[12.5px] leading-relaxed" style={{ color: "var(--st-text-3)" }}>
          {description}
        </p>
        {action}
      </div>
    </div>
  );
}

export { cx };
