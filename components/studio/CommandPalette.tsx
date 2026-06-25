"use client";

// ═══════════════════════════════════════════════════════════════
// Command palette — ⌘K / Ctrl+K. Keyboard-first navigation between
// studio surfaces plus quick actions. Rendered in a native <dialog>
// so it escapes any stacking/overflow context.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  hint?: string;
  keywords?: string;
  run: () => void;
}

// Mounted only while open (the parent renders it conditionally with a key),
// so all internal state initialises fresh on each open — no reset plumbing.
export function CommandPalette({
  onClose,
  commands,
}: {
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      (c.label + " " + c.group + " " + (c.keywords ?? "")).toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Keep the active index within bounds without a state round-trip.
  const activeIdx = Math.min(active, Math.max(0, filtered.length - 1));

  // Focus the input on mount (DOM side-effect only — no setState).
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) {
        cmd.run();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // group rendering order preserved from first appearance
  const groups: { name: string; items: Command[] }[] = [];
  for (const c of filtered) {
    let g = groups.find((x) => x.name === c.group);
    if (!g) {
      g = { name: c.group, items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }

  let runningIndex = -1;

  return (
    <div
      className="studio-scrim fixed inset-0 z-[var(--st-z-modal,1000)] flex items-start justify-center pt-[14vh]"
      style={{ animation: "st-fade-in var(--st-dur) var(--st-ease)" }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        className="w-full max-w-[560px] overflow-hidden rounded-[var(--st-r-lg)]"
        style={{
          background: "var(--st-elevated)",
          boxShadow: "var(--st-shadow-floating)",
          border: "1px solid var(--st-border-2)",
          animation: "st-pop-in var(--st-dur-slow) var(--st-ease-out)",
        }}
      >
        <div className="flex items-center gap-2.5 px-4" style={{ borderBottom: "1px solid var(--st-border)" }}>
          <Search size={16} style={{ color: "var(--st-text-3)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent py-3.5 text-[13.5px] outline-none placeholder:text-[var(--st-text-3)]"
            style={{ color: "var(--st-text)" }}
          />
          <kbd
            className="rounded-[var(--st-r-sm)] px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--st-surface)", color: "var(--st-text-3)" }}
          >
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-[12.5px]" style={{ color: "var(--st-text-3)" }}>
              No results for “{query}”
            </div>
          )}
          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <div
                className="px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: "var(--st-text-3)" }}
              >
                {g.name}
              </div>
              {g.items.map((c) => {
                runningIndex += 1;
                const idx = runningIndex;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseMove={() => setActive(idx)}
                    onClick={() => {
                      c.run();
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left"
                    style={{ background: isActive ? "var(--st-brand-tint)" : "transparent" }}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--st-r-md)]"
                      style={{
                        background: "var(--st-surface)",
                        color: isActive ? "var(--st-brand)" : "var(--st-text-2)",
                      }}
                    >
                      {c.icon}
                    </span>
                    <span className="flex-1 text-[12.5px] font-medium" style={{ color: "var(--st-text)" }}>
                      {c.label}
                    </span>
                    {c.hint && (
                      <kbd
                        className="rounded-[var(--st-r-sm)] px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: "var(--st-surface)", color: "var(--st-text-3)" }}
                      >
                        {c.hint}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div
          className="flex items-center gap-4 px-4 py-2 text-[10.5px]"
          style={{ borderTop: "1px solid var(--st-border)", color: "var(--st-text-3)" }}
        >
          <span className="flex items-center gap-1">
            <ArrowUp size={11} />
            <ArrowDown size={11} /> navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={11} /> select
          </span>
        </div>
      </div>
    </div>
  );
}
