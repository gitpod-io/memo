import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "./theme";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("defaults to dark when localStorage is empty", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe("dark");
    expect(result.current.resolved).toBe("dark");
  });

  it("reads stored preference from localStorage", () => {
    localStorage.setItem("memo-theme", "light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe("light");
    expect(result.current.resolved).toBe("light");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("memo-theme", "invalid-value");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe("dark");
  });

  it("persists preference changes to localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setPreference("light"));
    expect(localStorage.getItem("memo-theme")).toBe("light");
    expect(result.current.preference).toBe("light");
  });

  /**
   * Regression test for Sentry MEMO-2H: SecurityError when localStorage is
   * blocked (restricted browsers, privacy settings, embedded contexts).
   * ThemeProvider must fall back to dark theme instead of crashing.
   */
  describe("localStorage SecurityError handling", () => {
    let getItemSpy: ReturnType<typeof vi.spyOn>;
    let setItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(
        () => {
          throw new DOMException(
            "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
            "SecurityError",
          );
        },
      );
      setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(
        () => {
          throw new DOMException(
            "Failed to set the 'localStorage' property on 'Window': Access is denied for this document.",
            "SecurityError",
          );
        },
      );
    });

    afterEach(() => {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });

    it("falls back to dark theme when getItem throws SecurityError", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.preference).toBe("dark");
      expect(result.current.resolved).toBe("dark");
    });

    it("does not crash when setItem throws SecurityError", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(() => {
        act(() => result.current.setPreference("light"));
      }).not.toThrow();
      expect(result.current.preference).toBe("light");
      expect(result.current.resolved).toBe("light");
    });
  });
});
