"use client";

import { useState } from "react";
import { LuChevronLeft, LuChevronRight, LuLoader, LuUndo2 } from "react-icons/lu";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import type { PostVersion } from "@/types/LinkedInAgent";

const SOURCE_LABEL: Record<string, string> = {
  agent_chat: "Edited in chat",
  editor: "Edited in post management",
  regenerate: "Regenerated",
  restore: "Restored",
  image_chat: "Image updated",
};

function sourceLabel(v: PostVersion): string {
  if (v.source === "restore" && v.restored_from != null) {
    return `Restored from v${v.restored_from}`;
  }
  if (v.number === 1 && !SOURCE_LABEL[v.source]) return "Generated";
  return SOURCE_LABEL[v.source] ?? v.source.replace(/_/g, " ");
}

function formatVersionDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface VersionHistoryModalProps {
  workspaceId: string;
  // null = closed
  postId: string | null;
  // e.g. "Post 1" — shown in the title
  postLabel: string;
  isPublished: boolean;
  restoreDisabled: boolean;
  // Resolves true on success — the modal closes so the new chat card is visible
  onRestore: (postId: string, version: number) => Promise<boolean>;
  onClose: () => void;
}

export default function VersionHistoryModal({
  workspaceId,
  postId,
  postLabel,
  isPublished,
  restoreDisabled,
  onRestore,
  onClose,
}: VersionHistoryModalProps) {
  const [page, setPage] = useState(1);
  // Several rows can be open at once so the user can compare versions side by side
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [restoring, setRestoring] = useState<number | null>(null);

  const { data, isLoading, isError } = useQueryWithTokenRefresh(
    ["post-versions", workspaceId, postId, page],
    () => linkedinAgentService(workspaceId).getPostVersions(postId!, page),
    { enabled: !!workspaceId && !!postId }
  );

  if (!postId) return null;

  const handleRestore = async (version: number) => {
    setRestoring(version);
    const ok = await onRestore(postId, version);
    setRestoring(null);
    if (ok) onClose();
  };

  const versions = data?.results ?? [];

  return (
    <Modal isOpen onClose={onClose} title={`Version history · ${postLabel}`} width="3xl">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LuLoader className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-gray-400">Couldn&apos;t load versions.</p>
      ) : versions.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No versions yet.</p>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => {
            const isOpen = expanded.has(v.number);
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-xl border p-3",
                  v.is_current ? "border-blue-200 bg-blue-50/40" : "border-gray-200 bg-white"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      v{v.number}
                    </span>
                    {v.is_current && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        Current
                      </span>
                    )}
                    <span className="truncate text-xs font-medium text-gray-700">
                      {sourceLabel(v)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatVersionDate(v.created_at)}
                  </span>
                </div>

                {v.note && v.source !== "restore" && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    <span className="font-semibold text-gray-600">Prompt:</span>{" "}
                    <span className="italic">&ldquo;{v.note}&rdquo;</span>
                  </p>
                )}

                <div className="mt-2 flex gap-3">
                  {v.media_type !== "video" && v.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.image_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <p
                    className={cn(
                      "min-w-0 flex-1 whitespace-pre-line text-xs leading-relaxed text-gray-600",
                      !isOpen && "line-clamp-3"
                    )}
                  >
                    {v.headline ? `${v.headline}\n\n${v.body}` : v.body}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(v.number)) next.delete(v.number);
                        else next.add(v.number);
                        return next;
                      })
                    }
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    {isOpen ? "Show less" : "Show full post"}
                  </button>
                  {!v.is_current && !isPublished && (
                    <button
                      onClick={() => handleRestore(v.number)}
                      disabled={restoreDisabled || restoring !== null}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {restoring === v.number ? (
                        <LuLoader className="h-3 w-3 animate-spin" />
                      ) : (
                        <LuUndo2 className="h-3 w-3" />
                      )}
                      Use this version
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(data?.previous || data?.next) && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!data?.previous}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            title="Newer"
          >
            <LuChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data?.next}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            title="Older"
          >
            <LuChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </Modal>
  );
}
