/**
 * §16.2 — server-side pagination + search. Shared envelope + a helper for the
 * per-resource `queryXPaged()` functions.
 */
import { api } from "@/lib/api/client";

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PageOpts {
  q?: string;
  page?: number;
  pageSize?: number;
  /** resource-specific: name | code | created | role | status | …; "-" prefix = desc */
  sort?: string;
}

export function clampPage(opts: PageOpts, defaultPageSize = 25) {
  return {
    page: Math.max(opts.page ?? 1, 1),
    pageSize: Math.min(Math.max(opts.pageSize ?? defaultPageSize, 1), 200),
  };
}

/** Hit a `/search` endpoint that already returns `{ items, totalCount, page, pageSize }`. */
export async function fetchPaged<T>(
  path: string,
  opts: PageOpts & Record<string, string | number | undefined>,
  defaultPageSize = 25,
): Promise<PagedResult<T>> {
  const { page, pageSize } = clampPage(opts, defaultPageSize);
  const { q, sort, page: _p, pageSize: _ps, ...rest } = opts;
  return api.get<PagedResult<T>>(path, {
    query: { q: q || undefined, sort: sort || undefined, page, pageSize, ...rest },
  });
}

/** Wrap a plain full-list fetch as a client-side page (supabase fallback path). */
export function clientPage<T>(all: T[], opts: PageOpts, defaultPageSize = 25): PagedResult<T> {
  const { page, pageSize } = clampPage(opts, defaultPageSize);
  return {
    items: all.slice((page - 1) * pageSize, page * pageSize),
    totalCount: all.length,
    page,
    pageSize,
  };
}
