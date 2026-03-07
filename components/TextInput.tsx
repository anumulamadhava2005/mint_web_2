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
      <div className="relative">
        <input
          id={id}
          name={id}
          ref={inputRef}
          type={showPassword && type === "password" ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete ?? "off"}
          className={`peer w-full rounded-xl border bg-white/5 px-4 py-4 text-white placeholder-transparent transition-all duration-300 focus:outline-none ${
            focused ? "border-white shadow-lg shadow-white/10" : "border-white/10 hover:border-white/20"
          }`}
        />

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
            setShowPassword((s) => !s);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-300 hover:text-white"
        >
          {/* eye icon (no reveal animation) */}
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
