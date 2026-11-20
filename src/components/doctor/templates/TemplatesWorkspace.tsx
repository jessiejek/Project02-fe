"use client";
//JJQR - AI (Nov 19, 2026) - new file: /doctor/templates workspace shell. 6 tabs, deep links (?tab=&field=&id=), search (this tab / all tabs), toasts, undoable delete.
//JJQR - AI (Nov 20, 2026) A3 — Specialty filter state removed from this page.
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { ToastHost, useToastQueue } from "@/components/ui/ToastHost";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { VISIBLE_TEMPLATE_TABS, TAB_LABELS, buildTemplatesUrl, parseField, parseTab, type TemplateTab } from "@/lib/templates/urlState";
import { releaseHistoryGuard } from "@/lib/templates/historyGuard";
import { searchAll, totalHits, type SearchLibrary } from "@/lib/templates/search";
import { useTemplatesData } from "./useTemplatesData";
import { useUndoableDelete } from "./useUndoableDelete";
import type { TabCtx } from "./types";
import { FilterChip, ViewModeContext, ViewToggle, type ViewMode } from "./shared";
import { SoapTab } from "./SoapTab";
import { PhrasesTab } from "./PhrasesTab";
import { RxTab } from "./RxTab";
import { FavoritesTab } from "./FavoritesTab";
import { DiagnosesTab } from "./DiagnosesTab";
import { CertsTab } from "./CertsTab";

export function TemplatesWorkspace() {
  const { session, loading: sessionLoading } = useSession();
  const doctorId = session?.staffId ?? "";
  const router = useRouter();
  const params = useSearchParams();
  const tab = parseTab(params.get("tab"));
  const field = parseField(params.get("field"));
  const panelId = params.get("id");

  const data = useTemplatesData(doctorId || undefined);
  const { items: toastItems, api: toast } = useToastQueue();
  const { isHidden, deleteWithUndo } = useUndoableDelete(toast);
  const [query, setQuery] = useState("");
  //JJQR - AI (Nov 19, 2026) - compact list view by default
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  //JJQR - END
  const [scope, setScope] = useState<"tab" | "all">("tab");

  const go = useCallback((url: string) => router.replace(url, { scroll: false }), [router]);
  const openPanel = useCallback((id: string, f?: string | null) => go(buildTemplatesUrl({ tab, id, field: f ?? field })), [go, tab, field]);
  //JJQR - AI (Nov 19, 2026) - drop the Back-guard history entry (if the panel had unsaved edits) before replacing the URL
  const closePanel = useCallback(() => releaseHistoryGuard(() => go(buildTemplatesUrl({ tab, field }))), [go, tab, field]);
  //JJQR - END

  const counts: Record<TemplateTab, number> = {
    soap: data.soap.items.length,
    phrases: data.phrases.items.length,
    rx: data.rx.items.length,
    favorites: data.favorites.items.length,
    diagnoses: data.diagnoses.items.length,
    certificates: data.certs.items.length,
  };

  const library: SearchLibrary = {
    soap: data.soap.items, phrases: data.phrases.items, rx: data.rx.items,
    favorites: data.favorites.items, diagnoses: data.diagnoses.items, certificates: data.certs.items,
  };
  const searching = scope === "all" && query.trim() !== "";
  const hits = useMemo(
    () => (searching ? searchAll(query, library) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- library is rebuilt from the same lists each render
    [searching, query, data.soap.items, data.phrases.items, data.rx.items, data.favorites.items, data.diagnoses.items, data.certs.items],
  );

  const ctx: TabCtx = {
    doctorId, data, toast, query: scope === "tab" ? query : "", panelId, field, openPanel, closePanel, deleteWithUndo, isHidden,
  };

  // ?id= pointing at something that was deleted / belongs to someone else.
  const activeList = { soap: data.soap, phrases: data.phrases, rx: data.rx, favorites: data.favorites, diagnoses: data.diagnoses, certificates: data.certs }[tab];
  const idOf = (row: unknown): string => {
    const r = row as { id?: string; template_id?: string };
    return r.template_id ?? r.id ?? "";
  };
  const missing = !!panelId && panelId !== "new" && activeList.status === "ready" && !(activeList.items as unknown[]).some((r) => idOf(r) === panelId) && !isHidden(panelId);

  if (sessionLoading) return <p className="text-body-md text-on-surface-variant" role="status">Loading your templates…</p>;
  if (!doctorId) return <p className="text-body-md text-on-surface-variant">Templates are available to signed-in doctors.</p>;

  return (
    <div className="space-y-md">
      {/*JJQR - AI (Nov 19, 2026) - plain buttons (no ARIA tab roles) so the existing e2e selector getByRole("button", { name: /SOAP \(\d+\)/ }) keeps working */}
      <nav aria-label="Template type" className="flex flex-wrap gap-x-xs border-b border-outline-variant">
        {/* //JJQR Nov 20, 2026 - Diagnoses hidden */}{VISIBLE_TEMPLATE_TABS.map((id) => {
          const label = `${TAB_LABELS[id]} (${counts[id]})`;
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              id={`tpl-tab-${id}`}
              aria-current={active ? "page" : undefined}
              onClick={() => go(buildTemplatesUrl({ tab: id }))}
              className={cn(
                "min-h-11 shrink-0 whitespace-nowrap border-b-2 px-sm text-label-md transition-colors sm:text-label-lg md:px-md",
                active ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface",
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>
      {/*JJQR - END*/}

      <div className="flex flex-wrap items-center gap-sm">
        <div className="relative min-w-56 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scope === "tab" ? "Search this tab…" : "Search all tabs…"}
            aria-label={scope === "tab" ? "Search this tab" : "Search all tabs"}
            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-xl pr-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-xs" role="group" aria-label="Search scope">
          <FilterChip active={scope === "tab"} onClick={() => setScope("tab")}>This tab</FilterChip>
          <FilterChip active={scope === "all"} onClick={() => setScope("all")}>All tabs</FilterChip>
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {missing && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-outline-variant bg-surface-container-low p-md text-body-md text-on-surface">
          That item no longer exists or isn’t yours to open.
          <Button variant="secondary" onClick={closePanel}>Dismiss</Button>
        </div>
      )}

      <ViewModeContext.Provider value={viewMode}>
      <div id="tpl-tabpanel" aria-live="polite">
        {hits ? (
          <SearchResults hits={hits} query={query} onOpen={(t, id, f) => { setQuery(""); go(buildTemplatesUrl({ tab: t, id, field: f })); }} />
        ) : tab === "soap" ? <SoapTab ctx={ctx} />
          : tab === "phrases" ? <PhrasesTab ctx={ctx} />
          : tab === "rx" ? <RxTab ctx={ctx} />
          : tab === "favorites" ? <FavoritesTab ctx={ctx} />
          : tab === "diagnoses" ? <DiagnosesTab ctx={ctx} />
          : <CertsTab ctx={ctx} />}
      </div>
      </ViewModeContext.Provider>
      <ToastHost items={toastItems} dismiss={toast.dismiss} />
    </div>
  );
}

function SearchResults({ hits, query, onOpen }: { hits: ReturnType<typeof searchAll>; query: string; onOpen: (tab: TemplateTab, id: string, field?: string) => void }) {
  if (totalHits(hits) === 0) {
    return <p role="status" className="rounded-xl border border-dashed border-outline-variant p-lg text-center text-body-md text-on-surface-variant">Nothing matches “{query.trim()}” in any tab.</p>;
  }
  return (
    <div className="space-y-md" aria-label="Search results">
      {VISIBLE_TEMPLATE_TABS.filter((t) => hits[t].length > 0).map((t) => (
        <section key={t} aria-label={`${TAB_LABELS[t]} results`}>
          <h3 className="mb-xs text-label-lg font-semibold text-on-surface">{TAB_LABELS[t]} <span className="font-normal text-on-surface-variant">({hits[t].length})</span></h3>
          <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
            {hits[t].map((h) => (
              <li key={`${t}:${h.id}`}>
                <button type="button" onClick={() => onOpen(t, h.id, h.field)} className="block min-h-11 w-full px-md py-sm text-left hover:bg-surface-container-low">
                  <span className="block truncate text-body-md font-medium text-on-surface">{h.title}</span>
                  {h.snippet && <span className="block truncate text-label-md text-on-surface-variant">{h.snippet}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
//JJQR - END
