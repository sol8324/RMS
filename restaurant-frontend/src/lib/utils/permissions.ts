"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  CASHIER: "cashier",
  WAITER: "waiter",
  KITCHEN_STAFF: "kitchen_staff",
  INVENTORY_STAFF: "inventory_staff",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  inventory_staff: "Inventory Staff",
  cashier: "Cashier",
  waiter: "Waiter / Server",
  kitchen_staff: "Kitchen Staff",
};

export const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  inventory_staff: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  cashier: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  waiter: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  kitchen_staff: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export type PermissionLevel = "none" | "view" | "edit";

export interface RolePermissions {
  dashboard: PermissionLevel;
  customers: PermissionLevel;
  tables: PermissionLevel;
  reservations: PermissionLevel;
  orders: PermissionLevel;
  kitchen: PermissionLevel;
  pos: PermissionLevel;
  inventory: PermissionLevel;
  menu: PermissionLevel;
  staff: PermissionLevel;
  users: PermissionLevel;
  reports: PermissionLevel;
  settings: PermissionLevel;
}

export const PERMISSION_MATRIX: Record<string, RolePermissions> = {
  admin: {
    dashboard: "edit",
    customers: "edit",
    tables: "edit",
    reservations: "edit",
    orders: "edit",
    kitchen: "edit",
    pos: "edit",
    inventory: "edit",
    menu: "edit",
    staff: "edit",
    users: "edit",
    reports: "edit",
    settings: "edit",
  },
  manager: {
    dashboard: "view",
    // Backend customer routes grant role:admin,manager full CRUD/archive.
    customers: "edit",
    // Backend table mutation routes are role:admin,manager.
    tables: "edit",
    // Backend reservation create/update/status routes are role:admin,manager.
    reservations: "edit",
    orders: "edit",
    kitchen: "view",
    pos: "view",
    inventory: "edit",
    menu: "edit",
    // Backend staff routes (update / schedule / leave) allow role:admin,manager.
    // User account creation stays admin-only via /admin/users.
    staff: "edit",
    users: "none",
    reports: "view",
    settings: "view",
  },
  cashier: {
    dashboard: "view",
    customers: "view",
    tables: "view",
    reservations: "none",
    orders: "view",
    kitchen: "none",
    pos: "view",
    inventory: "none",
    menu: "view",
    staff: "none",
    users: "none",
    reports: "none",
    settings: "none",
  },
  waiter: {
    dashboard: "view",
    customers: "view",
    tables: "view",
    reservations: "view",
    orders: "edit",
    kitchen: "view",
    pos: "edit",
    inventory: "none",
    menu: "view",
    staff: "none",
    users: "none",
    reports: "none",
    settings: "none",
  },
  kitchen_staff: {
    dashboard: "view",
    customers: "none",
    tables: "none",
    reservations: "none",
    orders: "view",
    kitchen: "view",
    pos: "none",
    inventory: "view",
    menu: "view",
    staff: "none",
    users: "none",
    reports: "none",
    settings: "none",
  },
  inventory_staff: {
    dashboard: "view",
    customers: "none",
    tables: "none",
    reservations: "none",
    orders: "none",
    kitchen: "none",
    pos: "none",
    inventory: "edit",
    menu: "none",
    staff: "none",
    users: "none",
    reports: "none",
    settings: "none",
  },
};

export const SIDEBAR_ROLES: Record<string, string[]> = {
  attendance: ["manager", "waiter", "cashier", "kitchen_staff", "inventory_staff"],
  dashboard: ["admin", "manager", "waiter", "cashier", "kitchen_staff", "inventory_staff"],
  customers: ["admin", "manager", "waiter", "cashier"],
  tables: ["admin", "manager", "waiter"],
  reservations: ["admin", "manager", "waiter"],
  orders: ["admin", "manager", "waiter", "cashier", "kitchen_staff"],
  kitchen: ["admin", "manager", "kitchen_staff"],
  pos: ["admin", "manager", "cashier", "waiter"],
  inventory: ["admin", "manager", "inventory_staff"],
  menu: ["admin", "manager", "cashier", "waiter", "kitchen_staff"],
  staff: ["admin", "manager"],
  reports: ["admin", "manager"],
  settings: ["admin", "manager"],
};

export function getRolePermissions(role: string | undefined): RolePermissions {
  return PERMISSION_MATRIX[role ?? ""] ?? PERMISSION_MATRIX.cashier;
}

export function canView(role: string | undefined, page: keyof RolePermissions): boolean {
  const permissions = getRolePermissions(role);
  const value = permissions[page];
  if (typeof value === "boolean") return value;
  return value !== "none";
}

export function canEdit(role: string | undefined, page: keyof RolePermissions): boolean {
  const permissions = getRolePermissions(role);
  const value = permissions[page];
  if (typeof value === "boolean") return value;
  return value === "edit";
}

export function useRolePermissions(): RolePermissions {
  const { user } = useAuth();
  const role = user?.role ?? "user";
  return useMemo(() => getRolePermissions(role), [role]);
}

export function useCanView(): (page: keyof RolePermissions) => boolean {
  const permissions = useRolePermissions();
  return (page) => Boolean(permissions[page]);
}

export function useCanEdit(): (page: keyof RolePermissions) => boolean {
  const { user } = useAuth();
  const role = user?.role ?? "user";
  return (page) => canEdit(role, page);
}

export function canAccessRevenueReport(role?: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canArchiveOrders(role?: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

// Mirrors backend routes/api/tables.php:
// POST /tables + PATCH status = admin,manager,waiter
// PUT /{id} + archive/restore + merge/split = admin,manager
export function canCreateTable(role?: string): boolean {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.MANAGER ||
    role === ROLES.WAITER
  );
}

export function canEditTable(role?: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canArchiveTable(role?: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canChangeTableStatus(role?: string): boolean {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.MANAGER ||
    role === ROLES.WAITER
  );
}

// Mirrors the backend serve gate (OrderController::updateStatus):
// only admin/manager/waiter may mark a ready order as served.
export function canServeOrder(role?: string): boolean {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.MANAGER ||
    role === ROLES.WAITER
  );
}

// Mirrors the backend confirm gate (OrderController::updateStatus):
// only admin/manager/waiter/cashier may move an order to confirmed.
export function canConfirmOrder(role?: string): boolean {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.MANAGER ||
    role === ROLES.WAITER ||
    role === ROLES.CASHIER
  );
}

// Recipe management is restricted to Admin / Manager only (inventory_staff may
// manage ingredients but not recipes, per the restaurant process).
export function canManageRecipes(role: string | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

// Ingredient catalog + direct stock adjustment are Admin / Manager only.
// Inventory staff may VIEW ingredients and use replenishment, but direct
// POST/PUT/DELETE /inventory/ingredients and POST /inventory/stock/outward|
// adjust|transfer return 403 for inventory_staff (backend routes/api/inventory.php).
export function canManageIngredients(role: string | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

// Recording a new stock delivery (POST /inventory/stock/inward) is allowed
// for Admin / Manager / Inventory Staff (manuscript US-11).
export function canRecordDelivery(role: string | undefined): boolean {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.MANAGER ||
    role === ROLES.INVENTORY_STAFF
  );
}

// Purchase-order action gating. Frontend is UX-only; the backend remains the
// authoritative enforcer. These mirror the backend authorization rules.
export function canConfirmPurchaseOrder(role: string | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canCancelPurchaseOrder(
  role: string | undefined,
  isCreator: boolean
): boolean {
  return (role === ROLES.ADMIN || role === ROLES.MANAGER) || isCreator;
}

export function canReceivePurchaseOrder(
  role: string | undefined,
  isCreator: boolean
): boolean {
  return !isCreator;
}

export function getRoleLabel(role?: string): string {
  if (!role) return "";
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}


