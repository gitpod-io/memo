import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoleSelect } from "./role-select";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RoleSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  it("renders with the current role displayed", () => {
    render(<RoleSelect value="admin" onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("admin");
  });

  it("renders with member role displayed", () => {
    render(<RoleSelect value="member" onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("member");
  });

  // --- Options ---

  it("shows admin and member options by default (no owner)", async () => {
    const user = userEvent.setup();
    render(<RoleSelect value="member" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    const options = await screen.findAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("admin");
    expect(optionTexts).toContain("member");
    expect(optionTexts).not.toContain("owner");
  });

  it("includes owner option when includeOwner is true", async () => {
    const user = userEvent.setup();
    render(<RoleSelect value="admin" onChange={vi.fn()} includeOwner />);

    await user.click(screen.getByRole("combobox"));

    const options = await screen.findAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("owner");
    expect(optionTexts).toContain("admin");
    expect(optionTexts).toContain("member");
  });

  // --- onChange callback ---

  it("fires onChange with the new role when a different option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<RoleSelect value="member" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));

    const adminOption = await screen.findByRole("option", { name: "admin" });
    await user.click(adminOption);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("admin");
    });
  });

  it("fires onChange with owner role when owner is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<RoleSelect value="member" onChange={onChange} includeOwner />);

    await user.click(screen.getByRole("combobox"));

    const ownerOption = await screen.findByRole("option", { name: "owner" });
    await user.click(ownerOption);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("owner");
    });
  });

  // --- All role options present ---

  it("has exactly 3 options when includeOwner is true", async () => {
    const user = userEvent.setup();
    render(<RoleSelect value="member" onChange={vi.fn()} includeOwner />);

    await user.click(screen.getByRole("combobox"));

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
  });

  it("has exactly 2 options when includeOwner is false", async () => {
    const user = userEvent.setup();
    render(<RoleSelect value="member" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
  });
});
