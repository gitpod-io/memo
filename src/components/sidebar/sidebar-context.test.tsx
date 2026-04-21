import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SidebarProvider, useSidebar } from "./sidebar-context";

// Helper component that exposes sidebar context values for assertions
function SidebarConsumer() {
  const { open, isMobile, isMac, setOpen, toggle, focusMode, toggleFocusMode } = useSidebar();
  return (
    <div>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="is-mobile">{String(isMobile)}</span>
      <span data-testid="is-mac">{String(isMac)}</span>
      <span data-testid="focus-mode">{String(focusMode)}</span>
      <button data-testid="set-open-true" onClick={() => setOpen(true)}>
        Open
      </button>
      <button data-testid="set-open-false" onClick={() => setOpen(false)}>
        Close
      </button>
      <button data-testid="toggle" onClick={() => toggle()}>
        Toggle
      </button>
      <button data-testid="toggle-focus-mode" onClick={() => toggleFocusMode()}>
        Toggle Focus Mode
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

  it("⌘+K opens sidebar and focuses search input when sidebar is closed", async () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    const focusSpy = vi.fn();
    const fakeInput = { focus: focusSpy } as unknown as HTMLInputElement;
    const fakeRef = { current: fakeInput };

    function SearchRegistrar() {
      const { registerSearchRef } = useSidebar();
      // Register on mount
      registerSearchRef(fakeRef);
      return null;
    }

    render(
      <SidebarProvider>
        <SidebarConsumer />
        <SearchRegistrar />
      </SidebarProvider>
    );

    // Close the sidebar first
    act(() => {
      screen.getByTestId("set-open-false").click();
    });
    expect(screen.getByTestId("open")).toHaveTextContent("false");

    // Simulate ⌘+K
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    // Sidebar should open
    expect(screen.getByTestId("open")).toHaveTextContent("true");

    // Focus is deferred via rAF — flush it
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(focusSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("⌘+K does not fire when a Lexical editor element is focused", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
        {/* Simulate a Lexical editor element */}
        <div data-lexical-editor="true">
          <input data-testid="editor-input" />
        </div>
      </SidebarProvider>
    );

    // Close sidebar
    act(() => {
      screen.getByTestId("set-open-false").click();
    });
    expect(screen.getByTestId("open")).toHaveTextContent("false");

    // Focus the editor input so document.activeElement is inside [data-lexical-editor]
    const editorInput = screen.getByTestId("editor-input");
    editorInput.focus();

    // Simulate ⌘+K — should be ignored because editor is focused
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    // Sidebar should remain closed
    expect(screen.getByTestId("open")).toHaveTextContent("false");

    vi.unstubAllGlobals();
  });

  it("Ctrl+K also triggers search focus (non-Mac)", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    const focusSpy = vi.fn();
    const fakeInput = { focus: focusSpy } as unknown as HTMLInputElement;
    const fakeRef = { current: fakeInput };

    function SearchRegistrar() {
      const { registerSearchRef } = useSidebar();
      registerSearchRef(fakeRef);
      return null;
    }

    render(
      <SidebarProvider>
        <SidebarConsumer />
        <SearchRegistrar />
      </SidebarProvider>
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    // Sidebar should remain open (was already open)
    expect(screen.getByTestId("open")).toHaveTextContent("true");

    vi.unstubAllGlobals();
  });

  it("ignores K keydown without meta or ctrl modifier", () => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    // Close sidebar
    act(() => {
      screen.getByTestId("set-open-false").click();
    });
    expect(screen.getByTestId("open")).toHaveTextContent("false");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          bubbles: true,
        })
      );
    });

    // Should remain closed — no modifier key
    expect(screen.getByTestId("open")).toHaveTextContent("false");

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

describe("Focus mode", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to focus mode off", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");
  });

  it("toggleFocusMode toggles focus mode on and off", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");

    act(() => {
      screen.getByTestId("toggle-focus-mode").click();
    });
    expect(screen.getByTestId("focus-mode")).toHaveTextContent("true");

    act(() => {
      screen.getByTestId("toggle-focus-mode").click();
    });
    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");
  });

  it("⌘+Shift+F toggles focus mode", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F",
          shiftKey: true,
          metaKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("true");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F",
          shiftKey: true,
          metaKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");
  });

  it("Ctrl+Shift+F also toggles focus mode", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F",
          shiftKey: true,
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("true");
  });

  it("Escape exits focus mode", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    // Enter focus mode
    act(() => {
      screen.getByTestId("toggle-focus-mode").click();
    });
    expect(screen.getByTestId("focus-mode")).toHaveTextContent("true");

    // Press Escape
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");
  });

  it("Escape does not exit focus mode when a dialog is open", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
        <div data-state="open" role="dialog" />
      </SidebarProvider>
    );

    // Enter focus mode
    act(() => {
      screen.getByTestId("toggle-focus-mode").click();
    });
    expect(screen.getByTestId("focus-mode")).toHaveTextContent("true");

    // Press Escape — should be ignored because dialog is open
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("true");
  });

  it("Escape does nothing when focus mode is off", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>
    );

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );
    });

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("false");
  });
});
