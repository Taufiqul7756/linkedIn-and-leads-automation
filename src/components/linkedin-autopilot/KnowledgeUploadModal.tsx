"use client";
import { useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { LuUpload, LuLink, LuX, LuFileText, LuLoader, LuTrash2 } from "react-icons/lu";
import Tooltip from "@/components/ui/Tooltip";
import toast from "react-hot-toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { documentService } from "@/service/documentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useQueryClient } from "@tanstack/react-query";

type SourceType = "knowledge" | "tune" | "style";

interface UploadedItem {
  id: string;
  name: string;
  kind: "file" | "url";
  type: SourceType;
  file?: File;
}

interface KnowledgeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: SourceType;
}

const TYPE_LABELS: Record<SourceType, string> = {
  knowledge: "Knowledge",
  tune: "Tone",
  style: "Style",
};

const TYPE_STYLES: Record<SourceType, string> = {
  knowledge: "bg-blue-100 text-blue-700",
  tune: "bg-violet-100 text-violet-700",
  style: "bg-teal-100 text-teal-700",
};

export default function KnowledgeUploadModal({
  isOpen,
  onClose,
  initialType = "knowledge",
}: KnowledgeUploadModalProps) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<SourceType>(initialType);
  const [urlInput, setUrlInput] = useState("");
  const [items, setItems] = useState<UploadedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTerminal = (s: string) => s === "ready" || s === "error" || s === "failed";

  const { data: existingDocs, isLoading: docsLoading } = useQueryWithTokenRefresh(
    ["documents", workspaceId],
    () => documentService(workspaceId).getDocuments(),
    {
      enabled: !!workspaceId && isOpen,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        return results.some((d) => !isTerminal(d.status)) ? 3000 : false;
      },
    }
  );

  const deleteMutation = useMutationWithTokenRefresh(
    (id: string) => documentService(workspaceId).deleteDocument(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
        toast.success("Document removed.");
        setDeletingId(null);
      },
      onError: (err: unknown) => {
        toast.error(extractErrorMessage(err));
        setDeletingId(null);
      },
    }
  );

  // Reset initialType when modal opens with a different step
  // (handled via key prop on parent — no useEffect needed)

  const addFile = (file: File) => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: file.name, kind: "file", type: selectedType, file },
    ]);
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, kind: "url", type: selectedType },
    ]);
    setUrlInput("");
    // API will come
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Sources" width="lg">
      {/* Type selector */}
      <div className="mb-5">
        <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          Source type
          <Tooltip
            text="Choose how this source will be used. You can add multiple sources of different types."
            position="bottom"
          />
        </label>
        <div className="flex gap-2">
          {(
            [
              {
                type: "knowledge" as SourceType,
                tip: "Facts about your business, products, or expertise. Grounds posts in your actual content.",
              },
              {
                type: "tune" as SourceType,
                tip: "Writing samples that define your voice — past posts, articles, or brand tone guides.",
              },
              {
                type: "style" as SourceType,
                tip: "Formatting references — how you structure posts, use line breaks, CTAs, or hashtags.",
              },
            ] as const
          ).map(({ type: t, tip }) => (
            <span key={t} className="relative flex-1">
              <button
                onClick={() => setSelectedType(t)}
                className={`w-full rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  selectedType === t
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
              <span className="absolute right-1.5 top-1.5">
                <Tooltip
                  text={tip}
                  position="bottom"
                  width="w-56"
                  align={t === "style" ? "right" : t === "knowledge" ? "left" : "center"}
                />
              </span>
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          {selectedType === "knowledge" &&
            "Upload documents or URLs that describe your business, products, or expertise."}
          {selectedType === "tune" &&
            "Upload content that defines your writing style and tone of voice."}
          {selectedType === "style" &&
            "Upload style guides, brand guidelines, or formatting references."}
        </p>
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

      {/* Existing uploaded documents */}
      {(docsLoading || (existingDocs?.results?.length ?? 0) > 0) && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">Uploaded documents</p>
          {docsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <LuLoader className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : (
            <ul className="space-y-2">
              {existingDocs!.results.map((doc) => {
                const purposeKey = doc.purpose === "tone" ? "tune" : doc.purpose;
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
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TYPE_STYLES[purposeKey as SourceType]}`}
                    >
                      {TYPE_LABELS[purposeKey as SourceType]}
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
                    {deletingId === doc.id ? (
                      <LuLoader className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
                    ) : (
                      <button
                        onClick={() => {
                          setDeletingId(doc.id);
                          deleteMutation.mutate(doc.id);
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

      {/* Items list */}
      {items.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">Added sources</p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                {item.kind === "file" ? (
                  <LuFileText className="h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <LuLink className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{item.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TYPE_STYLES[item.type]}`}
                >
                  {TYPE_LABELS[item.type]}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
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
          onClick={async () => {
            if (!workspaceId || isSaving) return;
            setIsSaving(true);
            try {
              const fileItems = items.filter((i) => i.kind === "file" && i.file);
              const urlItems = items.filter((i) => i.kind === "url");

              // Upload each PDF
              await Promise.all(
                fileItems.map((item) => {
                  const purpose =
                    item.type === "tune" ? "tone" : (item.type as "knowledge" | "tone" | "style");
                  return documentService(workspaceId).uploadDocument(item.file!, purpose);
                })
              );

              // URL items — log for now until API is ready
              if (urlItems.length > 0) {
                console.log(
                  "URL sources (pending API):",
                  urlItems.map((i) => ({ url: i.name, type: i.type === "tune" ? "tone" : i.type }))
                );
              }

              queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
              toast.success(
                fileItems.length > 0
                  ? `${fileItems.length} document${fileItems.length > 1 ? "s" : ""} uploaded successfully.`
                  : "Sources saved."
              );
              setItems([]);
            } catch (err) {
              toast.error(extractErrorMessage(err));
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={items.length === 0 || isSaving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
          {isSaving ? "Uploading…" : "Save sources"}
        </button>
      </div>
    </Modal>
  );
}
