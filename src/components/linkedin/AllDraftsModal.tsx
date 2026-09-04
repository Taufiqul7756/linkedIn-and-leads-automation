"use client";

import React, { useEffect, useState } from "react";
import { LuX, LuCheck, LuClock, LuPencil, LuChevronLeft, LuChevronRight } from "react-icons/lu";
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

// ─── mini card (grid-friendly, no absolute-positioned overflow) ────────────────

function MiniCard({ post, onEdit }: { post: AgentPost; onEdit: (p: AgentPost) => void }) {
  const dateStr = formatSuggestedDate(post.suggested_publish_at);
  const bodyText = post.body ?? "";

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
        <div className="flex-1 overflow-hidden text-xs leading-relaxed text-gray-600 line-clamp-4">
          {renderBlocks(post.body_blocks, post.body)}
        </div>

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
  posts: AgentPost[];
  onEdit: (post: AgentPost) => void;
}

export default function AllDraftsModal({ isOpen, onClose, posts, onEdit }: Props) {
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
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedPosts.map((post) => (
                <MiniCard key={post.id} post={post} onEdit={onEdit} />
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
