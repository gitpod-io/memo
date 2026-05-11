"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const STORAGE_KEY = "memo-theme";
const DARK_MQ = "(prefers-color-scheme:dark)";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia(DARK_MQ).matches ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "dark";
  });
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    preference === "system" ? getSystemTheme() : preference,
  );

  function setPreference(pref: ThemePreference) {
    localStorage.setItem(STORAGE_KEY, pref);
    setPreferenceState(pref);
    const next = pref === "system" ? getSystemTheme() : pref;
    setResolved(next);
    applyTheme(next);
  }

  useEffect(() => {
    applyTheme(resolved);
    if (preference !== "system") return;
    const mq = window.matchMedia(DARK_MQ);
    function onChange() {
      const next = getSystemTheme();
      setResolved(next);
      applyTheme(next);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, resolved]);

  return (
    <ThemeContext value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
