import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReservationForm } from "../ReservationForm";

const baseProps = {
  initialData: { end_time: "19:30", party_size: 4 } as never,
};

const { mockTables } = vi.hoisted(() => ({
  mockTables: {
    current: [
      { id: "t-1", number: "1", capacity: 4, status: "available", is_active: true },
      { id: "t-5", number: "5", capacity: 4, status: "available", is_active: true },
    ] as Array<{ id: string; number: string; capacity: number; status: string; is_active: boolean }>,
  },
}));

vi.mock("@/lib/hooks", () => ({
  useCustomers: () => ({
    list: { data: { data: { data: [] } }, isLoading: false },
  }),
  useTables: () => ({
    list: { data: mockTables.current, isLoading: false },
  }),
  useReservations: () => ({
    availableTables: {
      isSuccess: true,
      data: mockTables.current.filter(
        (t) => t.status === "available" && t.is_active
      ),
    },
  }),
  useReservationPolicy: () => ({ data: null }),
  useCheckAvailability: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTimeSlots: () => ({ data: null }),
}));

function tableCombobox() {
  // Reservation-for trigger renders first; the table trigger second.
  // (Selected values render as raw ids under Base UI — assertions below
  // target submitted state, never trigger cosmetics.)
  const triggers = screen.getAllByRole("combobox");
  expect(triggers.length).toBeGreaterThan(1);
  return triggers[1];
}

async function fillGuest(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Guest Name/), "Test Guest");
  await user.type(screen.getByLabelText(/Phone/), "09170000001");
}

describe("ReservationForm table availability", () => {
  beforeEach(() => {
    mockTables.current = [
      { id: "t-1", number: "1", capacity: 4, status: "available", is_active: true },
      { id: "t-5", number: "5", capacity: 4, status: "available", is_active: true },
    ];
  });

  it("excludes needs_cleaning, maintenance and archived tables and never promises auto-assign", async () => {
    mockTables.current = [
      { id: "t-1", number: "1", capacity: 4, status: "available", is_active: true },
      { id: "t-2", number: "2", capacity: 4, status: "needs_cleaning", is_active: true },
      { id: "t-3", number: "3", capacity: 4, status: "maintenance", is_active: true },
      { id: "t-4", number: "4", capacity: 4, status: "available", is_active: false },
    ];
    const user = userEvent.setup();
    render(<ReservationForm onSubmit={vi.fn()} {...baseProps} />);

    const tableTrigger = tableCombobox();
    expect(tableTrigger.textContent).not.toMatch(/auto-assign/i);
    await user.click(tableTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Table 1/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "No table" })).toBeInTheDocument();
    expect(screen.queryByText(/auto-assign/i)).toBeNull();
    expect(screen.getByRole("option", { name: /Table 2/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("option", { name: /Table 3/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.queryByRole("option", { name: /Table 4/ })).toBeNull();
  });

  it("clears an invalidated table, shows a conflict message, and blocks submit until reconfirmed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<ReservationForm onSubmit={onSubmit} {...baseProps} />);
    await fillGuest(user);

    // A. User selects 1 — submitted state carries the table id.
    await user.click(tableCombobox());
    await user.click(await screen.findByRole("option", { name: /Table 1/ }));
    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].table_id).toBe("t-1");
    expect(
      screen.queryByText(/no longer available for this time/)
    ).toBeNull();
    onSubmit.mockClear();

    // C. Availability refresh removes table "1" (e.g. overlapping reservation).
    mockTables.current = [
      { id: "t-5", number: "5", capacity: 4, status: "available", is_active: true },
    ];
    rerender(<ReservationForm onSubmit={onSubmit} {...baseProps} />);

    // D + E. Selection cleared, human-readable conflict message, no UUID.
    const conflict = await screen.findByText(
      /Table 1 . Table \(cap: 4\) is no longer available for this time/
    );
    expect(conflict.textContent).not.toMatch(/[0-9a-f]{8}-/);
    expect(document.body.textContent).not.toMatch(/t-1/);

    // F. Submit blocked until reconfirmation.
    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    expect(onSubmit).not.toHaveBeenCalled();

    // Reconfirm with No table → submit allowed, table_id omitted.
    await user.click(tableCombobox());
    await user.click(await screen.findByRole("option", { name: "No table" }));
    await waitFor(() => {
      expect(
        screen.queryByText(/no longer available for this time/)
      ).toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].table_id).toBeUndefined();
  });

  it("allows reconfirmation with another valid table", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<ReservationForm onSubmit={onSubmit} {...baseProps} />);
    await fillGuest(user);

    await user.click(tableCombobox());
    await user.click(await screen.findByRole("option", { name: /Table 1/ }));
    // Selection confirmed via submitted state.
    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].table_id).toBe("t-1");
    onSubmit.mockClear();

    mockTables.current = [
      { id: "t-5", number: "5", capacity: 4, status: "available", is_active: true },
    ];
    rerender(<ReservationForm onSubmit={onSubmit} {...baseProps} />);
    await screen.findByText(/Table 1 . Table \(cap: 4\) is no longer available for this time/);

    await user.click(tableCombobox());
    await user.click(await screen.findByRole("option", { name: /Table 5/ }));
    await waitFor(() => {
      expect(
        screen.queryByText(/no longer available for this time/)
      ).toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].table_id).toBe("t-5");
  });

  it("lets an intentional No table choice submit without warnings", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReservationForm onSubmit={onSubmit} {...baseProps} />);
    await fillGuest(user);

    expect(
      screen.queryByText(/no longer available for this time/)
    ).toBeNull();
    await user.click(tableCombobox());
    await user.click(await screen.findByRole("option", { name: "No table" }));
    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].table_id).toBeUndefined();
  });

  it("shows no warning while the selected table stays available", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReservationForm onSubmit={onSubmit} {...baseProps} />);
    await fillGuest(user);

    await user.click(tableCombobox());
    await user.click(await screen.findByRole("option", { name: /Table 1/ }));
    expect(
      screen.queryByText(/no longer available for this time/)
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: /Save Reservation/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].table_id).toBe("t-1");
  });
});
