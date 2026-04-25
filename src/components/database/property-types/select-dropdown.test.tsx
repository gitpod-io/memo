import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { SelectOption } from "@/lib/types";
import { SelectDropdown } from "./select-dropdown";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTIONS: SelectOption[] = [
  { id: "opt-1", name: "High", color: "red" },
  { id: "opt-2", name: "Medium", color: "yellow" },
  { id: "opt-3", name: "Low", color: "green" },
];

function renderDropdown(overrides: Partial<Parameters<typeof SelectDropdown>[0]> = {}) {
  const props = {
    options: OPTIONS,
    selected: [] as string[],
    multi: false,
    onSelect: vi.fn(),
    onDeselect: vi.fn(),
    onCreate: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const result = render(<SelectDropdown {...props} />);
  return { ...result, props };
}

// ---------------------------------------------------------------------------
// Rendering existing options
// ---------------------------------------------------------------------------

describe("SelectDropdown", () => {
  describe("rendering options", () => {
    it("renders all options with correct labels", () => {
      renderDropdown();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("Low")).toBeInTheDocument();
    });

    it("shows check icon for selected option in single-select mode", () => {
      renderDropdown({ selected: ["opt-1"], multi: false });
      // The selected option row should contain a check icon (svg)
      const highButton = screen.getByText("High").closest("button");
      expect(highButton).toBeInTheDocument();
      const svg = highButton!.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("shows checkboxes in multi-select mode", () => {
      renderDropdown({ selected: ["opt-1"], multi: true });
      // Multi-select renders a checkbox-like span for each option
      const buttons = screen.getAllByRole("button").filter(
        (btn) => btn.textContent !== "Change color",
      );
      // Should have 3 option buttons (no create button since query is empty)
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it("shows empty state when no options exist and query is empty", () => {
      renderDropdown({ options: [] });
      expect(screen.getByText("No options")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Search filtering
  // ---------------------------------------------------------------------------

  describe("search filtering", () => {
    it("filters options by search query", async () => {
      const user = userEvent.setup();
      renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "hi");
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.queryByText("Medium")).toBeNull();
      expect(screen.queryByText("Low")).toBeNull();
    });

    it("filters case-insensitively", async () => {
      const user = userEvent.setup();
      renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "HIGH");
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.queryByText("Medium")).toBeNull();
    });

    it("shows create button instead of 'No options' when query has no match", async () => {
      const user = userEvent.setup();
      renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Nonexistent");
      // When query doesn't match, showCreate is true so "No options" is hidden
      expect(screen.queryByText("No options")).toBeNull();
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    it("shows create button when query does not match any existing option", async () => {
      const user = userEvent.setup();
      renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Critical");
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    it("does not show create button when query exactly matches an existing option", async () => {
      const user = userEvent.setup();
      renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "High");
      expect(screen.queryByText("Create")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Selecting an option (single-select)
  // ---------------------------------------------------------------------------

  describe("single-select", () => {
    it("calls onSelect when an unselected option is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ multi: false });
      await user.click(screen.getByText("Medium"));
      expect(props.onSelect).toHaveBeenCalledWith("opt-2");
    });

    it("calls onDeselect when a selected option is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ selected: ["opt-1"], multi: false });
      await user.click(screen.getByText("High"));
      expect(props.onDeselect).toHaveBeenCalledWith("opt-1");
    });

    it("calls onClose after selecting in single-select mode", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ multi: false });
      await user.click(screen.getByText("Low"));
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Multi-select mode
  // ---------------------------------------------------------------------------

  describe("multi-select", () => {
    it("calls onSelect when an unselected option is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ selected: ["opt-1"], multi: true });
      await user.click(screen.getByText("Medium"));
      expect(props.onSelect).toHaveBeenCalledWith("opt-2");
    });

    it("calls onDeselect when a selected option is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ selected: ["opt-1", "opt-2"], multi: true });
      await user.click(screen.getByText("High"));
      expect(props.onDeselect).toHaveBeenCalledWith("opt-1");
    });

    it("does not call onClose after selecting in multi-select mode", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ selected: [], multi: true });
      await user.click(screen.getByText("Low"));
      expect(props.onSelect).toHaveBeenCalledWith("opt-3");
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it("allows selecting multiple options", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ selected: [], multi: true });
      await user.click(screen.getByText("High"));
      await user.click(screen.getByText("Low"));
      expect(props.onSelect).toHaveBeenCalledWith("opt-1");
      expect(props.onSelect).toHaveBeenCalledWith("opt-3");
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Creating a new option
  // ---------------------------------------------------------------------------

  describe("creating options", () => {
    it("calls onCreate when the create button is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Critical");
      await user.click(screen.getByText("Create"));
      expect(props.onCreate).toHaveBeenCalledWith("Critical");
    });

    it("clears the search query after creating", async () => {
      const user = userEvent.setup();
      renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Critical");
      await user.click(screen.getByText("Create"));
      expect(input).toHaveValue("");
    });

    it("calls onCreate via Enter key when create option is available", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Critical{Enter}");
      expect(props.onCreate).toHaveBeenCalledWith("Critical");
    });

    it("calls onClose after creating in single-select mode", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ multi: false });
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Critical");
      await user.click(screen.getByText("Create"));
      expect(props.onClose).toHaveBeenCalled();
    });

    it("does not call onClose after creating in multi-select mode", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown({ multi: true });
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Critical");
      await user.click(screen.getByText("Create"));
      expect(props.onCreate).toHaveBeenCalledWith("Critical");
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it("does not create when query is empty whitespace", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "   ");
      // No create button should appear for whitespace-only input
      expect(screen.queryByText("Create")).toBeNull();
      expect(props.onCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  describe("keyboard navigation", () => {
    it("calls onClose when Escape is pressed", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "{Escape}");
      expect(props.onClose).toHaveBeenCalled();
    });

    it("creates option on Enter when create is available", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "Urgent{Enter}");
      expect(props.onCreate).toHaveBeenCalledWith("Urgent");
    });

    it("does not create on Enter when query matches an existing option", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      const input = screen.getByPlaceholderText("Search or create…");
      await user.type(input, "High{Enter}");
      expect(props.onCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Color change
  // ---------------------------------------------------------------------------

  describe("color change", () => {
    it("shows color dots when onColorChange is provided", () => {
      renderDropdown({ onColorChange: vi.fn() });
      const colorDots = screen.getAllByLabelText("Change color");
      expect(colorDots).toHaveLength(3);
    });

    it("does not show color dots when onColorChange is not provided", () => {
      renderDropdown();
      expect(screen.queryByLabelText("Change color")).toBeNull();
    });

    it("opens color picker when color dot is clicked", async () => {
      const user = userEvent.setup();
      renderDropdown({ onColorChange: vi.fn() });
      const colorDots = screen.getAllByLabelText("Change color");
      await user.click(colorDots[0]);
      // Color picker should show color options
      expect(screen.getByLabelText("Color: blue")).toBeInTheDocument();
      expect(screen.getByLabelText("Color: red")).toBeInTheDocument();
    });

    it("calls onColorChange when a color is selected", async () => {
      const user = userEvent.setup();
      const onColorChange = vi.fn();
      renderDropdown({ onColorChange });
      const colorDots = screen.getAllByLabelText("Change color");
      await user.click(colorDots[0]);
      await user.click(screen.getByLabelText("Color: blue"));
      expect(onColorChange).toHaveBeenCalledWith("opt-1", "blue");
    });

    it("closes color picker after selecting a color", async () => {
      const user = userEvent.setup();
      renderDropdown({ onColorChange: vi.fn() });
      const colorDots = screen.getAllByLabelText("Change color");
      await user.click(colorDots[0]);
      expect(screen.getByLabelText("Color: blue")).toBeInTheDocument();
      await user.click(screen.getByLabelText("Color: blue"));
      // Color picker should be closed — no color labels visible
      expect(screen.queryByLabelText("Color: blue")).toBeNull();
    });

    it("toggles color picker off when same color dot is clicked again", async () => {
      const user = userEvent.setup();
      renderDropdown({ onColorChange: vi.fn() });
      const colorDots = screen.getAllByLabelText("Change color");
      await user.click(colorDots[0]);
      expect(screen.getByLabelText("Color: blue")).toBeInTheDocument();
      // Click the same color dot again to close
      await user.click(colorDots[0]);
      expect(screen.queryByLabelText("Color: blue")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Click outside to close
  // ---------------------------------------------------------------------------

  describe("click outside", () => {
    it("calls onClose when clicking outside the dropdown", async () => {
      const user = userEvent.setup();
      const { props } = renderDropdown();
      // Click on the document body (outside the dropdown container)
      await user.click(document.body);
      expect(props.onClose).toHaveBeenCalled();
    });
  });
});
