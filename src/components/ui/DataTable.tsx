"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface DataTableColumn<T> {
  header: string;
  align?: "left" | "center" | "right";
  render: (row: T) => ReactNode;
}

export interface DataTablePagination {
  page: number;
  pageCount: number;
  totalLabel: string;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Prefer this over onRowClick — prefetches the route on hover. */
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  pagination?: DataTablePagination;
  emptyMessage?: string;
  /**
   * Opt-in stacked-card mobile layout (resolves the "Confirm before building"
   * decision in React-Conversion-Guide.md §7). When provided, the table is
   * hidden below `sm` and this renders a card per row instead — used on the
   * highest-traffic, most column-heavy screens (Bookings, Patients, Audit
   * Logs). When omitted, behavior is unchanged: horizontal-scroll table at
   * all widths, the default for every other screen.
   */
  renderMobileCard?: (row: T) => ReactNode;
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * One table implementation for every list screen (bookings, patients, audit
 * logs, reports, etc. — per React-Conversion-Guide.md §5). Responsive
 * strategy per §7, decided: horizontal-scroll by default everywhere;
 * `renderMobileCard` opts a screen into a stacked-card layout below `sm`
 * instead, for the highest-traffic, most column-heavy screens.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  pagination,
  emptyMessage = "No records found.",
  renderMobileCard,
}: DataTableProps<T>) {
  const router = useRouter();
  const interactive = Boolean(rowHref || onRowClick);

  function activateRow(row: T) {
    if (rowHref) {
      router.push(rowHref(row));
      return;
    }
    onRowClick?.(row);
  }

  function prefetchRow(row: T) {
    if (rowHref) router.prefetch(rowHref(row));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
      {renderMobileCard && (
        <div className="divide-y divide-outline-variant/30 sm:hidden">
          {rows.length === 0 ? (
            <p className="px-lg py-xl text-center text-body-md text-on-surface-variant">{emptyMessage}</p>
          ) : (
            rows.map((row) => (
              <div
                key={rowKey(row)}
                onClick={interactive ? () => activateRow(row) : undefined}
                onMouseEnter={interactive ? () => prefetchRow(row) : undefined}
                onFocus={interactive ? () => prefetchRow(row) : undefined}
                className={cn("p-lg", interactive && "cursor-pointer active:bg-surface-container-low")}
              >
                {renderMobileCard(row)}
              </div>
            ))
          )}
        </div>
      )}
      <div className={cn("overflow-x-auto", renderMobileCard && "hidden sm:block")}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              {columns.map((column) => (
                <th
                  key={column.header}
                  className={cn(
                    "px-lg py-md text-label-md text-on-surface-variant",
                    ALIGN_CLASS[column.align ?? "left"],
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-lg py-xl text-center text-body-md text-on-surface-variant">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={interactive ? () => activateRow(row) : undefined}
                  onMouseEnter={interactive ? () => prefetchRow(row) : undefined}
                  onFocus={interactive ? () => prefetchRow(row) : undefined}
                  className={cn(
                    "transition-colors hover:bg-surface-container-lowest",
                    interactive && "cursor-pointer",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={cn("px-lg py-md", ALIGN_CLASS[column.align ?? "left"])}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="flex flex-col gap-sm border-t border-outline-variant px-lg py-md sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label-sm text-on-surface-variant">{pagination.totalLabel}</p>
          <div className="flex flex-wrap items-center justify-center gap-sm sm:justify-end">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="rounded-lg border border-outline-variant p-2 transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              <Icon name="chevron_left" />
            </button>
            <span className="px-sm text-label-md text-on-surface-variant sm:hidden">
              {pagination.page} / {pagination.pageCount}
            </span>
            <div className="hidden gap-sm sm:flex">
              {Array.from({ length: pagination.pageCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => pagination.onPageChange(p)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-label-md transition-colors",
                    p === pagination.page
                      ? "bg-primary text-on-primary"
                      : "hover:bg-surface-container",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={pagination.page >= pagination.pageCount}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="rounded-lg border border-outline-variant p-2 transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
