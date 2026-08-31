"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LuX,
  LuCopy,
  LuCheck,
  LuLinkedin,
  LuDownload,
  LuLoader,
  LuZap,
  LuExternalLink,
  LuTriangleAlert,
  LuChevronDown,
  LuSearch,
} from "react-icons/lu";

import { cn } from "@/utils/cn";
import { leadsGenerateService } from "@/service/leadsGenerateService";
import { leadsCollectService } from "@/service/leadsCollectService";
import { COMPANY_SIZE_OPTIONS } from "@/types/LeadsCollect";
import type { CompanySizeOption } from "@/types/LeadsCollect";
import type { GenerateLead, GenerateResponse } from "@/types/LeadsGenerate";
import { getEmailStatusStyle, buildEmployeeRanges } from "@/types/LeadsGenerate";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_COUNT = 10;
const DEFAULT_COUNT = 3;

const PROGRESS_STEPS: { delay: number; text: string }[] = [
  { delay: 0, text: "Searching companies…" },
  { delay: 8_000, text: "Finding people…" },
  { delay: 20_000, text: "Revealing emails…" },
  { delay: 40_000, text: "Almost done…" },
];

// ── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  keywords: string[];
  locations: string[];
  companySizes: CompanySizeOption[];
  targetCount: number;
}

// ── URL persistence ──────────────────────────────────────────────────────────

function formToUrl(f: FormState): URLSearchParams {
  const u = new URLSearchParams();
  f.keywords.forEach((k) => u.append("kw", k));
  f.locations.forEach((l) => u.append("loc", l));
  f.companySizes.forEach((s) => u.append("sz", `${s.min},${s.max ?? ""}`));
  if (f.targetCount !== DEFAULT_COUNT) u.set("n", String(f.targetCount));
  return u;
}

function urlToForm(params: URLSearchParams): FormState {
  const keywords = params.getAll("kw");
  const locations = params.getAll("loc");
  const companySizes = params.getAll("sz").flatMap((raw) => {
    const [minStr, maxStr] = raw.split(",");
    const min = parseInt(minStr, 10);
    if (isNaN(min)) return [];
    const max = maxStr === "" || maxStr == null ? null : parseInt(maxStr, 10);
    const found = COMPANY_SIZE_OPTIONS.find(
      (o) => o.min === min && (o.max ?? null) === (isNaN(max as number) ? null : max)
    );
    return found ? [found] : [];
  });
  const n = parseInt(params.get("n") ?? "", 10);
  return {
    keywords,
    locations,
    companySizes,
    targetCount: !isNaN(n) && n >= 1 && n <= MAX_COUNT ? n : DEFAULT_COUNT,
  };
}

// ── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
  id,
  hasError,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  id?: string;
  hasError?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(
    (raw: string) => {
      const val = raw.trim();
      if (!val || tags.includes(val)) {
        setDraft("");
        return;
      }
      onChange([...tags, val]);
      setDraft("");
    },
    [tags, onChange]
  );

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    }
    if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm cursor-text",
        hasError
          ? "border-red-400 ring-1 ring-red-300"
          : "border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
        >
          {t}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(tags.filter((x) => x !== t));
            }}
            className="ml-0.5 text-blue-400 hover:text-blue-700"
          >
            <LuX className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => commit(draft)}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
      />
    </div>
  );
}

// ── SizeMultiSelect ───────────────────────────────────────────────────────────

function SizeMultiSelect({
  selected,
  onChange,
}: {
  selected: CompanySizeOption[];
  onChange: (next: CompanySizeOption[]) => void;
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

  const toggle = (opt: CompanySizeOption) => {
    const exists = selected.some((s) => s.label === opt.label);
    onChange(exists ? selected.filter((s) => s.label !== opt.label) : [...selected, opt]);
  };

  const label =
    selected.length === 0
      ? "Any size"
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} sizes`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-colors hover:border-blue-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
      >
        <span className={selected.length === 0 ? "text-gray-400" : ""}>{label}</span>
        <LuChevronDown
          className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          {COMPANY_SIZE_OPTIONS.map((opt) => {
            const checked = selected.some((s) => s.label === opt.label);
            return (
              <label
                key={opt.label}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                <span
                  className={cn("flex-1", checked ? "font-medium text-gray-800" : "text-gray-600")}
                >
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CreditsBadge ──────────────────────────────────────────────────────────────

function CreditsBadge() {
  const { data, isLoading } = useQuery({
    queryKey: ["leads-credits"],
    queryFn: () => leadsCollectService().getCredits(),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />;
  if (!data) return null;

  const n = data.data.remaining;
  const display = Number.isInteger(n) ? String(n) : n.toFixed(1);

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      <LuZap className="h-3.5 w-3.5" />
      {display} credits
    </span>
  );
}

// ── ProgressModal ─────────────────────────────────────────────────────────────
// Non-dismissible while running. Shows X only after error/success so user can
// return to form. Error state shown inline (spinner never left stuck).

interface ProgressModalProps {
  state: "running" | "error" | "success";
  errorMessage?: string;
  onClose: () => void;
}

function ProgressModal({ state, errorMessage, onClose }: ProgressModalProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (state !== "running") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(0);
    const timers = PROGRESS_STEPS.slice(1).map((s, i) =>
      setTimeout(() => setStepIndex(i + 1), s.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        {/* Close — only after terminal state */}
        {state !== "running" && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <LuX className="h-4 w-4" />
          </button>
        )}

        {state === "running" && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <LuLoader className="h-7 w-7 animate-spin text-blue-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Finding leads</p>
              <p className="mt-1 text-sm text-gray-500">{PROGRESS_STEPS[stepIndex].text}</p>
            </div>
            <div className="flex gap-1.5">
              {PROGRESS_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    i <= stepIndex ? "w-6 bg-blue-500" : "w-2 bg-gray-200"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400">
              This may take up to 2 minutes — please keep this tab open.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <LuTriangleAlert className="h-7 w-7 text-red-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Something went wrong</p>
              <p className="mt-1 text-sm text-gray-500">
                {errorMessage ?? "The request failed. Please try again."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LeadRow ───────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover/row:opacity-100"
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

function LeadRow({
  lead,
  checked,
  onCheck,
}: {
  lead: GenerateLead;
  checked: boolean;
  onCheck: (v: boolean) => void;
}) {
  const { label, className: badgeClass } = getEmailStatusStyle(lead.email_status);
  const name =
    lead.full_name ?? ([lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—");

  return (
    <tr className="group/row border-b border-gray-100 hover:bg-gray-50/60">
      <td className="w-10 px-3 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="h-4 w-4 rounded accent-blue-600"
        />
      </td>
      {/* Name — sticky */}
      <td className="sticky left-0 z-10 bg-white px-4 py-3 group-hover/row:bg-gray-50/60">
        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{name}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{lead.title ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-800 whitespace-nowrap">
          {lead.company_name ?? "—"}
        </div>
        {lead.company_domain && <div className="text-xs text-gray-400">{lead.company_domain}</div>}
      </td>
      <td className="px-4 py-3">
        {lead.email ? (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm text-gray-700">{lead.email}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badgeClass)}>
              {label}
            </span>
            <CopyButton text={lead.email} />
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{lead.phone ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{lead.location ?? "—"}</td>
      <td className="px-4 py-3">
        {lead.linkedin_url ? (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
          >
            <LuLinkedin className="h-3.5 w-3.5" />
            View
            <LuExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCsv(leads: GenerateLead[]) {
  const headers = [
    "full_name",
    "title",
    "company_name",
    "company_domain",
    "email",
    "email_status",
    "phone",
    "location",
    "linkedin_url",
  ];
  const rows = leads.map((l) =>
    [
      l.full_name ?? [l.first_name, l.last_name].filter(Boolean).join(" "),
      l.title ?? "",
      l.company_name ?? "",
      l.company_domain ?? "",
      l.email ?? "",
      l.email_status,
      l.phone ?? "",
      l.location ?? "",
      l.linkedin_url ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main view ─────────────────────────────────────────────────────────────────

type ModalState = "hidden" | "running" | "error" | "success";

export default function LeadsGenerateView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<FormState>(() => urlToForm(searchParams));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [modalState, setModalState] = useState<ModalState>("hidden");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { refetch: refetchCredits } = useQuery({
    queryKey: ["leads-credits"],
    queryFn: () => leadsCollectService().getCredits(),
    staleTime: 60_000,
  });

  // Sync form → URL
  useEffect(() => {
    const next = formToUrl(form).toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(`${pathname}?${next}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const patch = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Derived validation
  const scopeError = submitAttempted && form.keywords.length === 0 && form.locations.length === 0;

  const handleGenerate = async () => {
    setSubmitAttempted(true);
    if (form.keywords.length === 0 && form.locations.length === 0) return;

    const body = {
      keywords: form.keywords,
      locations: form.locations,
      employee_ranges: buildEmployeeRanges(form.companySizes),
      target_count: Math.min(form.targetCount, MAX_COUNT),
      min_email_status: "guessed" as const,
      companies_only: false,
    };

    setModalState("running");
    setErrorMessage(undefined);

    try {
      const data = await leadsGenerateService().generate(body);
      setResult(data);
      setSelected(new Set());
      setModalState("success");
      void refetchCredits();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
          ?.message ??
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        "Something went wrong. Please try again.";
      setErrorMessage(msg);
      setModalState("error");
      void refetchCredits();
    }
  };

  const handleModalClose = () => {
    setModalState("hidden");
    if (modalState === "success" && result) {
      // scroll to results
      document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Selection helpers
  const leads = result?.leads ?? [];
  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(leads.map((l) => l.external_id)));
  };

  const toggleOne = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      v ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const selectedLeads = leads.filter((l) => selected.has(l.external_id));
  const exportTarget = selectedLeads.length > 0 ? selectedLeads : leads;

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-[#E9ECF5]">
      {/* Progress modal */}
      {modalState !== "hidden" && (
        <ProgressModal
          state={modalState === "success" ? "success" : modalState}
          errorMessage={errorMessage}
          onClose={handleModalClose}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Leads Generate</h1>
            <p className="mt-0.5 text-sm text-gray-500">Find companies and contacts in one step.</p>
          </div>
          <CreditsBadge />
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Keywords */}
            <div className="sm:col-span-2">
              <label htmlFor="kw" className="mb-1.5 block text-sm font-medium text-gray-700">
                Keywords
                {scopeError && form.keywords.length === 0 && (
                  <span className="ml-2 text-xs font-normal text-red-500">required</span>
                )}
              </label>
              <TagInput
                id="kw"
                tags={form.keywords}
                onChange={(v) => patch("keywords", v)}
                placeholder="e.g. SaaS, fintech, HR software — press Enter"
                hasError={scopeError && form.keywords.length === 0}
              />
            </div>

            {/* Locations */}
            <div>
              <label htmlFor="loc" className="mb-1.5 block text-sm font-medium text-gray-700">
                Locations
                {scopeError && form.locations.length === 0 && (
                  <span className="ml-2 text-xs font-normal text-red-500">required</span>
                )}
              </label>
              <TagInput
                id="loc"
                tags={form.locations}
                onChange={(v) => patch("locations", v)}
                placeholder="e.g. United States, London — press Enter"
                hasError={scopeError && form.locations.length === 0}
              />
            </div>

            {/* Company size */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Company size</label>
              <SizeMultiSelect
                selected={form.companySizes}
                onChange={(v) => patch("companySizes", v)}
              />
            </div>
          </div>

          {/* Validation hint */}
          {scopeError && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-red-500">
              <LuTriangleAlert className="h-3.5 w-3.5" />
              Add at least one keyword or location to narrow the search.
            </p>
          )}

          {/* Lead count + button row */}
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="count" className="mb-1.5 block text-sm font-medium text-gray-700">
                Lead count
                <span className="ml-1 text-xs font-normal text-gray-400">(max {MAX_COUNT})</span>
              </label>
              <input
                id="count"
                type="number"
                min={1}
                max={MAX_COUNT}
                value={form.targetCount}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) patch("targetCount", Math.min(Math.max(1, n), MAX_COUNT));
                }}
                className="h-[42px] w-24 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              className="flex h-[42px] items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              <LuSearch className="h-4 w-4" />
              Find leads
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div id="results-section" className="mt-6">
            {/* Summary strip */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{leads.length}</span>{" "}
                {leads.length === 1 ? "lead" : "leads"} from{" "}
                <span className="font-semibold text-gray-900">{result.organizations_searched}</span>{" "}
                {result.organizations_searched === 1 ? "company" : "companies"} ·{" "}
                <span className="font-semibold text-gray-900">
                  {result.credits_spent.toFixed(1)}
                </span>{" "}
                credits spent
              </p>

              {leads.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportCsv(exportTarget)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  <LuDownload className="h-3.5 w-3.5" />
                  {selected.size > 0 ? `Export ${selected.size} selected` : "Export CSV"}
                </button>
              )}
            </div>

            {/* Shortfall banner */}
            {result.shortfall > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <span className="font-semibold">{result.shortfall.toFixed(1)} credits short</span>{" "}
                  — fewer leads were returned than requested. Top up credits to get the full set.
                </span>
              </div>
            )}

            {/* Table card */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {leads.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <LuSearch className="h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No leads found</p>
                  <p className="max-w-xs text-xs text-gray-400">
                    Try broadening your keywords or locations, or removing company size filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded accent-blue-600"
                          />
                        </th>
                        <th className="sticky left-0 z-10 bg-gray-50/80 px-4 py-3">Name</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <LeadRow
                          key={lead.external_id}
                          lead={lead}
                          checked={selected.has(lead.external_id)}
                          onCheck={(v) => toggleOne(lead.external_id, v)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
