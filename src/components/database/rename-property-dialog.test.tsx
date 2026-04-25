import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RenamePropertyDialog } from "./rename-property-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(
  overrides: Partial<Parameters<typeof RenamePropertyDialog>[0]> = {},
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    propertyName: "Status",
    onRename: vi.fn(),
    ...overrides,
  };
  const result = render(<RenamePropertyDialog {...props} />);
  return { ...result, props };
}

function getInput() {
  return screen.getByLabelText("Name");
}

function getRenameButton() {
  return screen.getByRole("button", { name: "Rename" });
}

function getCancelButton() {
  return screen.getByRole("button", { name: "Cancel" });
}

/** Advance past the 50ms auto-select timer in the RenameForm. */
function flushAutoSelect() {
  vi.advanceTimersByTime(60);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Dialog opens with current property name pre-filled
// ---------------------------------------------------------------------------

describe("RenamePropertyDialog — initial state", () => {
  it("opens with the current property name pre-filled in the input", () => {
    renderDialog({ propertyName: "Priority" });
    flushAutoSelect();

    const input = getInput();
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Priority");
  });

  it("shows dialog title and description", () => {
    renderDialog();
    flushAutoSelect();

    expect(screen.getByText("Rename property")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a new name for this property."),
    ).toBeInTheDocument();
  });

  it("disables Rename button when name is unchanged", () => {
    renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    expect(getRenameButton()).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Validates non-empty name
// ---------------------------------------------------------------------------

describe("RenamePropertyDialog — validation", () => {
  it("disables Rename button when input is empty", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    await user.clear(getInput());

    expect(getRenameButton()).toBeDisabled();
  });

  it("disables Rename button when input is only whitespace", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "   ");

    expect(getRenameButton()).toBeDisabled();
  });

  it("enables Rename button when a different non-empty name is entered", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "Priority");

    expect(getRenameButton()).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Calls rename callback with new name on submit
// ---------------------------------------------------------------------------

describe("RenamePropertyDialog — submit", () => {
  it("calls onRename with trimmed new name when Rename button is clicked", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "Priority");
    await user.click(getRenameButton());

    expect(props.onRename).toHaveBeenCalledWith("Priority");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onRename with trimmed new name on Enter key", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "Priority{Enter}");

    expect(props.onRename).toHaveBeenCalledWith("Priority");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("trims whitespace from the new name", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "  New Name  {Enter}");

    expect(props.onRename).toHaveBeenCalledWith("New Name");
  });
});

// ---------------------------------------------------------------------------
// Closes dialog on cancel
// ---------------------------------------------------------------------------

describe("RenamePropertyDialog — cancel", () => {
  it("calls onOpenChange(false) when Cancel button is clicked", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    await user.click(getCancelButton());

    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancels without calling onRename when name is unchanged and Enter is pressed", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.type(input, "{Enter}");

    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancels without calling onRename when input is empty and Enter is pressed", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "{Enter}");

    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// Handles duplicate name error (component delegates to onRename callback —
// the parent is responsible for duplicate detection)
// ---------------------------------------------------------------------------

describe("RenamePropertyDialog — duplicate name handling", () => {
  it("passes the new name to onRename for the parent to validate duplicates", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const { props } = renderDialog({ propertyName: "Status" });
    flushAutoSelect();

    const input = getInput();
    await user.clear(input);
    await user.type(input, "ExistingName{Enter}");

    expect(props.onRename).toHaveBeenCalledWith("ExistingName");
  });
});

// ---------------------------------------------------------------------------
// Does not render form when closed
// ---------------------------------------------------------------------------

describe("RenamePropertyDialog — closed state", () => {
  it("does not render the form when open is false", () => {
    renderDialog({ open: false });

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.queryByText("Rename property")).not.toBeInTheDocument();
  });
});
