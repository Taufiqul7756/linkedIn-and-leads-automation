"use client";

import React, { useEffect, useState } from "react";
import {
  LuX,
  LuCheck,
  LuClock,
  LuPencil,
  LuChevronLeft,
  LuChevronRight,
  LuAlignLeft,
  LuImage,
  LuLoader,
} from "react-icons/lu";
import { cn } from "@/utils/cn";
import type { AgentPost, BlockNode, SpanNode } from "@/types/LinkedInAgent";

const PAGE_SIZE = 6;

// ─── helpers (duplicated from AutomationView to keep files independent) ───────

function formatSuggestedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}

type TiptapInline = { type: string; text?: string; marks?: { type: string }[] };
type TiptapNode = { type: string; attrs?: Record<string, unknown>; content?: unknown[] };

function renderBlocks(blocksInput: unknown, fallback: string): React.ReactNode {
  // New Tiptap doc format
  if (blocksInput && typeof blocksInput === "object" && !Array.isArray(blocksInput)) {
    const doc = blocksInput as { type?: string; content?: unknown[] };
    if (doc.type === "doc" && Array.isArray(doc.content) && doc.content.length > 0) {
      return renderTiptapNodes(doc.content);
    }
    return <span>{fallback}</span>;
  }

  // Legacy array or string
  let blocks: BlockNode[] = [];
  if (Array.isArray(blocksInput)) {
    blocks = blocksInput as BlockNode[];
  } else if (typeof blocksInput === "string") {
    try {
      const parsed = JSON.parse(blocksInput);
      if (parsed?.type === "doc" && Array.isArray(parsed.content) && parsed.content.length > 0) {
        return renderTiptapNodes(parsed.content);
      }
      if (Array.isArray(parsed) && parsed.length > 0) blocks = parsed;
    } catch {
      /* ignore */
    }
  }
  if (blocks.length === 0) return <span>{fallback}</span>;
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "paragraph") {
          return (
            <p key={i} className={i > 0 ? "mt-2" : undefined}>
              {block.spans.map((s: SpanNode, j: number) =>
                s.bold ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>
              )}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className={i > 0 ? "mt-2 space-y-1" : "space-y-1"}>
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-1">
                  <span className="shrink-0 text-gray-400">{block.marker}</span>
                  <span>
                    {item.spans.map((s: SpanNode, k: number) =>
                      s.bold ? <strong key={k}>{s.text}</strong> : <span key={k}>{s.text}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </>
  );
}

function renderTiptapNodes(nodes: unknown[]): React.ReactNode {
  return (
    <>
      {(nodes as TiptapNode[]).map((node, i) => {
        if (node.type === "paragraph") {
          const inlines = (node.content ?? []) as TiptapInline[];
          return (
            <p key={i} className={i > 0 ? "mt-2" : undefined}>
              {inlines.map((inline, j) =>
                inline.marks?.some((m) => m.type === "bold") ? (
                  <strong key={j}>{inline.text}</strong>
                ) : (
                  <span key={j}>{inline.text}</span>
                )
              )}
            </p>
          );
        }
        if (node.type === "bulletList") {
          const marker = (node.attrs?.marker as string) ?? "•";
          const items = (node.content ?? []) as TiptapNode[];
          return (
            <ul key={i} className={i > 0 ? "mt-2 space-y-1" : "space-y-1"}>
              {items.map((item, j) => {
                const para = ((item.content ?? []) as TiptapNode[])[0];
                const inlines = (para?.content ?? []) as TiptapInline[];
                return (
                  <li key={j} className="flex gap-1">
                    <span className="shrink-0 text-gray-400">{marker}</span>
                    <span>
                      {inlines.map((inline, k) =>
                        inline.marks?.some((m) => m.type === "bold") ? (
                          <strong key={k}>{inline.text}</strong>
                        ) : (
                          <span key={k}>{inline.text}</span>
                        )
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return null;
      })}
    </>
  );
}

// ─── card (matches DraftCard design in AutomationView) ────────────────────────

function MiniCard({
  post,
  onEdit,
  onApprove,
  onReject,
}: {
  post: AgentPost;
  onEdit: (p: AgentPost) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const dateStr = formatSuggestedDate(post.suggested_publish_at);
  const isVideoActive = post.media_type === "video";
  const hasImage = !!post.image_url;
  const hasVideo = !!post.video_url;

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    approved: { label: "Approved", cls: "bg-green-100 text-green-700" },
    scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-700" },
    published: { label: "Published", cls: "bg-emerald-100 text-emerald-700" },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
    draft: { label: "Draft", cls: "bg-violet-100 text-violet-700" },
  };
  const badge = STATUS_BADGE[post.status] ?? STATUS_BADGE.draft;

  const isDraft = post.status === "draft";

  return (
    <div className="group relative h-72 w-full">
      {/* Floating approve / reject — top right, half outside */}
      {isDraft && (
        <div className="absolute right-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5">
          <button
            onClick={() => onApprove(post.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-500"
            title="Approve"
          >
            <LuCheck className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onReject(post.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-400"
            title="Delete"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Card */}
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-4",
          post.status === "draft" ? "border-gray-200" : "border-green-200"
        )}
      >
        {/* Title row */}
        <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
          {post.headline ? (
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
              {post.headline}
            </p>
          ) : (
            <span />
          )}
          <span
            className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", badge.cls)}
          >
            {badge.label}
          </span>
        </div>

        {/* Time */}
        {dateStr && (
          <div className="mb-2 flex shrink-0 items-center gap-1 text-xs text-gray-400">
            <LuClock className="h-3 w-3 shrink-0" />
            <span>{dateStr}</span>
            <button
              onClick={() => onEdit(post)}
              className="text-gray-400 transition-colors hover:text-blue-500"
              title="Edit suggested time"
            >
              <LuPencil className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Media */}
        {isVideoActive ? (
          hasVideo ? (
            <div className="mb-2 flex h-24 shrink-0 overflow-hidden rounded-xl">
              <video src={post.video_url} className="h-full w-full object-cover" />
            </div>
          ) : null
        ) : post.image_status === "pending" ? (
          <div className="mb-2 flex h-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-blue-200 bg-blue-50">
            <div className="flex flex-col items-center gap-1">
              <LuLoader className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-[10px] text-blue-400">Generating image…</span>
            </div>
          </div>
        ) : hasImage ? (
          <div className="mb-2 flex h-24 shrink-0 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-hidden pb-8 text-xs leading-relaxed text-gray-600">
          {post.image_status === "pending" || hasImage || hasVideo ? (
            <p className="line-clamp-3">{post.body}</p>
          ) : (
            renderBlocks(post.body_blocks, post.body)
          )}
        </div>

        {/* Hover action buttons */}
        {post.status !== "published" && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onEdit(post)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <LuAlignLeft className="h-3 w-3" />
              Edit text
            </button>
            <button
              onClick={() => onEdit(post)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <LuImage className="h-3 w-3" />
              Edit image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── main modal ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  posts: AgentPost[];
  onEdit: (post: AgentPost) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function AllDraftsModal({
  isOpen,
  onClose,
  posts,
  onEdit,
  onApprove,
  onReject,
}: Props) {
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const pagedPosts = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-4 flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">All drafts</h2>
            <p className="text-xs text-gray-400">{posts.length} total</p>
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
          {pagedPosts.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-400">No drafts found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedPosts.map((post) => (
                <MiniCard
                  key={post.id}
                  post={post}
                  onEdit={onEdit}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50",
                page === 1 && "cursor-not-allowed opacity-40"
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
              disabled={page === totalPages}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50",
                page === totalPages && "cursor-not-allowed opacity-40"
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
