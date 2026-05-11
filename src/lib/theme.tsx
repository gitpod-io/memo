"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const D = "dark" as const;
const MQ = "(prefers-color-scheme:dark)";
const Ctx = createContext<ThemeContextValue | null>(null);

function sys(): ResolvedTheme {
  if (typeof window === "undefined") return D;
  return window.matchMedia(MQ).matches ? D : "light";
}

function apply(t: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle(D, t === D);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return D;
    const s = localStorage.getItem("memo-theme");
    return s === "light" || s === D || s === "system" ? s : D;
  });
  const [resolved, setRes] = useState<ResolvedTheme>(() =>
    preference === "system" ? sys() : preference,
  );

  function set(p: ThemePreference) {
    localStorage.setItem("memo-theme", p);
    setPref(p);
    const n = p === "system" ? sys() : p;
    setRes(n);
    apply(n);
  }

  useEffect(() => {
    apply(resolved);
    if (preference !== "system") return;
    const mq = window.matchMedia(MQ);
    function fn() {
      const n = sys();
      setRes(n);
      apply(n);
    }
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [preference, resolved]);

  return (
    <Ctx value={{ preference, resolved, setPreference: set }}>
      {children}
    </Ctx>
  );
}

export function useTheme(): ThemeContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("no theme");
  return v;
}
