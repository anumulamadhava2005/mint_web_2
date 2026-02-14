"use client";

import React, { useState, useRef, useEffect } from "react";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
};

export default function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  minLength,
  autoComplete,
  className = "",
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Avoid non-deterministic values during server render. If autocomplete
    // is disabled, assign a randomized `name` on the client only to prevent
    // browsers from matching stored credentials by name.
    if ((autoComplete === "off" || autoComplete === undefined) && inputRef.current) {
      const rand = `noautocomplete-${Math.random().toString(36).slice(2, 8)}`;
      try {
        inputRef.current.setAttribute("name", rand);
      } catch {}
    }
  }, [autoComplete]);

  return (
    <div className={`group relative ${className}`}>
      <style>{`
        @keyframes letterReveal {
          0% { opacity: 0; transform: translateY(8px) scale(.98) blur(2px) }
          60% { opacity: 1; transform: translateY(-2px) scale(1.01) blur(0) }
          100% { opacity: 1; transform: translateY(0) scale(1) blur(0) }
        }
        .reveal-letter {
          display: inline-block;
          opacity: 0;
          transform: translateY(8px) scale(.98);
          filter: blur(2px);
          animation-name: letterReveal;
          animation-duration: 420ms;
          animation-fill-mode: forwards;
          animation-timing-function: cubic-bezier(.2,.9,.2,1);
        }
        .masked-dots { letter-spacing: 0.2em; opacity: .9 }
      `}</style>

      <div className="relative">
        <input
          id={id}
          name={id}
          ref={inputRef}
          type={type === "password" && showPassword ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete ?? "off"}
          style={type === "password" ? { color: showPassword ? undefined : "transparent", caretColor: "white" } : undefined}
          className={`peer w-full rounded-xl border bg-white/5 px-4 py-4 text-white placeholder-transparent transition-all duration-300 focus:outline-none ${
            focused ? "border-white shadow-lg shadow-white/10" : "border-white/10 hover:border-white/20"
          }`}
        />

        {type === "password" && (
          <div className="absolute inset-y-0 left-4 right-12 flex items-center pointer-events-none">
            {/* overlay text: either masked dots or animated letters */}
            {showPassword ? (
              <div key={revealKey} className="select-none text-white">
                {Array.from(value).map((ch, i) => (
                  <span
                    key={i}
                    className="reveal-letter"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            ) : (
              <div className="masked-dots text-white select-none">
                {Array.from({ length: value.length }).map((_, i) => (<span key={i}>•</span>))}
              </div>
            )}
          </div>
        )}

        <label
          htmlFor={id}
          className={`absolute left-4 transition-all duration-300 ${
            value || focused ? "-top-2.5 bg-white rounded-md px-2 text-xs text-black" : "top-4 text-sm text-zinc-500"
          }`}
        >
          {label}
        </label>

        <div className={`absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-gradient-to-r from-zinc-500 via-white to-zinc-500 transition-all duration-300 ${focused ? "w-full" : ""}`} />
      </div>

      {type === "password" && (
        <button
          type="button"
          aria-pressed={showPassword}
          onClick={(e) => {
            e.preventDefault();
            // toggle and bump revealKey to restart animation on show
            setShowPassword((s) => {
              const next = !s;
              if (next) setRevealKey((k) => k + 1);
              return next;
            });
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-300 hover:text-white"
        >
          {/* eye icon */}
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              <circle cx="12" cy="12" r="3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A3 3 0 0113.42 13.42" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
