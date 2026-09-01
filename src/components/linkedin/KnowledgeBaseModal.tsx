"use client";

import { useRef, useState } from "react";
import { FaLinkedinIn } from "react-icons/fa";
import { LuChevronDown, LuLoader, LuRefreshCw, LuTrash2, LuUpload } from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { agentService } from "@/service/agentService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { ProfileDocument, ProfileWebsite } from "@/types/Agent";

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

function getDocType(filename: string): "PDF" | "DOCX" | "TXT" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (ext === "docx" || ext === "doc") return "DOCX";
  return "TXT";
}

// ─── small display components ─────────────────────────────────────────────────

function TypeBadge({ type }: { type: "www" | "PDF" | "DOCX" | "TXT" }) {
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

function PurposeDropdown({ value }: { value: string }) {
  return (
    <div className="relative shrink-0">
      <select
        value={isTone(value) ? "tone" : "knowledge"}
        onChange={() => {}}
        className="appearance-none rounded border border-gray-200 bg-white py-1 pl-2.5 pr-6 text-xs font-medium text-gray-700 outline-none"
      >
        <option value="knowledge">Knowledge</option>
        <option value="tone">Tone / style</option>
      </select>
      <LuChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

// ─── SiteRow and DocRow are defined outside to avoid remounting ───────────────

interface SiteRowProps {
  site: ProfileWebsite;
  recrawlingId: string | null;
  deletingSiteId: string | null;
  onRecrawl: (id: string) => void;
  onRequestDelete: (id: string, name: string, kind: "site" | "doc") => void;
}
function SiteRow({ site, recrawlingId, deletingSiteId, onRecrawl, onRequestDelete }: SiteRowProps) {
  const isRecrawling = recrawlingId === site.id;
  const isDeleting = deletingSiteId === site.id;
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0">
      <TypeBadge type="www" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{site.url}</p>
        <p className="text-xs text-gray-400">crawled {timeAgo(site.created_at)}</p>
      </div>
      <PurposeDropdown value={site.purpose} />
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
  );
}

interface DocRowProps {
  doc: ProfileDocument;
  deletingDocId: string | null;
  onRequestDelete: (id: string, name: string, kind: "site" | "doc") => void;
}
function DocRow({ doc, deletingDocId, onRequestDelete }: DocRowProps) {
  const isDeleting = deletingDocId === doc.id;
  const type = getDocType(doc.filename);
  const meta = doc.num_pages > 0 ? `${type} · ${doc.num_pages} pages` : type;
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0">
      <TypeBadge type={type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{doc.filename}</p>
        <p className="text-xs text-gray-400">{meta}</p>
      </div>
      <PurposeDropdown value={doc.purpose} />
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

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeBaseModal({ isOpen, onClose }: Props) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlInput, setUrlInput] = useState("");
  const [urlPurpose, setUrlPurpose] = useState<DisplayPurpose>("knowledge");
  const [profileInput, setProfileInput] = useState("");
  const [docPurpose, setDocPurpose] = useState<DisplayPurpose>("knowledge");
  const [addingUrl, setAddingUrl] = useState(false);
  const [addingProfile, setAddingProfile] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    name: string;
    kind: "site" | "doc";
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

  const docs: ProfileDocument[] =
    (docsData as { results?: ProfileDocument[] } | undefined)?.results ?? [];
  const sites: ProfileWebsite[] =
    (sitesData as { results?: ProfileWebsite[] } | undefined)?.results ?? [];

  const knowledgeSites = sites.filter((s) => !isTone(s.purpose));
  const knowledgeDocs = docs.filter((d) => !isTone(d.purpose));
  const toneSites = sites.filter((s) => isTone(s.purpose));
  const toneDocs = docs.filter((d) => isTone(d.purpose));
  const knowledgeCount = knowledgeSites.length + knowledgeDocs.length;
  const toneCount = toneSites.length + toneDocs.length;
  const totalCount = docs.length + sites.length;

  const deleteDocMutation = useMutationWithTokenRefresh(
    (id: string) => agentService(workspaceId).deleteAgentDocument(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["agent-documents", workspaceId] });
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
        toast.success("Website removed.");
        setDeletingSiteId(null);
      },
      onError: (err: unknown) => {
        toast.error(extractErrorMessage(err));
        setDeletingSiteId(null);
      },
    }
  );

  const handleCrawlSite = async () => {
    const url = urlInput.trim();
    if (!url || !workspaceId) return;
    setAddingUrl(true);
    try {
      await agentService(workspaceId).addAgentWebsite(url, urlPurpose, false);
      queryClient.invalidateQueries({ queryKey: ["agent-websites", workspaceId] });
      setUrlInput("");
      toast.success("Website added.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAddingUrl(false);
    }
  };

  const handleAddProfile = async () => {
    const url = profileInput.trim();
    if (!url || !workspaceId) return;
    setAddingProfile(true);
    try {
      await agentService(workspaceId).addAgentWebsite(url, "knowledge", false);
      queryClient.invalidateQueries({ queryKey: ["agent-websites", workspaceId] });
      setProfileInput("");
      toast.success("LinkedIn profile added.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAddingProfile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    e.target.value = "";
    setUploadingDoc(true);
    try {
      await agentService(workspaceId).uploadAgentDocument(file, docPurpose, false);
      queryClient.invalidateQueries({ queryKey: ["agent-documents", workspaceId] });
      toast.success("Document uploaded.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUploadingDoc(false);
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

  const handleRequestDelete = (id: string, name: string, kind: "site" | "doc") =>
    setConfirmTarget({ id, name, kind });

  const handleCancelDelete = () => setConfirmTarget(null);

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "site") {
      setDeletingSiteId(confirmTarget.id);
      deleteSiteMutation.mutate(confirmTarget.id);
    } else {
      setDeletingDocId(confirmTarget.id);
      deleteDocMutation.mutate(confirmTarget.id);
    }
    setConfirmTarget(null);
  };

  const isLoading = docsLoading || sitesLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Knowledge base" width="2xl">
      <p className="mb-5 -mt-1 text-sm text-gray-500">
        Add sources and flag each as Knowledge or Tone / style — the agent uses both.
      </p>

      {/* Website URL row */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="url"
          placeholder="https://yourcompany.com"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCrawlSite()}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
        <div className="relative shrink-0">
          <select
            value={urlPurpose}
            onChange={(e) => setUrlPurpose(e.target.value as DisplayPurpose)}
            className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-gray-700 outline-none"
          >
            <option value="knowledge">Knowledge</option>
            <option value="tone">Tone / style</option>
          </select>
          <LuChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>
        <button
          onClick={handleCrawlSite}
          disabled={!urlInput.trim() || addingUrl}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {addingUrl && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
          Crawl site
        </button>
      </div>

      {/* LinkedIn profile row */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="linkedin.com/in/username"
          value={profileInput}
          onChange={(e) => setProfileInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddProfile()}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
        <button
          onClick={handleAddProfile}
          disabled={!profileInput.trim() || addingProfile}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {addingProfile ? (
            <LuLoader className="h-4 w-4 animate-spin" />
          ) : (
            <FaLinkedinIn className="h-4 w-4" />
          )}
          Add profile
        </button>
      </div>

      {/* Document upload row */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingDoc}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-300 hover:bg-gray-50 disabled:opacity-60"
        >
          {uploadingDoc ? (
            <LuLoader className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <LuUpload className="h-4 w-4 text-gray-400" />
          )}
          <span>Upload a document</span>
          <span className="text-xs text-gray-400">PDF, DOCX, TXT</span>
        </button>
        <div className="relative shrink-0">
          <select
            value={docPurpose}
            onChange={(e) => setDocPurpose(e.target.value as DisplayPurpose)}
            className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-gray-700 outline-none"
          >
            <option value="knowledge">Knowledge</option>
            <option value="tone">Tone / style</option>
          </select>
          <LuChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Source lists */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
          <LuLoader className="h-4 w-4 animate-spin" />
          Loading sources…
        </div>
      ) : totalCount === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          No sources yet. Add a website, profile, or document above.
        </p>
      ) : (
        <div className="space-y-5">
          {knowledgeCount > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Knowledge · {knowledgeCount}
              </p>
              <div className="rounded-xl border border-gray-100 px-4">
                {knowledgeSites.map((s) => (
                  <SiteRow
                    key={s.id}
                    site={s}
                    recrawlingId={recrawlingId}
                    deletingSiteId={deletingSiteId}
                    onRecrawl={handleRecrawl}
                    onRequestDelete={handleRequestDelete}
                  />
                ))}
                {knowledgeDocs.map((d) => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    deletingDocId={deletingDocId}
                    onRequestDelete={handleRequestDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {toneCount > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Tone / Style · {toneCount}
              </p>
              <div className="rounded-xl border border-gray-100 px-4">
                {toneSites.map((s) => (
                  <SiteRow
                    key={s.id}
                    site={s}
                    recrawlingId={recrawlingId}
                    deletingSiteId={deletingSiteId}
                    onRecrawl={handleRecrawl}
                    onRequestDelete={handleRequestDelete}
                  />
                ))}
                {toneDocs.map((d) => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    deletingDocId={deletingDocId}
                    onRequestDelete={handleRequestDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          {totalCount} {totalCount === 1 ? "source" : "sources"} connected
        </p>
        <button
          onClick={onClose}
          className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
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
        <p className="text-sm text-gray-600">
          Are you sure you want to remove{" "}
          <span className="font-medium text-gray-900">{confirmTarget?.name}</span>? This cannot be
          undone.
        </p>
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
