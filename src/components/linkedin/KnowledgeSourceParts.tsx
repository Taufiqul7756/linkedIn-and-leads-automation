"use client";

// Building blocks shared by the Knowledge base modal and the Image knowledge base modal:
// link validation, source links, note input / inline note edit, status badge, headings.

import { useState } from "react";
import { LuLoader, LuCheck, LuPencil, LuX, LuCornerDownRight } from "react-icons/lu";
import axios from "axios";
import HoverGuide from "@/components/ui/HoverGuide";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { cn } from "@/utils/cn";

// http(s) link with a real domain — scheme optional ("acme.com" is fine, backend adds it)
export function isValidUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return false;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      /^([a-z\d-]+\.)+[a-z]{2,}$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export const URL_ERROR = "Enter a valid link, e.g. acme.com";

// Saved sources may be stored without a scheme ("acme.com") — make them openable
export function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Opens a source in a new tab — used for website, profile and PDF titles
export function SourceLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className={cn("block truncate hover:underline", className)}
    >
      {children}
    </a>
  );
}

// Free-text note telling the agent how to use a source — sent as the backend's `label` field
export const NOTE_MAX = 200;
export const NOTE_PLACEHOLDER = "How should the agent use this? (optional)";

// 400 { label: ["Ensure this field has no more than 200 characters."] } → field message
export function noteOrMessage(err: unknown): string {
  const first = axios.isAxiosError(err)
    ? (err.response?.data as { label?: unknown[] } | undefined)?.label?.[0]
    : undefined;
  return typeof first === "string" ? first : extractErrorMessage(err);
}

// Optional note typed while adding a link or PDF (max 200 chars, live counter).
// Indented under its source with a ↳ connector and a tinted field so it reads as part of it.
export function NoteInput({
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
}) {
  return (
    <div className="flex animate-fade-in-up items-center gap-2 pl-3">
      <LuCornerDownRight className="h-4 w-4 shrink-0 text-blue-400" />
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          maxLength={NOTE_MAX}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          className="w-full rounded-lg border border-blue-100 bg-blue-50/60 py-2 pl-3.5 pr-16 text-sm text-gray-900 placeholder-gray-500 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-400/20"
        />
        {value && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {value.length}/{NOTE_MAX}
          </span>
        )}
      </div>
    </div>
  );
}

// Note for the agent on a knowledge source (backend field `label`) — "Note: …" line under
// the source name, pencil → inline edit. Without onSave it's read-only.
export function EditableNote({
  note,
  onSave,
}: {
  note: string;
  onSave?: (note: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!onSave) return;
    const next = draft.trim();
    if (next === note) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const startEdit = () => {
    setDraft(note);
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          maxLength={NOTE_MAX}
          placeholder={NOTE_PLACEHOLDER}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
        <button
          onClick={save}
          disabled={saving}
          className="shrink-0 text-gray-400 hover:text-green-600 disabled:opacity-50"
          title="Save note"
        >
          {saving ? <LuLoader className="h-4 w-4 animate-spin" /> : <LuCheck className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="shrink-0 text-gray-400 hover:text-gray-600"
          title="Cancel"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!note) {
    return onSave ? (
      <button
        onClick={startEdit}
        className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        <LuPencil className="h-3 w-3" />
        Add note for the agent
      </button>
    ) : null;
  }

  return (
    <div className="mt-1 flex min-w-0 items-start gap-1.5">
      <p className="min-w-0 text-xs text-gray-600">
        <span className="font-medium text-gray-700">Note:</span> {note}
      </p>
      {onSave && (
        <button
          onClick={startEdit}
          className="shrink-0 text-gray-300 transition-colors hover:text-blue-500"
          title="Edit note"
        >
          <LuPencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "ready")
    return (
      <span className="shrink-0 rounded border border-green-300 px-1.5 py-0.5 text-[11px] font-medium text-green-600">
        Ready
      </span>
    );
  if (status === "error" || status === "failed")
    return (
      <span className="shrink-0 rounded border border-red-300 px-1.5 py-0.5 text-[11px] font-medium text-red-500">
        Error
      </span>
    );
  return (
    <span className="shrink-0 rounded border border-amber-200 px-1.5 py-0.5 text-[11px] font-medium text-amber-600">
      Processing
    </span>
  );
}

// Heading for a part of the Knowledge card (Your LinkedIn profile / Additional knowledge)
export function SubsectionHeader({
  title,
  tip,
}: {
  title: string;
  // Hover guide shown from an ⓘ icon after the title
  tip?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {tip && <HoverGuide>{tip}</HoverGuide>}
    </div>
  );
}

export function LoadingRow() {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
      <LuLoader className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}
