import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentDialog } from "./PaymentDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/hooks", () => ({
  useCustomers: () => ({ list: { data: null } }),
  useTables: () => ({ list: { data: [] } }),
}));
vi.mock("@/features/settings/hooks/useSettings", () => ({
  useTaxRate: () => 0.12,
  useSettings: () => ({ data: null, isLoading: false }),
  useActivePaymentMethods: () => ({
    cash: true,
    card: true,
    e_wallet: true,
    e_bank: false,
  }),
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "cashier" } }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Payment manuscript scope", () => {
  it("dialog shows only Cash/Card/E-Wallet", async () => {
    renderWithQueryClient(
      <PaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        totalAmount={100}
        discountAmount={0}
        vatAmount={12}
        serviceChargeAmount={0}
        subtotal={88}
        onProcessPayment={vi.fn()}
        isProcessing={false}
      />
    );
    // Payment methods are rendered as buttons in a grid
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("E-Wallet")).toBeInTheDocument();
    expect(screen.queryByText("Bank Transfer")).not.toBeInTheDocument();
    expect(screen.queryByText("Gift Card")).not.toBeInTheDocument();
    expect(screen.queryByText("Loyalty Points")).not.toBeInTheDocument();
  });

  it("payment method buttons show only Cash/Card/E-Wallet", async () => {
    renderWithQueryClient(
      <PaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        totalAmount={100}
        discountAmount={0}
        vatAmount={12}
        serviceChargeAmount={0}
        subtotal={88}
        onProcessPayment={vi.fn()}
        isProcessing={false}
      />
    );
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("E-Wallet")).toBeInTheDocument();
    expect(screen.queryByText("Bank Transfer")).not.toBeInTheDocument();
    expect(screen.queryByText("Gift Card")).not.toBeInTheDocument();
  });
});
