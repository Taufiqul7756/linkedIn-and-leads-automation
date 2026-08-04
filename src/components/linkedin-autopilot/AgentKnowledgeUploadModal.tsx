"use client";
import { useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { LuUpload, LuLink, LuX, LuFileText, LuLoader, LuTrash2, LuGlobe } from "react-icons/lu";
import Tooltip from "@/components/ui/Tooltip";
import toast from "react-hot-toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { agentService } from "@/service/agentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useQueryClient } from "@tanstack/react-query";

// Stepper passes "tune" for the Tone step; agent API uses "tone"
type StepType = "knowledge" | "tune" | "style";
type AgentPurpose = "knowledge" | "tone" | "style";

interface PendingItem {
  id: string;
  name: string;
  kind: "file" | "url";
  purpose: AgentPurpose;
  file?: File;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialType?: StepType;
}

const STEP_TO_PURPOSE: Record<StepType, AgentPurpose> = {
  knowledge: "knowledge",
  tune: "tone",
  style: "style",
};

const PURPOSE_LABELS: Record<AgentPurpose, string> = {
  knowledge: "Knowledge",
  tone: "Tone",
  style: "Style",
};

const PURPOSE_STYLES: Record<AgentPurpose, string> = {
  knowledge: "bg-blue-100 text-blue-700",
  tone: "bg-violet-100 text-violet-700",
  style: "bg-teal-100 text-teal-700",
};

const TIPS: Record<AgentPurpose, string> = {
  knowledge:
    "Facts about your business, products, or expertise. Grounds posts in your actual content.",
  tone: "Writing samples that define your voice — past posts, articles, or brand tone guides.",
  style: "Formatting references — how you structure posts, use line breaks, CTAs, or hashtags.",
};

const DESCRIPTIONS: Record<AgentPurpose, string> = {
  knowledge: "Upload documents or URLs that describe your business, products, or expertise.",
  tone: "Upload content that defines your writing style and tone of voice.",
  style: "Upload style guides, brand guidelines, or formatting references.",
};

export default function AgentKnowledgeUploadModal({
  isOpen,
  onClose,
  initialType = "knowledge",
}: Props) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();

  const [selectedPurpose, setSelectedPurpose] = useState<AgentPurpose>(
    STEP_TO_PURPOSE[initialType]
  );
  const [urlInput, setUrlInput] = useState("");
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTerminal = (s: string) => s === "ready" || s === "error" || s === "failed";

  // Agent docs — poll every 3 s while any item is non-terminal
  const { data: agentDocsData, isLoading: docsLoading } = useQueryWithTokenRefresh(
    ["agent-documents", workspaceId],
    () => agentService(workspaceId).getAgentDocuments(),
    {
      enabled: !!workspaceId && isOpen,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        return results.some((d) => !isTerminal(d.status)) ? 3000 : false;
      },
    }
  );
  const agentDocs = agentDocsData?.results ?? [];

  // Agent websites — poll every 3 s while any item is non-terminal
  const { data: agentSitesData, isLoading: sitesLoading } = useQueryWithTokenRefresh(
    ["agent-websites", workspaceId],
    () => agentService(workspaceId).getAgentWebsites(),
    {
      enabled: !!workspaceId && isOpen,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        return results.some((s) => !isTerminal(s.status)) ? 3000 : false;
      },
    }
  );
  const agentSites = agentSitesData?.results ?? [];

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

  const addFile = (file: File) => {
    setPending((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: file.name, kind: "file", purpose: selectedPurpose, file },
    ]);
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setPending((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, kind: "url", purpose: selectedPurpose },
    ]);
    setUrlInput("");
  };

  const removePending = (id: string) => setPending((prev) => prev.filter((i) => i.id !== id));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") addFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addFile(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!workspaceId || isSaving || pending.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(
        pending.map((item) => {
          if (item.kind === "file" && item.file) {
            return agentService(workspaceId).uploadAgentDocument(item.file, item.purpose);
          }
          return agentService(workspaceId).addAgentWebsite(item.name, item.purpose);
        })
      );

      queryClient.invalidateQueries({ queryKey: ["agent-documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["agent-websites", workspaceId] });

      const fileCount = pending.filter((i) => i.kind === "file").length;
      const urlCount = pending.filter((i) => i.kind === "url").length;
      const parts: string[] = [];
      if (fileCount > 0) parts.push(`${fileCount} document${fileCount > 1 ? "s" : ""}`);
      if (urlCount > 0) parts.push(`${urlCount} website${urlCount > 1 ? "s" : ""}`);
      toast.success(`${parts.join(" and ")} added.`);

      setPending([]);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const isExistingLoading = docsLoading || sitesLoading;
  const hasExisting = agentDocs.length > 0 || agentSites.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Agent Sources" width="lg">
      {/* Purpose selector */}
      <div className="mb-5">
        <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          Source type
          <Tooltip
            text="Choose how this source will be used. You can add multiple sources of different types."
            position="bottom"
          />
        </label>
        <div className="flex gap-2">
          {(["knowledge", "tone", "style"] as AgentPurpose[]).map((p) => (
            <span key={p} className="relative flex-1">
              <button
                onClick={() => setSelectedPurpose(p)}
                className={`w-full rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  selectedPurpose === p
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {PURPOSE_LABELS[p]}
              </button>
              <span className="absolute right-1.5 top-1.5">
                <Tooltip
                  text={TIPS[p]}
                  position="bottom"
                  width="w-56"
                  align={p === "style" ? "right" : p === "knowledge" ? "left" : "center"}
                />
              </span>
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{DESCRIPTIONS[selectedPurpose]}</p>
      </div>

      {/* PDF upload */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Upload PDF</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
          }`}
        >
          <LuUpload className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500">
            Drag & drop a PDF, or <span className="font-medium text-blue-600">browse</span>
          </p>
          <p className="text-xs text-gray-400">PDF files only</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* URL input */}
      <div className="mb-5">
        <label className="mb-2 block text-sm font-medium text-gray-700">Add URL</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LuLink className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              placeholder="https://example.com/page"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Existing agent sources */}
      {(isExistingLoading || hasExisting) && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">Agent sources</p>
          {isExistingLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <LuLoader className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : (
            <ul className="space-y-2">
              {agentDocs.map((doc) => {
                const p = (doc.purpose === "tone" ? "tone" : doc.purpose) as AgentPurpose;
                const processing = !isTerminal(doc.status);
                return (
                  <li
                    key={doc.id}
                    className={`flex items-center gap-3 overflow-hidden rounded-lg border px-3 py-2.5 ${
                      processing
                        ? "animate-shimmer-card border-blue-200"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    <LuFileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {doc.filename}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PURPOSE_STYLES[p] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {PURPOSE_LABELS[p] ?? doc.purpose}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        doc.status === "ready"
                          ? "bg-teal-100 text-teal-700"
                          : doc.status === "error" || doc.status === "failed"
                            ? "bg-red-100 text-red-600"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {doc.status}
                    </span>
                    {deletingDocId === doc.id ? (
                      <LuLoader className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
                    ) : (
                      <button
                        onClick={() => {
                          setDeletingDocId(doc.id);
                          deleteDocMutation.mutate(doc.id);
                        }}
                        className="shrink-0 text-gray-300 transition-colors hover:text-red-400"
                      >
                        <LuTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}

              {agentSites.map((site) => {
                const p = (site.purpose ?? "knowledge") as AgentPurpose;
                const crawling = !isTerminal(site.status);
                return (
                  <li
                    key={site.id}
                    className={`flex items-center gap-3 overflow-hidden rounded-lg border px-3 py-2.5 ${
                      crawling
                        ? "animate-shimmer-card border-blue-200"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    <LuGlobe className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {site.url}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PURPOSE_STYLES[p] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {PURPOSE_LABELS[p] ?? site.purpose}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        site.status === "ready"
                          ? "bg-teal-100 text-teal-700"
                          : site.status === "error" || site.status === "failed"
                            ? "bg-red-100 text-red-600"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {site.status}
                    </span>
                    {deletingSiteId === site.id ? (
                      <LuLoader className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
                    ) : (
                      <button
                        onClick={() => {
                          setDeletingSiteId(site.id);
                          deleteSiteMutation.mutate(site.id);
                        }}
                        className="shrink-0 text-gray-300 transition-colors hover:text-red-400"
                      >
                        <LuTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Pending items to be saved */}
      {pending.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">Ready to add</p>
          <ul className="space-y-2">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5"
              >
                {item.kind === "file" ? (
                  <LuFileText className="h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <LuLink className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{item.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PURPOSE_STYLES[item.purpose]}`}
                >
                  {PURPOSE_LABELS[item.purpose]}
                </span>
                <button
                  onClick={() => removePending(item.id)}
                  className="shrink-0 text-gray-300 transition-colors hover:text-red-400"
                >
                  <LuX className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          disabled={pending.length === 0 || isSaving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
          {isSaving ? "Saving…" : "Save sources"}
        </button>
      </div>
    </Modal>
  );
}
