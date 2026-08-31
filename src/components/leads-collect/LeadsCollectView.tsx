"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  LuSearch,
  LuX,
  LuChevronDown,
  LuCopy,
  LuCheck,
  LuLinkedin,
  LuBookmark,
  LuDownload,
  LuUpload,
  LuCircleAlert,
  LuRefreshCw,
  LuLoader,
} from "react-icons/lu";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { leadsCollectService } from "@/service/leadsCollectService";
import type { Lead, SearchParams, CompanySizeOption } from "@/types/LeadsCollect";
import { SENIORITY_OPTIONS, COMPANY_SIZE_OPTIONS } from "@/types/LeadsCollect";

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({
  label,
  placeholder,
  tags,
  onChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="min-h-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="ml-0.5 rounded-full text-blue-500 hover:text-blue-800"
            >
              <LuX className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}

// ─── Multi-select Dropdown ────────────────────────────────────────────────────

function MultiSelectDropdown<T extends { label: string; value?: string }>({
  label,
  options,
  selected,
  onToggle,
  getKey,
  getLabel,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (opt: T) => void;
  getKey: (opt: T) => string;
  getLabel: (opt: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isSelected = (opt: T) => selected.some((s) => getKey(s) === getKey(opt));

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <span className="truncate text-left">
            {selected.length === 0
              ? "Any"
              : selected.length === 1
                ? getLabel(selected[0])
                : `${selected.length} selected`}
          </span>
          <LuChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-gray-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {options.map((opt) => (
              <label
                key={getKey(opt)}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={isSelected(opt)}
                  onChange={() => onToggle(opt)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                {getLabel(opt)}
              </label>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((opt) => (
            <span
              key={getKey(opt)}
              className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
            >
              {getLabel(opt)}
              <button type="button" onClick={() => onToggle(opt)}>
                <LuX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Credits Badge ────────────────────────────────────────────────────────────

function CreditsBadge({
  used,
  budget,
  remaining,
}: {
  used: number;
  budget: number;
  remaining: number;
}) {
  const pct = budget > 0 ? remaining / budget : 1;
  const colorClass =
    remaining === 0
      ? "bg-red-100 text-red-700 border-red-200"
      : pct < 0.2
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-green-100 text-green-700 border-green-200";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        colorClass
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {remaining} of {budget} credits left
      {used > 0 && <span className="opacity-60">({used} used)</span>}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 11 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-1 text-gray-400 hover:text-gray-600"
      title="Copy"
    >
      {copied ? (
        <LuCheck className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <LuCopy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── Save-to-list modal ───────────────────────────────────────────────────────

function SaveToListModal({
  isOpen,
  onClose,
  leadIds,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  leadIds: string[];
  onSaved: () => void;
}) {
  const svc = leadsCollectService();
  const [lists, setLists] = useState<{ id: string; name: string; lead_count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    svc
      .getLists()
      .then((r) => setLists(r.results ?? []))
      .catch(() => toast.error("Failed to load lists"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAdd = async (listId: string) => {
    setSaving(listId);
    try {
      await svc.addToList(listId, leadIds);
      toast.success(`${leadIds.length} lead(s) added to list`);
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to add leads to list");
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await svc.createList(newName.trim());
      await svc.addToList(created.id, leadIds);
      toast.success(`Created "${created.name}" and added ${leadIds.length} lead(s)`);
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to create list");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save to list" width="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Saving <strong>{leadIds.length}</strong> lead(s)
        </p>

        {loading ? (
          <div className="flex justify-center py-4">
            <LuLoader className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-sm text-gray-400">No lists yet — create one below.</p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {lists.map((lst) => (
              <button
                key={lst.id}
                onClick={() => handleAdd(lst.id)}
                disabled={saving === lst.id}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <span>{lst.name}</span>
                <span className="text-xs text-gray-400">{lst.lead_count} leads</span>
                {saving === lst.id && <LuLoader className="h-4 w-4 animate-spin text-gray-400" />}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-1.5 text-xs font-semibold text-gray-500">Create new list</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="List name"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              isLoading={creating}
              disabled={!newName.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Import CSV modal ─────────────────────────────────────────────────────────

function ImportCsvModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported");
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await leadsCollectService().importCsv(file);
      onImported(res.imported ?? 0);
      onClose();
    } catch {
      toast.error("CSV import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import CSV" width="sm">
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition",
            dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
          )}
        >
          <LuUpload className="h-8 w-8 text-gray-300" />
          {file ? (
            <p className="text-sm font-medium text-gray-700">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">Drag & drop a CSV file here</p>
              <p className="text-xs text-gray-400">or click to browse</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleUpload} isLoading={loading} disabled={!file}>
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSearchParams(
  params: SearchParams,
  page: number,
  perPage: number
): Record<string, string> {
  const out: Record<string, string> = {};
  if (params.titles.length) out.titles = params.titles.join(",");
  if (params.locations.length) out.locations = params.locations.join(",");
  if (params.industries.length) out.industries = params.industries.join(",");
  if (params.seniorities.length) out.seniorities = params.seniorities.join(",");
  if (params.companySizes.length) {
    out.employee_ranges = params.companySizes
      .map((s) => (s.max != null ? `${s.min},${s.max}` : `${s.min},`))
      .join("|");
  }
  out.page = String(page);
  out.page_size = String(perPage);
  return out;
}

function buildUrlParams(params: SearchParams, page: number, perPage: number): URLSearchParams {
  const u = new URLSearchParams();
  if (params.titles.length) u.set("titles", params.titles.join(","));
  if (params.locations.length) u.set("locations", params.locations.join(","));
  if (params.industries.length) u.set("industries", params.industries.join(","));
  if (params.seniorities.length) u.set("seniorities", params.seniorities.join(","));
  if (params.companySizes.length) u.set("sizes", params.companySizes.map((s) => s.label).join(","));
  u.set("page", String(page));
  u.set("per_page", String(perPage));
  return u;
}

function parseUrlParams(sp: URLSearchParams): {
  params: SearchParams;
  page: number;
  perPage: number;
} {
  const titles = sp.get("titles") ? sp.get("titles")!.split(",").filter(Boolean) : [];
  const locations = sp.get("locations") ? sp.get("locations")!.split(",").filter(Boolean) : [];
  const industries = sp.get("industries") ? sp.get("industries")!.split(",").filter(Boolean) : [];
  const seniorities = sp.get("seniorities")
    ? sp.get("seniorities")!.split(",").filter(Boolean)
    : [];
  const sizeLabels = sp.get("sizes") ? sp.get("sizes")!.split(",").filter(Boolean) : [];
  const companySizes = COMPANY_SIZE_OPTIONS.filter((o) => sizeLabels.includes(o.label));
  const page = parseInt(sp.get("page") ?? "1", 10) || 1;
  const perPage = parseInt(sp.get("per_page") ?? "10", 10) || 10;
  return {
    params: { titles, locations, industries, seniorities, companySizes, page, perPage },
    page,
    perPage,
  };
}

function exportCsv(leads: Lead[]) {
  const headers = [
    "Name",
    "Seniority",
    "Title",
    "Company",
    "Domain",
    "Industry",
    "Size",
    "Location",
    "Email",
    "Phone",
    "LinkedIn",
  ];
  const rows = leads.map((l) => [
    l.full_name ?? `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim(),
    l.seniority ?? "",
    l.title ?? "",
    l.company_name ?? "",
    l.company_domain ?? "",
    l.industry ?? "",
    l.company_size ?? "",
    l.location ?? "",
    l.email ?? "",
    l.phone || "",
    l.linkedin_url ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function LeadsCollectView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // ── Filter state
  const [draftParams, setDraftParams] = useState<SearchParams>(() => {
    const { params } = parseUrlParams(searchParams);
    return params;
  });
  const [activeSearch, setActiveSearch] = useState<SearchParams | null>(() => {
    const { params } = parseUrlParams(searchParams);
    const hasFilters =
      params.titles.length ||
      params.locations.length ||
      params.industries.length ||
      params.seniorities.length ||
      params.companySizes.length;
    return hasFilters ? params : null;
  });
  const [page, setPage] = useState(() => parseUrlParams(searchParams).page);
  const [perPage, setPerPage] = useState(() => parseUrlParams(searchParams).perPage);

  // ── Lead data (patched in place on enrich)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [creditLimitReached, setCreditLimitReached] = useState(false);

  // ── Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Modals
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  // ── Credits
  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ["leads-credits"],
    queryFn: () => leadsCollectService().getCredits(),
    staleTime: 30_000,
  });

  // ── Search query
  const searchQueryKey = ["leads-search", activeSearch, page, perPage] as const;

  const {
    data: searchResult,
    isLoading: searching,
    isError,
    refetch: retrySearch,
  } = useQuery({
    queryKey: searchQueryKey,
    queryFn: () => {
      if (!activeSearch) return null;
      return leadsCollectService().searchLeads(buildSearchParams(activeSearch, page, perPage));
    },
    enabled: !!activeSearch,
    staleTime: 60_000,
  });

  // Sync leads into local state when search result changes
  useEffect(() => {
    if (!searchResult) return;
    const rows = searchResult.data ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeads(rows);
    setSelectedIds(new Set());
  }, [searchResult]);

  // ── Handle Search
  const handleSearch = useCallback(() => {
    setPage(1);
    setSelectedIds(new Set());
    setActiveSearch({ ...draftParams });
    const u = buildUrlParams(draftParams, 1, perPage);
    router.replace(`${pathname}?${u.toString()}`, { scroll: false });
  }, [draftParams, perPage, pathname, router]);

  const handleClear = () => {
    const empty: SearchParams = {
      titles: [],
      locations: [],
      industries: [],
      seniorities: [],
      companySizes: [],
      page: 1,
      perPage: 10,
    };
    setDraftParams(empty);
    setActiveSearch(null);
    setLeads([]);
    setSelectedIds(new Set());
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  // ── Page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds(new Set());
    if (activeSearch) {
      const u = buildUrlParams(activeSearch, newPage, perPage);
      router.replace(`${pathname}?${u.toString()}`, { scroll: false });
    }
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
    if (activeSearch) {
      const u = buildUrlParams(activeSearch, 1, newPerPage);
      router.replace(`${pathname}?${u.toString()}`, { scroll: false });
    }
  };

  // ── Enrich
  const handleReveal = async (lead: Lead) => {
    if (lead.is_enriched || enrichingId) return;
    setEnrichingId(lead.external_id);
    try {
      const res = await leadsCollectService().enrichLead(lead.external_id);
      setLeads((prev) =>
        prev.map((l) =>
          l.external_id === lead.external_id
            ? { ...l, email: res.email, phone: res.phone, is_enriched: res.is_enriched }
            : l
        )
      );
      await refetchCredits();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; detail?: string } } };
      const errData = axiosErr?.response?.data;
      if (errData?.error === "credit_limit_reached") {
        setCreditLimitReached(true);
      } else if (errData?.error === "rate_limited") {
        toast.error("Too many requests, try again shortly");
      } else if (errData?.error === "provider_forbidden") {
        toast.error(errData.detail ?? "Provider error");
      } else {
        toast.error("Failed to reveal contact info");
      }
    } finally {
      setEnrichingId(null);
    }
  };

  // ── Selection
  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.external_id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalCount = searchResult?.count ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 1;
  const showingFrom = totalCount > 0 ? (page - 1) * perPage + 1 : 0;
  const showingTo = totalCount > 0 ? Math.min(page * perPage, totalCount) : 0;
  const hasActiveFilters =
    draftParams.titles.length ||
    draftParams.locations.length ||
    draftParams.industries.length ||
    draftParams.seniorities.length ||
    draftParams.companySizes.length;

  return (
    <div className="flex flex-col gap-4 bg-[#E9ECF5] px-4 py-4 min-h-screen">
      {/* Credit-limit banner */}
      {creditLimitReached && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <LuCircleAlert className="h-4 w-4 shrink-0" />
          Monthly credit limit reached — no more reveals until the cycle resets.
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads Collect</h1>
          <p className="mt-0.5 text-sm text-gray-500">Search and reveal lead contact information</p>
        </div>
        <div className="flex items-center gap-2">
          {credits?.data && (
            <CreditsBadge
              used={credits.data.used}
              budget={credits.data.budget}
              remaining={credits.data.remaining}
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5"
          >
            <LuUpload className="h-4 w-4" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Filter card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TagInput
            label="Job Titles"
            placeholder="e.g. CTO, VP Engineering"
            tags={draftParams.titles}
            onChange={(tags) => setDraftParams((p) => ({ ...p, titles: tags }))}
          />
          <TagInput
            label="Locations"
            placeholder="e.g. Bangladesh, USA"
            tags={draftParams.locations}
            onChange={(tags) => setDraftParams((p) => ({ ...p, locations: tags }))}
          />
          <TagInput
            label="Industries"
            placeholder="e.g. SaaS, FinTech"
            tags={draftParams.industries}
            onChange={(tags) => setDraftParams((p) => ({ ...p, industries: tags }))}
          />
          <MultiSelectDropdown
            label="Seniority"
            options={SENIORITY_OPTIONS}
            selected={SENIORITY_OPTIONS.filter((o) => draftParams.seniorities.includes(o.value!))}
            onToggle={(opt) => {
              setDraftParams((p) => ({
                ...p,
                seniorities: p.seniorities.includes(opt.value!)
                  ? p.seniorities.filter((s) => s !== opt.value)
                  : [...p.seniorities, opt.value!],
              }));
            }}
            getKey={(o) => o.value!}
            getLabel={(o) => o.label}
          />
          <MultiSelectDropdown
            label="Company Size"
            options={COMPANY_SIZE_OPTIONS}
            selected={draftParams.companySizes}
            onToggle={(opt) => {
              setDraftParams((p) => {
                const already = p.companySizes.some((s) => s.label === opt.label);
                return {
                  ...p,
                  companySizes: already
                    ? p.companySizes.filter((s) => s.label !== opt.label)
                    : [...p.companySizes, opt],
                };
              });
            }}
            getKey={(o: CompanySizeOption) => o.label}
            getLabel={(o: CompanySizeOption) => o.label}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            onClick={handleSearch}
            className="gap-1.5"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          >
            <LuSearch className="h-4 w-4" />
            Search
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="md"
              onClick={handleClear}
              className="gap-1.5 text-gray-500"
            >
              <LuX className="h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Results area */}
      <div ref={tableRef} className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Results header */}
        {activeSearch && !searching && leads.length > 0 && (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <strong>
                {showingFrom}–{showingTo}
              </strong>{" "}
              of <strong>{totalCount}</strong> leads
            </p>
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-5 py-2.5">
            <span className="text-sm font-semibold text-blue-700">{selectedIds.size} selected</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSaveModalOpen(true)}
              className="gap-1.5"
            >
              <LuBookmark className="h-4 w-4" />
              Save to list
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const sel = leads.filter((l) => selectedIds.has(l.external_id));
                exportCsv(sel);
              }}
              className="gap-1.5"
            >
              <LuDownload className="h-4 w-4" />
              Export CSV
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-blue-500 hover:text-blue-700"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Table states */}
        {!activeSearch ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <LuSearch className="h-10 w-10 text-gray-200" />
            <p className="text-base font-medium text-gray-500">Set filters and click Search</p>
            <p className="text-sm text-gray-400">
              Filter by job title, location, industry, seniority, or company size
            </p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <LuCircleAlert className="h-8 w-8 text-red-400" />
            <p className="text-sm text-gray-600">Failed to load leads</p>
            <Button variant="secondary" size="sm" onClick={() => retrySearch()} className="gap-1.5">
              <LuRefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedIds.size === leads.length}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            selectedIds.size > 0 && selectedIds.size < leads.length;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                  {[
                    "Name",
                    "Title",
                    "Company",
                    "Industry",
                    "Size",
                    "Location",
                    "Email",
                    "Phone",
                    "Links",
                    "Actions",
                  ].map((col) => (
                    <th
                      key={col}
                      className={cn(
                        "px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500",
                        col === "Name" && "sticky left-10 z-10 bg-gray-50"
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searching ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-gray-400">
                      No leads matched these filters.{" "}
                      <button onClick={handleClear} className="text-blue-600 hover:underline">
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead, idx) => {
                    const name =
                      lead.full_name ||
                      `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                      "—";
                    const location = lead.location || "—";
                    const phone = lead.phone || null;
                    const isEnriching = enrichingId === lead.external_id;
                    const isSelected = selectedIds.has(lead.external_id);

                    return (
                      <tr
                        key={lead.external_id}
                        className={cn(
                          "border-b border-gray-100 transition-colors hover:bg-gray-50",
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                          lead.is_enriched && "border-l-2 border-l-green-400",
                          isSelected && "bg-blue-50"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(lead.external_id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </td>

                        {/* Name */}
                        <td className="sticky left-10 z-10 bg-inherit px-3 py-3 min-w-[140px]">
                          <p className="font-semibold text-gray-900 whitespace-nowrap">{name}</p>
                          {lead.seniority && (
                            <p className="text-xs text-gray-400 capitalize">
                              {lead.seniority.replace("_", " ")}
                            </p>
                          )}
                        </td>

                        {/* Title */}
                        <td className="px-3 py-3 max-w-[160px]">
                          <span className="block truncate text-gray-700" title={lead.title ?? ""}>
                            {lead.title ?? "—"}
                          </span>
                        </td>

                        {/* Company */}
                        <td className="px-3 py-3 min-w-[130px]">
                          <p className="font-medium text-gray-800 whitespace-nowrap">
                            {lead.company_name ?? "—"}
                          </p>
                          {lead.company_domain && (
                            <a
                              href={`https://${lead.company_domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {lead.company_domain}
                            </a>
                          )}
                        </td>

                        {/* Industry */}
                        <td className="px-3 py-3 text-gray-500">{lead.industry ?? "—"}</td>

                        {/* Size */}
                        <td className="px-3 py-3 whitespace-nowrap text-gray-500">
                          {lead.company_size ?? "—"}
                        </td>

                        {/* Location */}
                        <td className="px-3 py-3 max-w-[130px]">
                          <span className="block truncate text-gray-500" title={location}>
                            {location}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-3 py-3 min-w-[160px]">
                          {isEnriching ? (
                            <LuLoader className="h-4 w-4 animate-spin text-gray-400" />
                          ) : lead.is_enriched ? (
                            lead.email ? (
                              <span className="flex items-center gap-1">
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="text-blue-600 hover:underline text-xs"
                                >
                                  {lead.email}
                                </a>
                                <CopyButton value={lead.email} />
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Not found</span>
                            )
                          ) : (
                            <button
                              onClick={() => handleReveal(lead)}
                              disabled={!!enrichingId || creditLimitReached}
                              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 transition"
                            >
                              Reveal
                            </button>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="px-3 py-3 min-w-[130px]">
                          {isEnriching ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : lead.is_enriched ? (
                            phone ? (
                              <span className="flex items-center gap-1">
                                <a
                                  href={`tel:${phone}`}
                                  className="text-blue-600 hover:underline text-xs"
                                >
                                  {phone}
                                </a>
                                <CopyButton value={phone} />
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Not found</span>
                            )
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        {/* Links */}
                        <td className="px-3 py-3">
                          {lead.linkedin_url ? (
                            <a
                              href={lead.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0077B5]/10 text-[#0077B5] hover:bg-[#0077B5]/20 transition"
                              title="LinkedIn"
                            >
                              <LuLinkedin className="h-4 w-4" />
                            </a>
                          ) : (
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-300"
                              title="No LinkedIn URL"
                            >
                              <LuLinkedin className="h-4 w-4" />
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <button
                            onClick={() => {
                              setSelectedIds(new Set([lead.external_id]));
                              setSaveModalOpen(true);
                            }}
                            title="Save to list"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                          >
                            <LuBookmark className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {activeSearch && leads.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Per page</span>
              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
              >
                {[5, 10, 20, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Save to list modal */}
      <SaveToListModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        leadIds={Array.from(selectedIds)}
        onSaved={() => setSelectedIds(new Set())}
      />

      {/* Import CSV modal */}
      <ImportCsvModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={(count) => {
          toast.success(`${count} leads imported`);
          queryClient.invalidateQueries({ queryKey: ["leads-search"] });
        }}
      />
    </div>
  );
}
