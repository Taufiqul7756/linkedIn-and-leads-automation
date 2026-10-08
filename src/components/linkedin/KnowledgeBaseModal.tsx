"use client";

import { useRef, useState } from "react";
import {
  LuLoader,
  LuRefreshCw,
  LuTrash2,
  LuUpload,
  LuCheck,
  LuPencil,
  LuX,
  LuFileText,
  LuCornerDownRight,
} from "react-icons/lu";
import axios from "axios";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import HoverGuide from "@/components/ui/HoverGuide";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { agentService } from "@/service/agentService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import AudienceLengthSection from "./AudienceLengthSection";
import { cn } from "@/utils/cn";
import SourceIcon from "./SourceIcon";
import { agentSettingsQueryKey } from "@/hooks/useAgentSettings";
import type { LinkedInProfile, ProfileDocument, ProfileWebsite } from "@/types/Agent";

// ─── helpers ──────────────────────────────────────────────────────────────────

type DisplayPurpose = "knowledge" | "tone";

function isTone(purpose: string) {
  return purpose === "tone" || purpose === "style";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(ms / 86_400_000);
  if (d > 0) return d === 1 ? "yesterday" : `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return m > 0 ? `${m}m ago` : "just now";
}

// Uploaded but not finished extracting / crawling yet
function isProcessing(status: string) {
  return status !== "ready" && status !== "failed" && status !== "error";
}

function getDocType(filename: string): "PDF" | "DOCX" | "TXT" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (ext === "docx" || ext === "doc") return "DOCX";
  return "TXT";
}

// http(s) link with a real domain — scheme optional ("acme.com" is fine, backend adds it)
function isValidUrl(raw: string): boolean {
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

const URL_ERROR = "Enter a valid link, e.g. acme.com";

// Saved sources may be stored without a scheme ("acme.com") — make them openable
function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Opens a source in a new tab — used for website, profile and PDF titles
function SourceLink({
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
const NOTE_MAX = 200;
const NOTE_PLACEHOLDER = "How should the agent use this? (optional)";

// 400 { label: ["Ensure this field has no more than 200 characters."] } → field message
function noteOrMessage(err: unknown): string {
  const first = axios.isAxiosError(err)
    ? (err.response?.data as { label?: unknown[] } | undefined)?.label?.[0]
    : undefined;
  return typeof first === "string" ? first : extractErrorMessage(err);
}

// ─── small display components ─────────────────────────────────────────────────

// Optional note typed while adding a link or PDF (max 200 chars, live counter).
// Indented under its source with a ↳ connector and a tinted field so it reads as part of it.
function NoteInput({
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
function EditableNote({
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

// Heading for a part of the Knowledge card (Your LinkedIn profile / Additional knowledge)
function SubsectionHeader({
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

// Hover guide for the Knowledge card (was the blue tip line under the header)
function KnowledgeGuide() {
  return (
    <>
      <span className="block font-semibold">What is Knowledge?</span>
      <span className="mt-1.5 block">
        Add your LinkedIn profile, then any websites, posts or documents — so the agent knows your
        brand, products, and story.
      </span>
    </>
  );
}

// Hover guide for the Tone / Style card (was the violet tip line under the header)
function ToneGuide() {
  return (
    <>
      <span className="block font-semibold">What is Tone / Style?</span>
      <span className="mt-1.5 block">
        Add writing samples — blog posts, LinkedIn posts, or documents — so the agent matches your
        voice and style.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Note for the agent:</span> e.g. &ldquo;Use for greetings and
        sign-offs&rdquo; or &ldquo;Copy how posts open&rdquo;.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Tip:</span> switch samples on or off in Composer settings →
        Tone / Style. Several on = one blended voice; all off = default voice.
      </span>
    </>
  );
}

// Hover guide for Additional knowledge — what to add and how to write a useful note
function AdditionalKnowledgeGuide() {
  return (
    <>
      <span className="block font-semibold">How to use Additional knowledge</span>
      <span className="mt-1.5 block">
        Websites, LinkedIn posts, other links or PDFs — add a note to tell the agent how to use
        each.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">What to add:</span> company website, product pages, LinkedIn
        posts, articles, or PDFs (decks, case studies, product docs).
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Note for the agent:</span> tell it how to use this source,
        e.g. &ldquo;Use this for article making&rdquo;, &ldquo;Only for product facts and
        pricing&rdquo;, &ldquo;Use as examples of past posts&rdquo;.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">PDFs:</span> pick a file, write the note, then Upload.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Tip:</span> turn each source on or off per chat in Composer
        settings → Knowledge.
      </span>
    </>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
      <LuLoader className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

// Website / PDF → SourceIcon tile (linkedin.com links → LinkedIn tile); DOCX / TXT keep the text badge
function TypeBadge({ type, url }: { type: "www" | "PDF" | "DOCX" | "TXT"; url?: string }) {
  if (type === "www" || type === "PDF") {
    return (
      <span className="flex h-8 w-12 shrink-0 items-center justify-center">
        <SourceIcon kind={type === "www" ? "website" : "pdf"} url={url} className="h-8 w-8" />
      </span>
    );
  }
  const cls: Record<string, string> = {
    www: "bg-slate-100 text-slate-600",
    PDF: "bg-purple-100 text-purple-700",
    DOCX: "bg-blue-100 text-blue-700",
    TXT: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`flex h-8 w-12 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase tracking-wide ${cls[type]}`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
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

// ─── SiteRow and DocRow are defined outside to avoid remounting ───────────────

interface SiteRowProps {
  site: ProfileWebsite;
  recrawlingId: string | null;
  deletingSiteId: string | null;
  onRecrawl: (id: string) => void;
  onRequestDelete: (id: string, name: string, kind: "site" | "doc") => void;
  // Knowledge sources only — edit the note for the agent
  onSaveNote?: (id: string, note: string) => Promise<boolean>;
}
function SiteRow({
  site,
  recrawlingId,
  deletingSiteId,
  onRecrawl,
  onRequestDelete,
  onSaveNote,
}: SiteRowProps) {
  const isRecrawling = recrawlingId === site.id;
  const isDeleting = deletingSiteId === site.id;
  const hasError = (site.status === "failed" || site.status === "error") && !!site.error;
  return (
    <div
      className={`border-b border-gray-100 py-3 last:border-0 ${
        isProcessing(site.status) ? "animate-sweep -mx-2 rounded-lg bg-purple-50/60 px-2" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <TypeBadge type="www" url={site.url} />
        <div className="min-w-0 flex-1">
          <SourceLink
            href={toHref(site.url)}
            className="text-sm font-medium text-gray-900 hover:text-blue-600"
          >
            {site.url}
          </SourceLink>
          <p className="text-xs text-gray-400">crawled {timeAgo(site.created_at)}</p>
          {(onSaveNote || site.label) && (
            <EditableNote
              note={site.label ?? ""}
              onSave={onSaveNote ? (note) => onSaveNote(site.id, note) : undefined}
            />
          )}
        </div>
        {isProcessing(site.status) && (
          <LuLoader className="h-4 w-4 shrink-0 animate-spin text-purple-500" />
        )}
        <StatusBadge status={site.status} />
        <button
          onClick={() => onRecrawl(site.id)}
          disabled={isRecrawling}
          className="shrink-0 text-gray-300 transition-colors hover:text-blue-500 disabled:opacity-50"
          title="Recrawl"
        >
          {isRecrawling ? (
            <LuLoader className="h-4 w-4 animate-spin" />
          ) : (
            <LuRefreshCw className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onRequestDelete(site.id, site.url, "site")}
          disabled={isDeleting}
          className="shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
        >
          {isDeleting ? (
            <LuLoader className="h-4 w-4 animate-spin" />
          ) : (
            <LuTrash2 className="h-4 w-4" />
          )}
        </button>
      </div>
      {hasError && <p className="mt-1.5 text-xs text-red-500">{site.error}</p>}
    </div>
  );
}

interface DocRowProps {
  doc: ProfileDocument;
  deletingDocId: string | null;
  onRequestDelete: (id: string, name: string, kind: "site" | "doc") => void;
  // Knowledge sources only — edit the note for the agent
  onSaveNote?: (id: string, note: string) => Promise<boolean>;
}
function DocRow({ doc, deletingDocId, onRequestDelete, onSaveNote }: DocRowProps) {
  const isDeleting = deletingDocId === doc.id;
  const type = getDocType(doc.filename);
  const meta = doc.num_pages > 0 ? `${type} · ${doc.num_pages} pages` : type;
  return (
    <div
      className={`flex items-center gap-3 border-b border-gray-100 py-3 last:border-0 ${
        isProcessing(doc.status) ? "animate-sweep -mx-2 rounded-lg bg-purple-50/60 px-2" : ""
      }`}
    >
      <TypeBadge type={type} />
      <div className="min-w-0 flex-1">
        {doc.file ? (
          <SourceLink
            href={doc.file}
            className="text-sm font-medium text-gray-900 hover:text-blue-600"
          >
            {doc.filename}
          </SourceLink>
        ) : (
          <p className="truncate text-sm font-medium text-gray-900">{doc.filename}</p>
        )}
        <p className="text-xs text-gray-400">{meta}</p>
        {(onSaveNote || doc.label) && (
          <EditableNote
            note={doc.label ?? ""}
            onSave={onSaveNote ? (note) => onSaveNote(doc.id, note) : undefined}
          />
        )}
      </div>
      {isProcessing(doc.status) && (
        <LuLoader className="h-4 w-4 shrink-0 animate-spin text-purple-500" />
      )}
      <StatusBadge status={doc.status} />
      <button
        onClick={() => onRequestDelete(doc.id, doc.filename, "doc")}
        disabled={isDeleting}
        className="shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
      >
        {isDeleting ? (
          <LuLoader className="h-4 w-4 animate-spin" />
        ) : (
          <LuTrash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

// ─── add form: link + ↳ note, staged PDF + ↳ note ─────────────────────────────

const isLinkedInProfileUrl = (url: string) => /linkedin\.com\/in\//i.test(url);

interface AddSourceFormProps {
  purpose: DisplayPurpose;
  workspaceId: string;
  urlPlaceholder: string;
  // Called after a link / PDF is saved — parent refreshes its lists + composer switches
  onAdded: (kind: "site" | "doc") => void;
}

// Shared by Additional knowledge and Tone / Style. The note (backend `label`) and Add link
// appear once a link is typed; a picked PDF is staged with its own note before upload.
function AddSourceForm({ purpose, workspaceId, urlPlaceholder, onAdded }: AddSourceFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  // Show the invalid-link message only after blur / an Add attempt, not while typing
  const [urlTouched, setUrlTouched] = useState(false);
  const [urlNote, setUrlNote] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<File | null>(null);
  const [docNote, setDocNote] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const urlError = urlTouched && !!url.trim() && !isValidUrl(url);

  const handleAddUrl = async () => {
    const value = url.trim();
    if (!value || !workspaceId) return;
    if (!isValidUrl(value)) {
      setUrlTouched(true);
      return;
    }
    // Profiles belong in Your LinkedIn profile — not in Additional knowledge or Tone / Style
    if (isLinkedInProfileUrl(value)) {
      toast.error(
        purpose === "knowledge"
          ? "Add LinkedIn profiles under Your LinkedIn profile."
          : "LinkedIn profiles can't be a tone / style source — use a post or article link."
      );
      return;
    }
    setAddingUrl(true);
    try {
      await agentService(workspaceId).addAgentWebsite(value, purpose, false, urlNote.trim());
      setUrl("");
      setUrlTouched(false);
      setUrlNote("");
      onAdded("site");
      toast.success("Link added.");
    } catch (err) {
      toast.error(noteOrMessage(err));
    } finally {
      setAddingUrl(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingDoc(file);
    setDocNote("");
  };

  const handleUploadPendingDoc = async () => {
    if (!pendingDoc || !workspaceId) return;
    setUploadingDoc(true);
    try {
      await agentService(workspaceId).uploadAgentDocument(
        pendingDoc,
        purpose,
        false,
        docNote.trim()
      );
      setPendingDoc(null);
      setDocNote("");
      onAdded("doc");
      toast.success("Document uploaded.");
    } catch (err) {
      toast.error(noteOrMessage(err));
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <>
      {/* Link + note stacked; note and Add link appear once something is typed */}
      <div className="space-y-2 rounded-lg border border-gray-200 p-3">
        <div>
          <input
            type="url"
            placeholder={urlPlaceholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => url.trim() && setUrlTouched(true)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            aria-invalid={urlError}
            className={cn(
              "w-full rounded-lg border px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2",
              urlError
                ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                : "border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
            )}
          />
          {urlError && <p className="mt-1 text-xs text-red-500">{URL_ERROR}</p>}
        </div>
        {url.trim() && (
          <>
            <NoteInput
              value={urlNote}
              onChange={setUrlNote}
              placeholder="How should the agent use this link? (optional)"
              onEnter={handleAddUrl}
            />
            <div className="flex animate-fade-in-up justify-end">
              <button
                onClick={handleAddUrl}
                disabled={!isValidUrl(url) || addingUrl}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {addingUrl && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                Add link
              </button>
            </div>
          </>
        )}
      </div>

      {pendingDoc ? (
        // Staged PDF — add a note for the agent, then upload
        <div
          className={cn(
            "space-y-2 rounded-lg border border-purple-200 bg-purple-50/60 p-3",
            uploadingDoc && "animate-sweep"
          )}
        >
          <div className="flex items-center gap-2">
            <LuFileText className="h-4 w-4 shrink-0 text-purple-600" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
              {pendingDoc.name}
            </p>
            <button
              onClick={() => setPendingDoc(null)}
              disabled={uploadingDoc}
              className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
              title="Remove"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
          <NoteInput
            value={docNote}
            onChange={setDocNote}
            placeholder="How should the agent use this PDF? (optional)"
            onEnter={handleUploadPendingDoc}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingDoc(null)}
              disabled={uploadingDoc}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadPendingDoc}
              disabled={uploadingDoc}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadingDoc ? (
                <LuLoader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LuUpload className="h-3.5 w-3.5" />
              )}
              Upload
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 py-3 text-sm font-medium text-purple-700 transition-colors hover:border-purple-400 hover:bg-purple-100"
        >
          <LuUpload className="h-4 w-4 text-purple-600" />
          <span>Upload PDF</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeBaseModal({ isOpen, onClose }: Props) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();

  // Your LinkedIn profile — profile URL, no note
  const [profileUrlInput, setProfileUrlInput] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    name: string;
    kind: "site" | "doc" | "profile";
  } | null>(null);
  const [recrawlingId, setRecrawlingId] = useState<string | null>(null);

  const isTerminal = (s: string) => s === "ready" || s === "error" || s === "failed";

  const { data: docsData, isLoading: docsLoading } = useQueryWithTokenRefresh(
    ["agent-documents", workspaceId],
    () => agentService(workspaceId).getAgentDocuments(),
    {
      enabled: !!workspaceId && isOpen,
      refetchInterval: (query) => {
        const items =
          (query.state.data as { results?: ProfileDocument[] } | undefined)?.results ?? [];
        return items.some((d) => !isTerminal(d.status)) ? 3000 : false;
      },
    }
  );

  const { data: sitesData, isLoading: sitesLoading } = useQueryWithTokenRefresh(
    ["agent-websites", workspaceId],
    () => agentService(workspaceId).getAgentWebsites(),
    {
      enabled: !!workspaceId && isOpen,
      refetchInterval: (query) => {
        const items =
          (query.state.data as { results?: ProfileWebsite[] } | undefined)?.results ?? [];
        return items.some((s) => !isTerminal(s.status)) ? 3000 : false;
      },
    }
  );

  const { data: profilesData, isLoading: profilesLoading } = useQueryWithTokenRefresh(
    ["linkedin-profiles", workspaceId],
    () => agentService(workspaceId).getProfiles(),
    {
      enabled: !!workspaceId && isOpen,
      refetchInterval: (query) => {
        const items =
          (query.state.data as { results?: LinkedInProfile[] } | undefined)?.results ?? [];
        return items.some((p) => !isTerminal(p.status)) ? 3000 : false;
      },
    }
  );

  const docs: ProfileDocument[] =
    (docsData as { results?: ProfileDocument[] } | undefined)?.results ?? [];
  const sites: ProfileWebsite[] =
    (sitesData as { results?: ProfileWebsite[] } | undefined)?.results ?? [];
  const profiles: LinkedInProfile[] =
    (profilesData as { results?: LinkedInProfile[] } | undefined)?.results ?? [];

  const knowledgeSites = sites.filter((s) => !isTone(s.purpose));
  const knowledgeDocs = docs.filter((d) => !isTone(d.purpose));
  const toneSites = sites.filter((s) => isTone(s.purpose));
  const toneDocs = docs.filter((d) => isTone(d.purpose));
  const knowledgeCount = knowledgeSites.length + knowledgeDocs.length;
  const toneCount = toneSites.length + toneDocs.length;
  const totalCount = docs.length + sites.length + profiles.length;

  // Composer knowledge switches list comes from GET agent/settings/ — keep it in sync
  const refreshKnowledgeSwitches = () =>
    queryClient.invalidateQueries({ queryKey: agentSettingsQueryKey(workspaceId) });

  const deleteProfileMutation = useMutationWithTokenRefresh(
    (id: string) => agentService(workspaceId).deleteProfile(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["linkedin-profiles", workspaceId] });
        refreshKnowledgeSwitches();
        toast.success("Profile removed.");
        setDeletingProfileId(null);
      },
      onError: (err: unknown) => {
        toast.error(extractErrorMessage(err));
        setDeletingProfileId(null);
      },
    }
  );

  const deleteDocMutation = useMutationWithTokenRefresh(
    (id: string) => agentService(workspaceId).deleteAgentDocument(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["agent-documents", workspaceId] });
        refreshKnowledgeSwitches();
        toast.success("Document removed.");
        setDeletingDocId(null);
      },
      onError: (err: unknown) => {
        toast.error(extractErrorMessage(err));
        setDeletingDocId(null);
      },
    }
  );

  const deleteSiteMutation = useMutationWithTokenRefresh(
    (id: string) => agentService(workspaceId).deleteAgentWebsite(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["agent-websites", workspaceId] });
        refreshKnowledgeSwitches();
        toast.success("Website removed.");
        setDeletingSiteId(null);
      },
      onError: (err: unknown) => {
        toast.error(extractErrorMessage(err));
        setDeletingSiteId(null);
      },
    }
  );

  // Your LinkedIn profile — profile URL only, no note
  const handleAddProfile = async () => {
    const url = profileUrlInput.trim();
    if (!url || !workspaceId) return;
    if (!isLinkedInProfileUrl(url)) {
      toast.error("Enter a LinkedIn profile URL (linkedin.com/in/…).");
      return;
    }
    setAddingProfile(true);
    try {
      await agentService(workspaceId).createProfile(url);
      queryClient.invalidateQueries({ queryKey: ["linkedin-profiles", workspaceId] });
      refreshKnowledgeSwitches();
      setProfileUrlInput("");
      toast.success("LinkedIn profile added.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAddingProfile(false);
    }
  };

  // A link / PDF was added by an AddSourceForm — refresh its list + the composer switches
  const handleSourceAdded = (kind: "site" | "doc") => {
    queryClient.invalidateQueries({
      queryKey: [kind === "site" ? "agent-websites" : "agent-documents", workspaceId],
    });
    refreshKnowledgeSwitches();
  };

  // Save the note for the agent on a knowledge or tone / style source — PATCH { label }
  const saveNote = async (kind: "site" | "doc", id: string, note: string): Promise<boolean> => {
    try {
      const svc = agentService(workspaceId);
      if (kind === "site") await svc.patchAgentWebsite(id, { label: note });
      else await svc.patchAgentDocument(id, { label: note });
      queryClient.invalidateQueries({
        queryKey: [kind === "site" ? "agent-websites" : "agent-documents", workspaceId],
      });
      refreshKnowledgeSwitches();
      return true;
    } catch (err) {
      toast.error(noteOrMessage(err));
      return false;
    }
  };

  const handleRecrawl = async (id: string) => {
    setRecrawlingId(id);
    try {
      await agentService(workspaceId).recrawlAgentWebsite(id);
      queryClient.invalidateQueries({ queryKey: ["agent-websites", workspaceId] });
      toast.success("Recrawl started.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setRecrawlingId(null);
    }
  };

  const handleRequestDelete = (id: string, name: string, kind: "site" | "doc" | "profile") =>
    setConfirmTarget({ id, name, kind });

  const handleCancelDelete = () => setConfirmTarget(null);

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "profile") {
      setDeletingProfileId(confirmTarget.id);
      deleteProfileMutation.mutate(confirmTarget.id);
    } else if (confirmTarget.kind === "site") {
      setDeletingSiteId(confirmTarget.id);
      deleteSiteMutation.mutate(confirmTarget.id);
    } else {
      setDeletingDocId(confirmTarget.id);
      deleteDocMutation.mutate(confirmTarget.id);
    }
    setConfirmTarget(null);
  };

  const isLoading = docsLoading || sitesLoading || profilesLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Knowledge base" width="4xl">
      {/* ── Knowledge accordion card ──────────────────────────────────── */}
      <div className="mb-4 rounded-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-sidebar-bg px-4 py-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white">Knowledge</p>
            <HoverGuide onDark>
              <KnowledgeGuide />
            </HoverGuide>
          </div>
          {profiles.length + knowledgeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-800">
              {profiles.length + knowledgeCount}
            </span>
          )}
        </div>

        {/* ── Your LinkedIn profile — no note ── */}
        <div className="space-y-2 border-b border-gray-100 p-4">
          <SubsectionHeader title="Your LinkedIn profile" />
          {/* Input only until a profile is added — then just the profile row */}
          {profiles.length === 0 && (
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="linkedin.com/in/username"
                value={profileUrlInput}
                onChange={(e) => setProfileUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProfile()}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
              <button
                onClick={handleAddProfile}
                disabled={!profileUrlInput.trim() || addingProfile}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {addingProfile && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                Add
              </button>
            </div>
          )}

          {isLoading ? (
            <LoadingRow />
          ) : profiles.length > 0 ? (
            <div>
              {profiles.map((p) => {
                const username =
                  p.profile_url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? p.profile_url;
                const summary = (p.facets as { summary?: string } | null)?.summary ?? null;
                const isDeleting = deletingProfileId === p.id;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
                  >
                    <SourceIcon kind="linkedin" className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{username}</p>
                      <SourceLink
                        href={toHref(p.profile_url)}
                        className="text-xs text-blue-500 hover:text-blue-600"
                      >
                        {p.profile_url}
                      </SourceLink>
                      {summary && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{summary}</p>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                    {p.status === "ready" ? (
                      <LuCheck className="h-4 w-4 shrink-0 text-green-500" strokeWidth={2.5} />
                    ) : p.status === "pending" || p.status === "fetching" ? (
                      <LuLoader className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                    ) : null}
                    <button
                      onClick={() => handleRequestDelete(p.id, username, "profile")}
                      disabled={isDeleting}
                      className="shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <LuLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <LuTrash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── Additional knowledge — links + PDFs, each with an optional note ── */}
        <div className="space-y-2 p-4">
          <SubsectionHeader title="Additional knowledge" tip={<AdditionalKnowledgeGuide />} />
          <AddSourceForm
            purpose="knowledge"
            workspaceId={workspaceId}
            urlPlaceholder="Website, LinkedIn post or article URL"
            onAdded={handleSourceAdded}
          />

          {isLoading ? (
            <LoadingRow />
          ) : knowledgeCount > 0 ? (
            // Gap + divider so the list reads separately from the upload controls
            <div className="mt-5 border-t border-gray-100 pt-1">
              {knowledgeSites.map((s) => (
                <SiteRow
                  key={s.id}
                  site={s}
                  recrawlingId={recrawlingId}
                  deletingSiteId={deletingSiteId}
                  onRecrawl={handleRecrawl}
                  onRequestDelete={handleRequestDelete}
                  onSaveNote={(id, note) => saveNote("site", id, note)}
                />
              ))}
              {knowledgeDocs.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  deletingDocId={deletingDocId}
                  onRequestDelete={handleRequestDelete}
                  onSaveNote={(id, note) => saveNote("doc", id, note)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Tone / Style accordion card ───────────────────────────────── */}
      <div className="mb-4 rounded-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-sidebar-bg px-4 py-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white">Tone / Style</p>
            <HoverGuide onDark>
              <ToneGuide />
            </HoverGuide>
          </div>
          {toneCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-800">
              {toneCount}
            </span>
          )}
        </div>

        <div className="space-y-2 p-4">
          <AddSourceForm
            purpose="tone"
            workspaceId={workspaceId}
            urlPlaceholder="Blog post, LinkedIn post or article URL"
            onAdded={handleSourceAdded}
          />

          {isLoading ? (
            <LoadingRow />
          ) : toneCount > 0 ? (
            // Gap + divider so the list reads separately from the upload controls
            <div className="mt-5 border-t border-gray-100 pt-1">
              {toneSites.map((s) => (
                <SiteRow
                  key={s.id}
                  site={s}
                  recrawlingId={recrawlingId}
                  deletingSiteId={deletingSiteId}
                  onRecrawl={handleRecrawl}
                  onRequestDelete={handleRequestDelete}
                  onSaveNote={(id, note) => saveNote("site", id, note)}
                />
              ))}
              {toneDocs.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  deletingDocId={deletingDocId}
                  onRequestDelete={handleRequestDelete}
                  onSaveNote={(id, note) => saveNote("doc", id, note)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Audience & Length card (agent settings) ────────────────────── */}
      <AudienceLengthSection workspaceId={workspaceId} />

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          {totalCount} {totalCount === 1 ? "source" : "sources"} connected
        </p>
        <button
          onClick={onClose}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Done
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!confirmTarget}
        onClose={handleCancelDelete}
        title="Remove source"
        width="sm"
        disableBackdropClose
      >
        <p className="text-sm text-gray-600">Are you sure you want to remove</p>
        <p className="mt-1.5 break-all text-sm font-medium text-red-600">{confirmTarget?.name}</p>
        <p className="mt-2 text-sm text-gray-600">This cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={handleCancelDelete}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Remove
          </button>
        </div>
      </Modal>
    </Modal>
  );
}
