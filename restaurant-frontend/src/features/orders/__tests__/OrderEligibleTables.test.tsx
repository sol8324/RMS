import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PosOrderScreen } from "../PosOrderScreen";
import type { ReactNode } from "react";

vi.mock("@/lib/hooks", () => ({
  useMenuCategories: () => ({ list: { data: [], isLoading: false } }),
  useMenuItems: () => ({
    list: { data: { data: { data: [] } }, isLoading: false },
  }),
  useCustomers: () => ({
    list: { data: { data: { data: [] } }, isLoading: false },
  }),
  useTables: () => ({ list: { data: [], isLoading: false } }),
  useOrderEligibleTables: () => ({
    data: [
      { id: "aaaaaaaa-1111-4111-8111-111111111111", number: "1", capacity: 4, status: "available", seating: null },
      {
        id: "bbbbbbbb-2222-4222-8222-222222222222",
        number: "2",
        capacity: 2,
        status: "occupied",
        seating: { reservation_number: "RES-99", guest_name: "Ana" },
      },
      // Stale entries the client filter must still hide.
      { id: "cccccccc-3333-4333-8333-333333333333", number: "3", capacity: 4, status: "occupied", seating: null },
      { id: "dddddddd-4444-4444-8444-444444444444", number: "4", capacity: 4, status: "needs_cleaning", seating: null },
      { id: "eeeeeeee-5555-4555-8555-555555555555", number: "5", capacity: 4, status: "maintenance", seating: null },
    ],
    isLoading: false,
  }),
  useOrders: () => ({
    create: { mutateAsync: vi.fn(), isPending: false },
    updateStatus: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function openTableDropdown(user: ReturnType<typeof userEvent.setup>) {
  const triggers = screen.getAllByRole("combobox");
  // Customer select renders first; the table select carries the table placeholder.
  const tableTrigger = triggers.find((t) =>
    /Select table|No table|Table \d/.test(t.textContent ?? "")
  );
  expect(tableTrigger).toBeTruthy();
  await user.click(tableTrigger!);
}

describe("PosOrderScreen order-eligible tables", () => {
  it("shows available and seated-eligible tables, hides the rest, never shows UUIDs", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<PosOrderScreen />);

    await openTableDropdown(user);

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    const names = options.map((o) => o.textContent);

    expect(names.some((n) => /Table 1 .* 4 seats/.test(n ?? ""))).toBe(true);
    const seated = names.find((n) => /Seated Reservation/.test(n ?? ""));
    expect(seated).toMatch(/^Table 2 /);
    // Occupied without seating, needs_cleaning, and maintenance stay hidden.
    expect(names.some((n) => /^Table 3 /.test(n ?? ""))).toBe(false);
    expect(names.some((n) => /^Table 4 /.test(n ?? ""))).toBe(false);
    expect(names.some((n) => /^Table 5 /.test(n ?? ""))).toBe(false);
    expect(container.textContent).not.toMatch(
      /aaaaaaaa-1111|bbbbbbbb-2222/
    );
  });
});
