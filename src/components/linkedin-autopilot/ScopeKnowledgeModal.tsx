"use client";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LuLink,
  LuUpload,
  LuFileText,
  LuX,
  LuLoader,
  LuGlobe,
  LuCircleCheck,
  LuCircleAlert,
} from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { websiteService } from "@/service/websiteService";
import { documentService } from "@/service/documentService";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { WebsiteType } from "@/types/Website";
import type { DocumentType } from "@/types/Document";

interface ScopeKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: "corporate" | "personal";
}

function WebsiteStatusDot({ status }: { status: WebsiteType["status"] }) {
  const isPending = status === "pending" || status === "crawling";
  const colors: Record<WebsiteType["status"], string> = {
    ready: "bg-green-500",
    crawling: "bg-amber-400",
    pending: "bg-gray-300",
    error: "bg-red-400",
  };
  return (
    <span
      className={cn(
        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
        colors[status] ?? "bg-gray-300",
        isPending && "animate-pulse"
      )}
    />
  );
}

function WebsiteStatusLabel({ status }: { status: WebsiteType["status"] }) {
  const labels: Record<WebsiteType["status"], string> = {
    ready: "Ready",
    crawling: "Crawling…",
    pending: "Pending…",
    error: "Error",
  };
  const colors: Record<WebsiteType["status"], string> = {
    ready: "text-green-600",
    crawling: "text-amber-500",
    pending: "text-gray-400",
    error: "text-red-400",
  };
  return (
    <span className={cn("shrink-0 text-xs font-medium", colors[status] ?? "text-gray-400")}>
      {labels[status] ?? status}
    </span>
  );
}

function DocStatusIcon({ status }: { status: DocumentType["status"] }) {
  if (status === "ready") return <LuCircleCheck className="h-4 w-4 shrink-0 text-green-500" />;
  if (status === "error") return <LuCircleAlert className="h-4 w-4 shrink-0 text-red-400" />;
  return <LuLoader className="h-4 w-4 shrink-0 animate-spin text-amber-400" />;
}

function docStatusLabel(status: DocumentType["status"]) {
  if (status === "ready") return "Ready";
  if (status === "error") return "Error";
  if (status === "processing") return "Processing…";
  if (status === "extracting") return "Extracting…";
  return "Pending…";
}

function docStatusColor(status: DocumentType["status"]) {
  if (status === "ready") return "text-green-600";
  if (status === "error") return "text-red-400";
  return "text-amber-500";
}

export default function ScopeKnowledgeModal({ isOpen, onClose, scope }: ScopeKnowledgeModalProps) {
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  // Track IDs of websites submitted from this modal so we can toast on crawl completion.
  // Refs persist even when the modal is closed, so the toast fires even after dismissal.
  const pendingCrawlIds = useRef<Set<string>>(new Set());
  const prevStatusMap = useRef<Record<string, string>>({});

  const { data: websitesData } = useQueryWithTokenRefresh(
    ["websites", workspaceId],
    () => websiteService(workspaceId).getWebsites(),
    {
      refetchInterval: (query) => {
        if (pendingCrawlIds.current.size > 0) return 3000;
        const results = query.state.data?.results ?? [];
        const isCrawling = results.some(
          (s) => s.scope === scope && (s.status === "pending" || s.status === "crawling")
        );
        return isCrawling ? 3000 : false;
      },
    }
  );

  const { data: docsData } = useQueryWithTokenRefresh(
    ["documents", workspaceId],
    () => documentService(workspaceId).getDocuments(),
    {
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        const isProcessing = results.some(
          (d) =>
            d.scope === scope &&
            (d.status === "pending" || d.status === "processing" || d.status === "extracting")
        );
        return isProcessing ? 4000 : false;
      },
    }
  );

  // Fire a toast when a tracked website finishes crawling.
  useEffect(() => {
    if (!websitesData?.results) return;
    for (const site of websitesData.results) {
      if (!pendingCrawlIds.current.has(site.id)) continue;
      const prev = prevStatusMap.current[site.id];
      if (
        prev &&
        (prev === "pending" || prev === "crawling") &&
        (site.status === "ready" || site.status === "error")
      ) {
        if (site.status === "ready") {
          toast.success(`"${site.url}" indexed and ready.`);
        } else {
          toast.error(`Failed to crawl "${site.url}".`);
        }
        pendingCrawlIds.current.delete(site.id);
      }
      prevStatusMap.current[site.id] = site.status;
    }
  }, [websitesData]);

  const addWebsite = useMutationWithTokenRefresh(
    (websiteUrl: string) => websiteService(workspaceId).addWebsite(websiteUrl),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
        toast.success("Website added! Crawling in progress…");
        if (data) {
          pendingCrawlIds.current.add(data.id);
          prevStatusMap.current[data.id] = data.status;
        }
        setUrl("");
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error) || "Failed to add website.");
      },
    }
  );

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    addWebsite.mutate(trimmed);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      await Promise.all(
        files.map((f) => documentService(workspaceId).uploadDocument(f, "knowledge"))
      );
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded!`);
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const scopeLabel = scope === "corporate" ? "Corporate" : "Personal";
  const scopeWebsites = websitesData?.results?.filter((s) => s.scope === scope) ?? [];
  const scopeDocs = docsData?.results?.filter((d) => d.scope === scope) ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add ${scopeLabel} Knowledge`}
      width="lg"
      disableBackdropClose
    >
      {/* Info banner */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          You don&apos;t have any <strong>{scopeLabel.toLowerCase()}</strong> knowledge uploaded
          yet. Add a website or PDF below so we can generate {scopeLabel.toLowerCase()} posts for
          you.
        </p>
      </div>

      {/* Scope badge */}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Scope</span>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {scopeLabel}
        </span>
      </div>

      {/* ── Website URL ── */}
      <div className="mb-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Add Website URL
        </label>
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <LuLink className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              required
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={addWebsite.isPending || !url.trim()}
            className="flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {addWebsite.isPending ? <LuLoader className="h-4 w-4 animate-spin" /> : "Add"}
          </button>
        </form>
        <p className="mt-1.5 text-xs text-gray-400">
          We&apos;ll crawl this URL and notify you when it&apos;s ready — even if you close this
          panel.
        </p>

        {/* Website status list */}
        {scopeWebsites.length > 0 && (
          <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto">
            {scopeWebsites.map((site) => (
              <li
                key={site.id}
                className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <LuGlobe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium text-gray-700">{site.url}</span>
                  <div className="flex items-center gap-1.5">
                    <WebsiteStatusDot status={site.status} />
                    <WebsiteStatusLabel status={site.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs font-medium text-gray-400">or upload a PDF</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {/* ── PDF Upload ── */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Upload PDFs
        </label>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors",
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
            <LuUpload className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            Drop PDFs here or <span className="text-blue-600 hover:underline">browse</span>
          </p>
          <p className="text-xs text-gray-400">PDF only · multiple files supported</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Staged files */}
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((file, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <LuFileText className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="max-w-xs truncate text-xs font-medium text-gray-700">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{formatSize(file.size)}</span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  disabled={isUploading}
                  className="ml-2 shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-40"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading
                ? `Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`
                : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
            </button>
          </div>
        )}

        {/* Uploaded documents status list */}
        {scopeDocs.length > 0 && (
          <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto">
            {scopeDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <DocStatusIcon status={doc.status} />
                <span className="flex-1 truncate text-xs font-medium text-gray-700">
                  {doc.filename}
                </span>
                {doc.num_pages && (
                  <span className="shrink-0 text-xs text-gray-400">{doc.num_pages}p</span>
                )}
                <span className={cn("shrink-0 text-xs font-medium", docStatusColor(doc.status))}>
                  {docStatusLabel(doc.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
