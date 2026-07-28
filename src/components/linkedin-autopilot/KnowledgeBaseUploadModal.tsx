"use client";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LuUpload,
  LuFileText,
  LuX,
  LuCircleCheck,
  LuCircleAlert,
  LuLoader,
  LuTrash2,
} from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { documentService } from "@/service/documentService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { DocumentType } from "@/types/Document";
import { cn } from "@/utils/cn";
import { extractErrorMessage } from "@/utils/extractErrorMessage";

interface KnowledgeBaseUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function DocStatusIcon({ status }: { status: DocumentType["status"] }) {
  if (status === "ready") return <LuCircleCheck className="h-4 w-4 shrink-0 text-green-500" />;
  if (status === "error") return <LuCircleAlert className="h-4 w-4 shrink-0 text-red-400" />;
  return <LuLoader className="h-4 w-4 shrink-0 animate-spin text-amber-400" />;
}

function docStatusLabel(status: DocumentType["status"]) {
  if (status === "ready") return "Ready";
  if (status === "error") return "Error";
  if (status === "processing") return "Processing";
  if (status === "extracting") return "Extracting";
  return "Pending";
}

export default function KnowledgeBaseUploadModal({
  isOpen,
  onClose,
}: KnowledgeBaseUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const deleteDocument = useMutationWithTokenRefresh(
    (id: string) => documentService(workspaceId).deleteDocument(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
        toast.success("Document deleted.");
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error) || "Failed to delete document.");
      },
    }
  );

  const { data: docsData, isLoading: docsLoading } = useQueryWithTokenRefresh(
    ["documents", workspaceId],
    () => documentService(workspaceId).getDocuments(),
    {
      enabled: isOpen && !!workspaceId,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        const isProcessing = results.some(
          (d) => d.status === "pending" || d.status === "processing" || d.status === "extracting"
        );
        return isProcessing ? 4000 : false;
      },
    }
  );

  const uploadedDocs = docsData?.results ?? [];

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

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const results = await Promise.all(
        files.map((f) => documentService(workspaceId).uploadDocument(f, "knowledge"))
      );
      const failed = results.filter((r) => !r).length;
      if (failed === 0) {
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded!`);
      } else {
        toast.error(`${failed} file${failed > 1 ? "s" : ""} failed to upload.`);
      }
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to Knowledge Base" width="lg">
      {/* Upload zone */}
      <div className="mb-5">
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
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 transition-colors",
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <LuUpload className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Drop PDFs here or <span className="text-blue-600 hover:underline">browse</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-400">PDF only · multiple files supported</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

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
      </div>

      {files.length > 0 && (
        <div className="mb-5 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading
              ? `Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`
              : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Uploaded documents */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Uploaded documents
          {docsData?.count ? (
            <span className="ml-1.5 font-normal normal-case text-gray-400">({docsData.count})</span>
          ) : null}
        </label>

        {docsLoading ? (
          <p className="py-4 text-center text-xs text-gray-400">Loading...</p>
        ) : uploadedDocs.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No documents uploaded yet.</p>
        ) : (
          <ul className="max-h-52 space-y-2 overflow-y-auto">
            {uploadedDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <DocStatusIcon status={doc.status} />
                <span className="flex-1 truncate text-xs font-medium text-gray-700">
                  {doc.filename}
                </span>
                {doc.num_pages && (
                  <span className="shrink-0 text-xs text-gray-400">{doc.num_pages}p</span>
                )}
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium",
                    doc.status === "ready" && "text-green-600",
                    doc.status === "error" && "text-red-400",
                    (doc.status === "pending" ||
                      doc.status === "processing" ||
                      doc.status === "extracting") &&
                      "text-amber-500"
                  )}
                >
                  {docStatusLabel(doc.status)}
                </span>
                <button
                  onClick={() => deleteDocument.mutate(doc.id)}
                  disabled={deleteDocument.isPending}
                  className="ml-1 shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-40"
                  title="Delete document"
                >
                  <LuTrash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
