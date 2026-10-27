import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TableDetailsModal } from "../TableDetailsModal";
import type { Order, Table } from "@/lib/types";

const { mockUseTableActiveOrders } = vi.hoisted(() => ({
  mockUseTableActiveOrders: vi.fn(),
}));

vi.mock("@/lib/hooks", () => ({
  useTableActiveOrders: mockUseTableActiveOrders,
}));

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: "table-uuid",
    number: "TBL-003",
    capacity: 4,
    status: "occupied",
    shape: "rectangle",
    is_active: true,
    is_wheelchair_accessible: true,
    floor_plan: { id: "plan-uuid", name: "Main Floor" },
    pos_x: 0,
    pos_y: 0,
    width: 80,
    height: 80,
    created_at: "",
    updated_at: "",
    ...overrides,
  } as Table;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-uuid",
    order_number: "ORD-1001",
    order_type: "dine_in",
    status: "preparing",
    payment_status: "unpaid",
    subtotal: 200,
    tax_amount: 12,
    discount_amount: 0,
    service_charge: 0,
    total_amount: 212,
    notes: "Serve together",
    items: [
      {
        id: "item-uuid",
        menu_item_id: "menu-uuid",
        name: "Rice Bowl",
        quantity: 2,
        unit_price: 100,
        total_amount: 200,
        status: "preparing",
        notes: "No chili",
        modifiers: [
          {
            id: "modifier-uuid",
            modifier_option_id: "option-uuid",
            name: "Extra rice",
            price: 25,
          },
        ],
      },
    ],
    payments: [],
    placed_at: "2026-10-27T10:00:00.000Z",
    created_at: "2026-10-27T10:00:00.000Z",
    updated_at: "2026-10-27T10:05:00.000Z",
    ...overrides,
  } as Order;
}

function queryState({
  orders = [] as Order[],
  isLoading = false,
  isError = false,
  isFetching = false,
}: {
  orders?: Order[];
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
} = {}) {
  return {
    data: isLoading
      ? undefined
      : {
          success: true,
          message: "",
          data: {
            data: orders,
            meta: {
              current_page: 1,
              last_page: 1,
              per_page: 50,
              total: orders.length,
            },
          },
        },
    isLoading,
    isError,
    isFetching,
    dataUpdatedAt: new Date("2026-10-27T10:06:00.000Z").getTime(),
    refetch: vi.fn(),
  };
}

function renderModal({
  table = makeTable(),
  canViewOrders = true,
}: {
  table?: Table | null;
  canViewOrders?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TableDetailsModal
        table={table}
        open
        onOpenChange={vi.fn()}
        canViewOrders={canViewOrders}
      />
    </QueryClientProvider>
  );
}

describe("TableDetailsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTableActiveOrders.mockReturnValue(queryState());
  });

  it("shows table information and the empty active-order state", async () => {
    renderModal();

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);

    expect(scope.getByText("Table TBL-003")).toBeInTheDocument();
    expect(scope.getAllByText("Main Floor").length).toBeGreaterThan(0);
    expect(scope.getByText("4 seats")).toBeInTheDocument();
    expect(scope.getByText("Rectangle")).toBeInTheDocument();
    expect(scope.getByText("Accessible")).toBeInTheDocument();
    expect(scope.getByText("No active orders for this table.")).toBeInTheDocument();
    expect(scope.getByText("Live updates")).toBeInTheDocument();
  });

  it("renders active order items without exposing UUIDs", async () => {
    mockUseTableActiveOrders.mockReturnValue(queryState({ orders: [makeOrder()] }));
    renderModal();

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);

    expect(scope.getByText("Order ORD-1001")).toBeInTheDocument();
    expect(scope.getByText("Rice Bowl")).toBeInTheDocument();
    expect(scope.getByText("2x")).toBeInTheDocument();
    expect(scope.getByText("Extra rice")).toBeInTheDocument();
    expect(scope.getByText("No chili")).toBeInTheDocument();
    expect(scope.getByText(/Serve together/)).toBeInTheDocument();
    expect(scope.getByRole("link", { name: /View order/i })).toHaveAttribute(
      "href",
      "/orders/order-uuid"
    );

    expect(scope.queryByText("table-uuid")).toBeNull();
    expect(scope.queryByText("order-uuid")).toBeNull();
  });

  it("hides order links when the role cannot view orders", async () => {
    mockUseTableActiveOrders.mockReturnValue(queryState({ orders: [makeOrder()] }));
    renderModal({ canViewOrders: false });

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("link", { name: /View order/i })
    ).toBeNull();
  });

  it("shows a loading state while the first request is pending", async () => {
    mockUseTableActiveOrders.mockReturnValue(queryState({ isLoading: true }));
    renderModal();

    expect(
      await screen.findByRole("status", { name: "Loading active orders" })
    ).toBeInTheDocument();
  });

  it("shows an actionable error when active orders cannot load", async () => {
    const refetch = vi.fn();
    mockUseTableActiveOrders.mockReturnValue({
      ...queryState({ isError: true }),
      refetch,
    });
    renderModal();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Could not load active orders")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: /Try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps showing the last data when a live refresh fails", async () => {
    mockUseTableActiveOrders.mockReturnValue(
      queryState({ orders: [makeOrder()], isError: true })
    );
    renderModal();

    expect(
      await screen.findByText(/Live updates are temporarily unavailable/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Order ORD-1001")).toBeInTheDocument();
  });
});
