import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TablesPage from "./page";
import type { Table } from "@/lib/types";

const { mockUseAuth, mockUseTables, mockUseTableActiveOrders } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseTables: vi.fn(),
  mockUseTableActiveOrders: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/lib/hooks", () => ({
  useTables: mockUseTables,
  useTableActiveOrders: mockUseTableActiveOrders,
}));

function makeTable(): Table {
  return {
    id: "tbl-003",
    number: "TBL-003",
    capacity: 6,
    status: "available",
    shape: "rectangle",
    is_active: true,
    is_wheelchair_accessible: false,
    pos_x: 0,
    pos_y: 0,
    width: 80,
    height: 80,
    created_at: "",
    updated_at: "",
  } as Table;
}

function mockTablesState() {
  mockUseAuth.mockReturnValue({
    user: { id: "u", name: "Admin", email: "admin@x.com", role: "admin" },
  });
  mockUseTables.mockReturnValue({
    list: { data: [makeTable()], isLoading: false, isError: false, refetch: vi.fn() },
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: vi.fn(), isPending: false },
    archive: { mutate: vi.fn(), isPending: false },
    restore: { mutate: vi.fn(), isPending: false },
  });
  mockUseTableActiveOrders.mockReturnValue({
    data: {
      success: true,
      message: "",
      data: {
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 },
      },
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TablesPage />
    </QueryClientProvider>
  );
}

describe("TablesPage view dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTablesState();
  });

  it("renders the stored table number as-is, never TTBL-003", () => {
    renderPage();
    expect(screen.getAllByText("TBL-003").length).toBeGreaterThan(0);
    expect(screen.queryByText("TTBL-003")).toBeNull();
  });

  it("opens table details from the table card body", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "View table TBL-003 details" })
    );

    const dialog = await screen.findByRole("dialog");
    const scope = within(dialog);

    expect(scope.getByText("Table TBL-003")).toBeInTheDocument();
    expect(scope.getByText("6 seats")).toBeInTheDocument();
    expect(scope.getByText("Rectangle")).toBeInTheDocument();
    expect(scope.getByText("Standard")).toBeInTheDocument();
    expect(scope.getByText("No active orders for this table.")).toBeInTheDocument();

    expect(scope.queryByText("Section")).toBeNull();
    expect(scope.queryByText("Zone")).toBeNull();
    expect(scope.queryByText("TTBL-003")).toBeNull();
    expect(screen.queryByText("TTBL-003")).toBeNull();
  });

  it("still opens table details from the actions dropdown", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: "View" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
