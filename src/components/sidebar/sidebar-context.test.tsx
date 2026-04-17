import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SidebarProvider, useSidebar } from "./sidebar-context";

// Helper component that exposes sidebar context values for assertions
function SidebarConsumer() {
  const { open, isMobile, setOpen, toggle } = useSidebar();
  return (
    <div>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="is-mobile">{String(isMobile)}</span>
      <button data-testid="set-open-true" onClick={() => setOpen(true)}>
        Open
      </button>
      <button data-testid="set-open-false" onClick={() => setOpen(false)}>
        Close
      </button>
      <button data-testid="toggle" onClick={() => toggle()}>
        Toggle
      </button>
    </div>
  );
}

// Tracks the change listener registered by matchMedia
let mqlChangeHandler: ((e: MediaQueryListEvent) => void) | null = null;

function createMockMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
      mqlChangeHandler = handler;
    },
    removeEventListener: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("SidebarProvider", () => {
  beforeEach(() => {
    mqlChangeHandler = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to open on desktop", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("true");
    expect(screen.getByTestId("is-mobile")).toHaveTextContent("false");

    vi.unstubAllGlobals();
  });

  it("defaults to closed on mobile", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(true));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("false");
    expect(screen.getByTestId("is-mobile")).toHaveTextContent("true");

    vi.unstubAllGlobals();
  });

  it("responds to media query changes from desktop to mobile", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("true");
    expect(screen.getByTestId("is-mobile")).toHaveTextContent("false");

    // Simulate viewport change to mobile
    act(() => {
      mqlChangeHandler!({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByTestId("open")).toHaveTextContent("false");
    expect(screen.getByTestId("is-mobile")).toHaveTextContent("true");

    vi.unstubAllGlobals();
  });

  it("setOpen callback updates state correctly", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("true");

    act(() => {
      screen.getByTestId("set-open-false").click();
    });
    expect(screen.getByTestId("open")).toHaveTextContent("false");

    act(() => {
      screen.getByTestId("set-open-true").click();
    });
    expect(screen.getByTestId("open")).toHaveTextContent("true");

    vi.unstubAllGlobals();
  });

  it("⌘+\\ keydown event toggles sidebar open state", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("true");

    // Simulate ⌘+\ (metaKey)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "\\",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("open")).toHaveTextContent("false");

    // Toggle back
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "\\",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("open")).toHaveTextContent("true");

    vi.unstubAllGlobals();
  });

  it("Ctrl+\\ keydown event also toggles sidebar", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("true");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "\\",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("open")).toHaveTextContent("false");

    vi.unstubAllGlobals();
  });

  it("ignores \\ keydown without meta or ctrl modifier", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("open")).toHaveTextContent("true");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "\\",
          bubbles: true,
        })
      );
    });

    // Should remain open — no modifier key
    expect(screen.getByTestId("open")).toHaveTextContent("true");

    vi.unstubAllGlobals();
  });
});

describe("useSidebar", () => {
  it("throws when used outside SidebarProvider", () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<SidebarConsumer />)).toThrow(
      "useSidebar must be used within a SidebarProvider"
    );

    spy.mockRestore();
  });
});
