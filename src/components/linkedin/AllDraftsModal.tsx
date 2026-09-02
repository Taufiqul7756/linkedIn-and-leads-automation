"use client";

import { useEffect, useState } from "react";
import {
  LuX,
  LuCheck,
  LuClock,
  LuPencil,
  LuChevronLeft,
  LuChevronRight,
  LuLoader,
} from "react-icons/lu";
import { cn } from "@/utils/cn";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import type { AgentPost, PaginatedAgentPosts, BlockNode, SpanNode } from "@/types/LinkedInAgent";

const PAGE_SIZE = 6;

// ─── helpers (duplicated from AutomationView to keep files independent) ───────

function formatSuggestedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}

function renderBodyText(blocksJson: string, fallback: string): string {
  try {
    const blocks: BlockNode[] = JSON.parse(blocksJson);
    if (Array.isArray(blocks) && blocks.length > 0) {
      return blocks
        .map((b) => {
          if (b.type === "paragraph") return b.spans.map((s: SpanNode) => s.text).join("");
          if (b.type === "list")
            return b.items.map((i) => i.spans.map((s: SpanNode) => s.text).join("")).join(" ");
          return "";
        })
        .join(" ");
    }
  } catch {
    // ignore
  }
  return fallback;
}

// ─── mini card (grid-friendly, no absolute-positioned overflow) ────────────────

function MiniCard({ post, onEdit }: { post: AgentPost; onEdit: (p: AgentPost) => void }) {
  const dateStr = formatSuggestedDate(post.suggested_publish_at);
  const bodyText = renderBodyText(post.body_blocks, post.body);

  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Image */}
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="" className="h-36 w-full object-cover" />
      )}

      <div className="relative flex flex-col flex-1 p-4">
        {/* Floating ✓ × — top-right, half outside */}
        <div className="absolute right-3 top-0 flex -translate-y-1/2 items-center gap-1.5">
          <button className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-500">
            <LuCheck className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-400">
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Title + badge */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            {post.headline || bodyText.slice(0, 60)}
          </p>
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            Draft
          </span>
        </div>

        {/* Time */}
        {dateStr && (
          <div className="mb-2 flex items-center gap-1 text-xs text-gray-400">
            <LuClock className="h-3 w-3 shrink-0" />
            <span>{dateStr}</span>
          </div>
        )}

        {/* Body */}
        <p className="flex-1 text-xs leading-relaxed text-gray-600 line-clamp-4">{bodyText}</p>

        {/* Edit pencil */}
        <button
          onClick={() => onEdit(post)}
          className="absolute bottom-3 right-3 text-gray-300 transition-colors hover:text-gray-600"
        >
          <LuPencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── main modal ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  conversationId: string | null;
  onEdit: (post: AgentPost) => void;
}

export default function AllDraftsModal({
  isOpen,
  onClose,
  workspaceId,
  conversationId,
  onEdit,
}: Props) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedAgentPosts | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    linkedinAgentService(workspaceId)
      .getAgentPosts({
        page,
        pageSize: PAGE_SIZE,
        status: "draft",
        conversationId: conversationId ?? undefined,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isOpen, workspaceId, conversationId, page]);

  // reset to page 1 when closed
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isOpen) setPage(1);
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;
  const pagedPosts = data?.results ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-4 flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">All drafts</h2>
            {data && <p className="text-xs text-gray-400">{data.count} total</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LuLoader className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : pagedPosts.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-400">No drafts found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedPosts.map((post) => (
                <MiniCard key={post.id} post={post} onEdit={onEdit} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {data && totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50",
                (page === 1 || loading) && "cursor-not-allowed opacity-40"
              )}
            >
              <LuChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <span className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-800">{page}</span> of{" "}
              <span className="font-semibold text-gray-800">{totalPages}</span>
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50",
                (page === totalPages || loading) && "cursor-not-allowed opacity-40"
              )}
            >
              Next
              <LuChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
