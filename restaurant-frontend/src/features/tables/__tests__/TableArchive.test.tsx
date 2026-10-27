import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableGridView } from "../TableGridView";
import { countActiveByStatus } from "../TableStats";
import type { Table } from "@/lib/types";

function makeTable(partial: Partial<Table> & { id: string; number: string }): Table {
  return {
    capacity: 4,
    status: "available",
    is_wheelchair_accessible: false,
    is_active: true,
    pos_x: 0,
    pos_y: 0,
    width: 80,
    height: 80,
    created_at: "",
    updated_at: "",
    ...partial,
  } as Table;
}

const T1 = makeTable({ id: "t-1", number: "1", status: "available", is_active: true });
const TT99 = makeTable({ id: "t-99", number: "T99", status: "available", is_active: false });

describe("countActiveByStatus", () => {
  it("excludes archived tables from operational counters", () => {
    const { total, counts } = countActiveByStatus([T1, TT99]);
    expect(total).toBe(1);
    expect(counts.available).toBe(1);
  });

  it("is unaffected by showing archived rows", () => {
    const withArchived = countActiveByStatus([T1, TT99]);
    const withoutArchived = countActiveByStatus([T1]);
    expect(withArchived).toEqual(withoutArchived);
  });

  it("counts a restored table again and drops it on re-archive", () => {
    const restored = countActiveByStatus([T1, { ...TT99, is_active: true }]);
    expect(restored.total).toBe(2);
    expect(restored.counts.available).toBe(2);
    const reArchived = countActiveByStatus([T1, { ...TT99, is_active: false }]);
    expect(reArchived.total).toBe(1);
  });
});

describe("TableGridView details interaction", () => {
  it("opens details from the card body", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    render(<TableGridView tables={[T1]} onView={onView} />);

    await user.click(
      screen.getByRole("button", { name: "View table 1 details" })
    );

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(T1);
  });

  it("does not double-open when View is chosen from the actions menu", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    render(<TableGridView tables={[T1]} onView={onView} />);

    await user.click(screen.getByRole("button", { name: /Actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: "View" }));

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(T1);
  });
});

describe("TableGridView ordering", () => {
  it("renders table cards in natural number order", () => {
    const t2 = makeTable({ id: "t-2", number: "2" });
    const t10 = makeTable({ id: "t-10", number: "10" });

    render(<TableGridView tables={[t10, T1, t2]} onView={vi.fn()} />);

    const labels = screen
      .getAllByRole("button", { name: /View table .* details/i })
      .map((button) => button.getAttribute("aria-label"));

    expect(labels).toEqual([
      "View table 1 details",
      "View table 2 details",
      "View table 10 details",
    ]);
  });
});

describe("TableGridView archived presentation", () => {
  it("shows an Archived badge instead of the operational status", () => {
    render(<TableGridView tables={[T1, TT99]} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
    // Only the active table keeps its operational status badge (Available).
    // The archived table shows "Archived" badge with a title showing underlying status.
    const availableBadges = screen.getAllByText("Available");
    expect(availableBadges).toHaveLength(1);
  });

  it("hides operational actions for archived tables, keeps Restore", async () => {
    const user = userEvent.setup();
    render(<TableGridView tables={[T1, TT99]} onRestore={vi.fn()} />);
    const triggers = screen.getAllByRole("button", { name: /Actions/i });
    // Cards sort numerically: T1 first, TT99 second.
    await user.click(triggers[1]);
    expect(await screen.findByRole("menuitem", { name: /Restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Mark Needs Cleaning/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Mark Maintenance/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Mark Available/i })).toBeNull();
  });
});
