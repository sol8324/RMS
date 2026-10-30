import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TableDetailsModal } from "../TableDetailsModal";
import type { Order, Reservation, Table } from "@/lib/types";

const { mockUseTableActiveOrders, mockUseTableSchedule, mockApi } = vi.hoisted(() => ({
  mockUseTableActiveOrders: vi.fn(),
  mockUseTableSchedule: vi.fn(),
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/hooks", () => ({
  useTableActiveOrders: mockUseTableActiveOrders,
  useTableSchedule: mockUseTableSchedule,
}));

vi.mock("@/lib/api/client", () => ({
  default: mockApi,
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
  canViewCustomerInfo = true,
  canManageReservations = false,
  canEditTable = false,
  onEditTable,
}: {
  table?: Table | null;
  canViewOrders?: boolean;
  canViewCustomerInfo?: boolean;
  canManageReservations?: boolean;
  canEditTable?: boolean;
  onEditTable?: (table: Table) => void;
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
        canViewCustomerInfo={canViewCustomerInfo}
        canManageReservations={canManageReservations}
        canEditTable={canEditTable}
        onEditTable={onEditTable}
      />
    </QueryClientProvider>
  );
}

describe("TableDetailsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTableActiveOrders.mockReturnValue(queryState());
    mockUseTableSchedule.mockReturnValue({
      data: {
        table: makeTable(),
        date: "2026-10-27",
        days: 7,
        buffer_minutes: 15,
        next_reservation: null,
        reservations: [],
        slots: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
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

  it("shows the current seated customer and contact details", async () => {
    mockUseTableSchedule.mockReturnValue({
      data: {
        table: makeTable(),
        date: "2026-10-27",
        days: 7,
        buffer_minutes: 15,
        current_session: {
          id: "res-current",
          reservation_number: "RES-001",
          guest_name: "Alice Registered",
          party_size: 2,
          reservation_date: "2026-10-27",
          reservation_time: "18:00",
          status: "seated",
          customer: {
            id: "cust-1",
            name: "Alice Registered",
            phone: "09171234567",
            email: "alice@example.com",
            customer_type: "registered",
          },
          requests: [],
        },
        next_reservation: null,
        upcoming_reservations: [],
        reservations: [],
        slots: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderModal();

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);
    expect(scope.getByText("Alice Registered")).toBeInTheDocument();
    expect(scope.getByText("Regular")).toBeInTheDocument();
    expect(scope.getByText("09171234567")).toBeInTheDocument();
    expect(scope.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows next and upcoming reservations without mixing customers", async () => {
    mockUseTableSchedule.mockReturnValue({
      data: {
        table: makeTable(),
        date: "2026-10-27",
        days: 7,
        buffer_minutes: 15,
        current_session: null,
        next_reservation: {
          id: "res-next",
          reservation_number: "RES-002",
          guest_name: "Bob Guest",
          party_size: 4,
          reservation_date: "2026-10-28",
          reservation_time: "19:00",
          status: "confirmed",
          customer: null,
          requests_count: 1,
          unmet_requests_count: 0,
        },
        upcoming_reservations: [
          {
            id: "res-upcoming",
            reservation_number: "RES-003",
            guest_name: "Carol Guest",
            party_size: 3,
            reservation_date: "2026-10-29",
            reservation_time: "20:00",
            status: "pending",
            customer: null,
            requests: [],
          },
        ],
        reservations: [],
        slots: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderModal();

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);
    expect(scope.getByText("Bob Guest")).toBeInTheDocument();
    expect(scope.getByText("Carol Guest")).toBeInTheDocument();
    expect(scope.getAllByText("Guest").length).toBeGreaterThan(0);
  });

  it("updates a request from the staff alerts when allowed", async () => {
    mockApi.patch.mockResolvedValue({
      data: { success: true, message: "", data: {} },
    });
    mockUseTableSchedule.mockReturnValue({
      data: {
        table: makeTable(),
        date: "2026-10-27",
        days: 7,
        buffer_minutes: 15,
        current_session: {
          id: "res-current",
          reservation_number: "RES-001",
          guest_name: "Alice Registered",
          party_size: 2,
          reservation_date: "2026-10-27",
          reservation_time: "18:00",
          status: "seated",
          customer: {
            id: "cust-1",
            name: "Alice Registered",
            customer_type: "registered",
          },
          requests: [
            {
              id: "req-1",
              category: "dietary",
              label: "Nut allergy",
              status: "pending",
              priority: "high",
              is_matched: false,
            },
          ],
        },
        next_reservation: null,
        upcoming_reservations: [],
        reservations: [],
        slots: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderModal({ canManageReservations: true });

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);
    await userEvent.click(scope.getByRole("button", { name: /Acknowledge/i }));

    expect(mockApi.patch).toHaveBeenCalledWith(
      "/reservations/res-current/requests/req-1",
      { status: "acknowledged" }
    );
  });

  it("hides request actions when the role cannot manage reservations", async () => {
    mockUseTableSchedule.mockReturnValue({
      data: {
        table: makeTable(),
        date: "2026-10-27",
        days: 7,
        buffer_minutes: 15,
        current_session: {
          id: "res-current",
          reservation_number: "RES-001",
          guest_name: "Alice Registered",
          party_size: 2,
          reservation_date: "2026-10-27",
          reservation_time: "18:00",
          status: "seated",
          customer: {
            id: "cust-1",
            name: "Alice Registered",
            customer_type: "registered",
          },
          requests: [
            {
              id: "req-1",
              category: "dietary",
              label: "Nut allergy",
              status: "pending",
              priority: "normal",
              is_matched: null,
            },
          ],
        },
        next_reservation: null,
        upcoming_reservations: [],
        reservations: [],
        slots: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderModal({ canManageReservations: false });

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /Acknowledge/i })
    ).toBeNull();
  });

  it("shows table location descriptions and hides order contact without permission", async () => {
    mockUseTableActiveOrders.mockReturnValue(
      queryState({
        orders: [
          makeOrder({
            customer: {
              id: "cust-2",
              name: "Order Customer",
              phone: "09170009999",
              email: "order@example.com",
              customer_type: "registered",
              loyalty_points: 0,
              total_orders: 0,
              total_spent: 0,
              visit_count: 0,
              is_active: true,
              created_at: "",
              updated_at: "",
            },
            customer_id: "cust-2",
          }),
        ],
      })
    );
    renderModal({
      table: makeTable({ location_description: "Near the kitchen door" }),
      canViewCustomerInfo: false,
    });

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);
    expect(scope.getByText("Near the kitchen door")).toBeInTheDocument();
    expect(scope.getAllByText("Order Customer").length).toBeGreaterThan(0);
    expect(scope.queryByText("09170009999")).toBeNull();
    expect(scope.queryByText("order@example.com")).toBeNull();
  });
});
