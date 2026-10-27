"use client";

import { useState } from "react";
import { PageHeader, ConfirmDialog, CardGridSkeleton, ErrorState, EmptyState } from "@/components/shared";
import { useAuth } from "@/providers/AuthProvider";
import { canCreateTable, canEditTable, canArchiveTable, canChangeTableStatus, canView } from "@/lib/utils/permissions";
import {
  TableDetailsModal,
  TableStats,
  TableForm,
} from "@/features/tables";
import { TableGridView } from "@/features/tables/TableGridView";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, LayoutGrid } from "lucide-react";
import { useTables } from "@/lib/hooks";
import type { Table as TableType, TableStatus, TableFormData } from "@/lib/types";
import { formatLabel } from "@/lib/utils";
import { toast } from "sonner";

export default function TablesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archiveTarget, setArchiveTarget] = useState<TableType | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<TableType | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [viewTargetId, setViewTargetId] = useState<string | null>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [statusActionTarget, setStatusActionTarget] = useState<{
    table: TableType;
    status: TableStatus;
  } | null>(null);

  const tables = useTables();
  const allTables = tables.list.data ?? [];
  const viewTarget = allTables.find((table) => table.id === viewTargetId) ?? null;
  const { user } = useAuth();
  const canCreate = canCreateTable(user?.role);
  const canEdit = canEditTable(user?.role);
  const canArchive = canArchiveTable(user?.role);
  const canChangeStatus = canChangeTableStatus(user?.role);

  const visibleTables = showArchived
    ? allTables
    : allTables.filter((t) => t.is_active !== false);

  // Archived tables never masquerade as operational status records: they
  // appear only under "All Status" + "Show archived", never under a status
  // filter.
  const filteredTables =
    statusFilter === "all"
      ? visibleTables
      : visibleTables.filter(
          (t) => t.is_active !== false && t.status === statusFilter
        );

  function handleStatusChange(table: TableType, status: TableStatus) {
    setStatusActionTarget({ table, status });
  }

  function handleStatusConfirm() {
    if (!statusActionTarget) return;
    const { table, status } = statusActionTarget;
    tables.update.mutate(
      { id: table.id, data: { status } as unknown as Partial<TableType> },
      {
        onSuccess: () => toast.success(`Table ${table.number} updated to ${formatLabel(status)}`),
        onError: () => toast.error("Failed to update table status"),
      }
    );
    setStatusActionTarget(null);
  }

  function handleArchiveTable() {
    if (!archiveTarget) return;
    tables.archive.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success(`Table ${archiveTarget.number} archived`);
        setArchiveTarget(null);
      },
      onError: (err) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Failed to archive table";
        toast.error(msg);
        setArchiveTarget(null);
      },
    });
  }

  function handleRestoreTable() {
    if (!restoreTarget) return;
    tables.restore.mutate(restoreTarget.id, {
      onSuccess: () => {
        toast.success(`Table ${restoreTarget.number} restored`);
        setRestoreTarget(null);
      },
      onError: () => toast.error("Failed to restore table"),
    });
  }

  function handleTableSubmit(data: TableFormData) {
    if (editingTable) {
      tables.update.mutate(
        { id: editingTable.id, data },
        {
          onSuccess: () => {
            toast.success("Table updated");
            setShowTableDialog(false);
            setEditingTable(null);
          },
          onError: () => toast.error("Failed to update table"),
        }
      );
    } else {
      tables.create.mutate(data, {
        onSuccess: () => {
          toast.success("Table created");
          setShowTableDialog(false);
        },
        onError: (error) => {
          const message = (error as { response?: { data?: { message?: string } } })
            .response?.data?.message;
          toast.error(message || "Failed to create table");
        },
      });
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Tables"
        description="Manage restaurant tables"
        action={
          canCreate ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingTable(null);
                setShowTableDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Table
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <TableStats tables={visibleTables} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val ?? "all")}
          >
            <SelectTrigger className="w-full sm:w-[160px] min-h-10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="needs_cleaning">Needs Cleaning</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4"
          />
          Show archived
        </label>

        {tables.list.isLoading ? (
          <div role="status" aria-label="Loading tables">
            <CardGridSkeleton
              count={8}
              className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              lines={2}
            />
          </div>
        ) : tables.list.isError ? (
          <ErrorState message="Failed to load tables. Please try again." onRetry={() => tables.list.refetch()} />
        ) : (
          <TableGridView
            tables={filteredTables}
            onStatusChange={canChangeStatus ? handleStatusChange : undefined}
            onView={(t) => setViewTargetId(t.id)}
            onEdit={canEdit ? (t) => {
              setEditingTable(t);
              setShowTableDialog(true);
            } : undefined}
            onArchive={canArchive ? (t) => setArchiveTarget(t) : undefined}
            onRestore={canArchive ? (t) => setRestoreTarget(t) : undefined}
            canEdit={canEdit}
            canArchive={canArchive}
            canChangeStatus={canChangeStatus}
          />
        )}

        {filteredTables.length === 0 && !tables.list.isLoading && !tables.list.isError && (
          <EmptyState
            title={statusFilter !== "all" ? `No tables with status "${formatLabel(statusFilter)}"` : showArchived ? "No tables found" : "No tables match these filters"}
            description={
              statusFilter !== "all" || showArchived
                ? "Try adjusting your filters."
                : "Add your first table to get started."
            }
            icon={<LayoutGrid className="h-8 w-8" />}
          />
        )}

        <ConfirmDialog
          open={!!statusActionTarget}
          onOpenChange={(open) => !open && setStatusActionTarget(null)}
          title="Change Table Status"
          description={statusActionTarget ? `Change table ${statusActionTarget.table.number} to "${formatLabel(statusActionTarget.status)}"?` : ""}
          confirmText="Confirm"
          onConfirm={handleStatusConfirm}
          isLoading={tables.update.isPending}
        />

        <ConfirmDialog
          open={!!archiveTarget}
          onOpenChange={(open) => !open && setArchiveTarget(null)}
          title="Archive Table"
          description={`Archive table ${archiveTarget?.number}? It will be hidden from active lists and cannot be assigned to new orders until restored.`}
          confirmText="Archive"
          variant="destructive"
          onConfirm={handleArchiveTable}
          isLoading={tables.archive.isPending}
        />

        <ConfirmDialog
          open={!!restoreTarget}
          onOpenChange={(open) => !open && setRestoreTarget(null)}
          title="Restore Table"
          description={`Restore table ${restoreTarget?.number}? It will reappear in active lists.`}
          confirmText="Restore"
          onConfirm={handleRestoreTable}
          isLoading={tables.restore.isPending}
        />

        <Dialog
          open={showTableDialog}
          onOpenChange={(open) => {
            setShowTableDialog(open);
            if (!open) setEditingTable(null);
          }}
        >
          <DialogContent className="sm:max-w-md w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-hidden flex flex-col p-0 gap-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>
                {editingTable ? "Edit Table" : "New Table"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4">
              <TableForm
                initialData={editingTable ?? undefined}
                onSubmit={handleTableSubmit}
                isLoading={tables.create.isPending || tables.update.isPending}
                submitLabel={editingTable ? "Update" : "Create"}
              />
            </div>
          </DialogContent>
        </Dialog>

        <TableDetailsModal
          table={viewTarget}
          open={!!viewTarget}
          onOpenChange={(open) => !open && setViewTargetId(null)}
          canViewOrders={canView(user?.role, "orders")}
        />
      </div>
    </div>
  );
}


