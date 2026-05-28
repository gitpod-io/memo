import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { RowHeightToggle } from "./database-view-helpers";

describe("RowHeightToggle", () => {
  it("renders a trigger button with aria-label for accessibility", () => {
    render(<RowHeightToggle value="default" onChange={vi.fn()} />);

    const trigger = screen.getByTestId("row-height-toggle");
    expect(trigger).toHaveAttribute("aria-label", "Row height");
  });
});
