import { describe, expect, it } from "vitest";
import {
  customerDisplayName,
  tableDisplayName,
  tableSelectOptions,
} from "./orderDisplay";
import type { Order, Customer, Table } from "@/lib/types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    order_number: "ORD-1",
    order_type: "dine_in",
    status: "served",
    subtotal: 100,
    tax_amount: 10,
    discount_amount: 0,
    service_charge: 0,
    total_amount: 100,
    items: [],
    payments: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("orderDisplay helpers (never show UUID)", () => {
  it("shows customer name, never the id", () => {
    const order = makeOrder({
      customer_id: "1ee5b4e7-uuid",
      customer: { id: "1ee5b4e7-uuid", name: "Juan Dela Cruz" } as Customer,
    });
    expect(customerDisplayName(order)).toBe("Juan Dela Cruz");
    expect(customerDisplayName(order)).not.toContain("1ee5b4e7");
  });

  it("falls back to Walk-in / Guest when no customer", () => {
    expect(customerDisplayName(makeOrder({ customer_id: "1ee5b4e7-uuid" }))).toBe(
      "Walk-in / Guest"
    );
  });

  it("shows table number, never the id", () => {
    const order = makeOrder({
      table_id: "tbl-uuid",
      table: { id: "tbl-uuid", name: "Table 01", number: "01", capacity: 4, status: "occupied", is_wheelchair_accessible: false, pos_x: 0, pos_y: 0, width: 0, height: 0, created_at: "", updated_at: "" },
    });
    expect(tableDisplayName(order)).toBe("Table 01");
    expect(tableDisplayName(order)).not.toContain("tbl-uuid");
  });

  it("returns empty table label for takeaway", () => {
    expect(tableDisplayName(makeOrder({ order_type: "takeaway" }))).toBe("");
  });

  it("keeps the table id as the select value but uses a readable label", () => {
    const table: Table = {
      id: "00000000-0000-0000-0000-270e33da79c5",
      number: "10",
      capacity: 4,
      status: "occupied",
      is_wheelchair_accessible: false,
      pos_x: 0,
      pos_y: 0,
      width: 0,
      height: 0,
      created_at: "",
      updated_at: "",
    };

    expect(tableSelectOptions([table])).toEqual([
      {
        value: "00000000-0000-0000-0000-270e33da79c5",
        label: "Table 10 (4 seats)",
      },
    ]);
  });
});
