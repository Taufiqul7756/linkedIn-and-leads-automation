"use client";

import { useRef, useState } from "react";
import { LuLoader, LuRefreshCw, LuTrash2, LuUpload, LuUser, LuCheck } from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { agentService } from "@/service/agentService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
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
  const hasError = (site.status === "failed" || site.status === "error") && !!site.error;
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <TypeBadge type="www" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{site.url}</p>
          <p className="text-xs text-gray-400">crawled {timeAgo(site.created_at)}</p>
        </div>
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
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const toneFileInputRef = useRef<HTMLInputElement>(null);

  const [knowledgeUrlInput, setKnowledgeUrlInput] = useState("");
  const [toneUrlInput, setToneUrlInput] = useState("");
  const [addingKnowledgeUrl, setAddingKnowledgeUrl] = useState(false);
  const [addingToneUrl, setAddingToneUrl] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [uploadingKnowledgeDoc, setUploadingKnowledgeDoc] = useState(false);
  const [uploadingToneDoc, setUploadingToneDoc] = useState(false);
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

  const deleteProfileMutation = useMutationWithTokenRefresh(
    (id: string) => agentService(workspaceId).deleteProfile(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["linkedin-profiles", workspaceId] });
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

  const isLinkedInProfileUrl = (url: string) => /linkedin\.com\/in\//i.test(url);

  const handleAddUrl = async (purpose: DisplayPurpose) => {
    const isKnowledge = purpose === "knowledge";
    const url = (isKnowledge ? knowledgeUrlInput : toneUrlInput).trim();
    if (!url || !workspaceId) return;
    if (isKnowledge) setAddingKnowledgeUrl(true);
    else setAddingToneUrl(true);
    try {
      if (isKnowledge && isLinkedInProfileUrl(url)) {
        await agentService(workspaceId).createProfile(url);
        queryClient.invalidateQueries({ queryKey: ["linkedin-profiles", workspaceId] });
        toast.success("LinkedIn profile added.");
      } else {
        await agentService(workspaceId).addAgentWebsite(url, purpose, false);
        queryClient.invalidateQueries({ queryKey: ["agent-websites", workspaceId] });
        toast.success("Website added.");
      }
      if (isKnowledge) setKnowledgeUrlInput("");
      else setToneUrlInput("");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      if (isKnowledge) setAddingKnowledgeUrl(false);
      else setAddingToneUrl(false);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    purpose: DisplayPurpose
  ) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    e.target.value = "";
    const isKnowledge = purpose === "knowledge";
    if (isKnowledge) setUploadingKnowledgeDoc(true);
    else setUploadingToneDoc(true);
    try {
      await agentService(workspaceId).uploadAgentDocument(file, purpose, false);
      queryClient.invalidateQueries({ queryKey: ["agent-documents", workspaceId] });
      toast.success("Document uploaded.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      if (isKnowledge) setUploadingKnowledgeDoc(false);
      else setUploadingToneDoc(false);
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
          <p className="text-sm font-semibold text-white">Knowledge</p>
          {profiles.length + knowledgeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-800">
              {profiles.length + knowledgeCount}
            </span>
          )}
        </div>

        {/* Tip */}
        <p className="border-b border-gray-100 bg-blue-50/50 px-4 py-2.5 text-xs text-blue-600">
          Add your company website, product pages, LinkedIn profile, or documents — so the agent
          knows your brand, products, and story.
        </p>

        {/* Input fields */}
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://yourcompany.com or linkedin.com/in/username"
              value={knowledgeUrlInput}
              onChange={(e) => setKnowledgeUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl("knowledge")}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            />
            <button
              onClick={() => handleAddUrl("knowledge")}
              disabled={!knowledgeUrlInput.trim() || addingKnowledgeUrl}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {addingKnowledgeUrl && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
              Add
            </button>
          </div>

          <button
            onClick={() => knowledgeFileInputRef.current?.click()}
            disabled={uploadingKnowledgeDoc}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-300 hover:bg-gray-50 disabled:opacity-60"
          >
            {uploadingKnowledgeDoc ? (
              <LuLoader className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <LuUpload className="h-4 w-4 text-gray-400" />
            )}
            <span>Upload a document</span>
            <span className="text-xs text-gray-400">PDF only</span>
          </button>
          <input
            ref={knowledgeFileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFileChange(e, "knowledge")}
          />
        </div>

        {/* Source list */}
        {isLoading ? (
          <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-4 text-sm text-gray-400">
            <LuLoader className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : profiles.length > 0 || knowledgeCount > 0 ? (
          <div className="border-t border-gray-100 px-4">
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <LuUser className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{username}</p>
                    <p className="truncate text-xs text-blue-500">{p.profile_url}</p>
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
        ) : null}
      </div>

      {/* ── Tone / Style accordion card ───────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-sidebar-bg px-4 py-3">
          <p className="text-sm font-semibold text-white">Tone / Style</p>
          {toneCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-800">
              {toneCount}
            </span>
          )}
        </div>

        {/* Tip */}
        <p className="border-b border-gray-100 bg-violet-50/50 px-4 py-2.5 text-xs text-violet-600">
          Add writing samples — blog posts, LinkedIn posts, or documents — so the agent matches your
          voice and style.
        </p>

        {/* Input fields */}
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://example.com/writing-sample"
              value={toneUrlInput}
              onChange={(e) => setToneUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl("tone")}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            />
            <button
              onClick={() => handleAddUrl("tone")}
              disabled={!toneUrlInput.trim() || addingToneUrl}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {addingToneUrl && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
              Add
            </button>
          </div>

          <button
            onClick={() => toneFileInputRef.current?.click()}
            disabled={uploadingToneDoc}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-300 hover:bg-gray-50 disabled:opacity-60"
          >
            {uploadingToneDoc ? (
              <LuLoader className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <LuUpload className="h-4 w-4 text-gray-400" />
            )}
            <span>Upload a document</span>
            <span className="text-xs text-gray-400">PDF only</span>
          </button>
          <input
            ref={toneFileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFileChange(e, "tone")}
          />
        </div>

        {/* Source list */}
        {isLoading ? (
          <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-4 text-sm text-gray-400">
            <LuLoader className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : toneCount > 0 ? (
          <div className="border-t border-gray-100 px-4">
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
        ) : null}
      </div>

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
