"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  isMobile: boolean;
  isMac: boolean;
  registerSearchRef: (ref: RefObject<HTMLInputElement | null>) => void;
  focusSearch: () => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const MOBILE_BREAKPOINT = 768;

function isEditorFocused(): boolean {
  return document.activeElement?.closest("[data-lexical-editor]") !== null;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isMac] = useState(
    () => typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")
  );
  const searchRef = useRef<RefObject<HTMLInputElement | null> | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      if (mobile) {
        setOpen(false);
      }
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const registerSearchRef = useCallback(
    (ref: RefObject<HTMLInputElement | null>) => {
      searchRef.current = ref;
    },
    []
  );

  const focusSearch = useCallback(() => {
    setOpen(true);
    // Delay focus to allow the sidebar to render when opening from collapsed
    requestAnimationFrame(() => {
      searchRef.current?.current?.focus();
    });
  }, []);

  // ⌘+\ keyboard shortcut to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // ⌘+K keyboard shortcut to focus search — yields to editor's ⌘+K (link insertion)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey) && !isEditorFocused()) {
        e.preventDefault();
        focusSearch();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusSearch]);

  // ? keyboard shortcut to open keyboard shortcuts dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!(e.target instanceof HTMLElement)) return;
      const tag = e.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target.isContentEditable ||
        e.target.closest("[data-lexical-editor]")
      ) {
        return;
      }
      e.preventDefault();
      setShortcutsOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        open,
        setOpen,
        toggle,
        isMobile,
        isMac,
        registerSearchRef,
        focusSearch,
        shortcutsOpen,
        setShortcutsOpen,
      }}
    >
      {children}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
