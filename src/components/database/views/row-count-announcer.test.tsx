import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RowCountAnnouncer } from "./row-count-announcer";

describe("RowCountAnnouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a visually hidden live region", () => {
    render(<RowCountAnnouncer filteredCount={10} totalCount={20} />);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toBeDefined();
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.className).toContain("sr-only");
  });

  it("does not announce on initial render", () => {
    render(<RowCountAnnouncer filteredCount={10} totalCount={20} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("");
  });

  it("announces filtered count after debounce when counts change", () => {
    const { rerender } = render(
      <RowCountAnnouncer filteredCount={10} totalCount={20} />,
    );

    rerender(<RowCountAnnouncer filteredCount={5} totalCount={20} />);

    // Before debounce fires
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("");

    // After 300ms debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(liveRegion.textContent).toBe("Showing 5 of 20 rows");
  });

  it("announces unfiltered count when filtered equals total", () => {
    const { rerender } = render(
      <RowCountAnnouncer filteredCount={10} totalCount={20} />,
    );

    rerender(<RowCountAnnouncer filteredCount={20} totalCount={20} />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("Showing 20 rows");
  });

  it("debounces rapid changes and only announces the final value", () => {
    const { rerender } = render(
      <RowCountAnnouncer filteredCount={20} totalCount={20} />,
    );

    // Rapid successive changes (simulating typing in a filter input)
    rerender(<RowCountAnnouncer filteredCount={15} totalCount={20} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender(<RowCountAnnouncer filteredCount={8} totalCount={20} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender(<RowCountAnnouncer filteredCount={3} totalCount={20} />);

    // Only 200ms have passed since the first change — nothing announced yet
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("");

    // After 300ms from the last change, only the final value is announced
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(liveRegion.textContent).toBe("Showing 3 of 20 rows");
  });

  it("announces when totalCount changes", () => {
    const { rerender } = render(
      <RowCountAnnouncer filteredCount={10} totalCount={10} />,
    );

    rerender(<RowCountAnnouncer filteredCount={11} totalCount={11} />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("Showing 11 rows");
  });

  it("announces zero rows when all are filtered out", () => {
    const { rerender } = render(
      <RowCountAnnouncer filteredCount={10} totalCount={10} />,
    );

    rerender(<RowCountAnnouncer filteredCount={0} totalCount={10} />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("Showing 0 of 10 rows");
  });
});
