"use client";

import React, { useEffect, useState, useRef } from "react";

export default function GlobalProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const activeRequestsRef = useRef(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    const startProgress = () => {
      // Clear any pending fade-out timers
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }

      setVisible(true);

      // Start simulated incremental progression
      if (!progressTimerRef.current) {
        progressTimerRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev;
            // Easing step: move closer to 90%
            const remaining = 90 - prev;
            return prev + Math.max(1, remaining * 0.15);
          });
        }, 150);
      }
    };

    const stopProgress = () => {
      // Clear incremental progression
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      // Finish progression to 100%
      setProgress(100);

      // Delay fading out so user can see completion
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);

        // Reset progress back to 0 after fade transition completes
        fadeTimerRef.current = setTimeout(() => {
          setProgress(0);
        }, 300);
      }, 400);
    };

    window.fetch = async (...args) => {
      activeRequestsRef.current += 1;
      if (activeRequestsRef.current === 1) {
        startProgress();
      }

      try {
        return await originalFetch(...args);
      } finally {
        activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
        if (activeRequestsRef.current === 0) {
          stopProgress();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2.5px",
        zIndex: 99999,
        pointerEvents: "none",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #10b981, #34d399, #6ee7b7)",
          boxShadow: "0 0 10px #34d399, 0 0 4px #10b981",
          opacity: visible ? 1 : 0,
          transition: progress === 100 
            ? "width 200ms ease-out, opacity 300ms ease-out" 
            : "width 300ms cubic-bezier(0.08, 0.8, 0.1, 1), opacity 300ms ease-in-out",
        }}
      />
    </div>
  );
}
