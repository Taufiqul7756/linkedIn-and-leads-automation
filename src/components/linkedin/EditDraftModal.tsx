"use client";

import React, { useEffect, useRef, useState } from "react";
import { LuX, LuPencil, LuPlus, LuSettings, LuSend, LuImage, LuUpload } from "react-icons/lu";
import { cn } from "@/utils/cn";
import type { AgentPost, BlockNode, SpanNode } from "@/types/LinkedInAgent";

// ─── rich text renderer ───────────────────────────────────────────────────────

function renderBlocks(blocksInput: BlockNode[] | string): React.ReactNode {
  let blocks: BlockNode[] = [];
  if (Array.isArray(blocksInput)) {
    blocks = blocksInput;
  } else {
    try {
      const parsed = JSON.parse(blocksInput);
      if (Array.isArray(parsed) && parsed.length > 0) blocks = parsed;
    } catch {
      /* ignore */
    }
  }

  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "paragraph") {
          return (
            <p key={i} className={i > 0 ? "mt-3" : undefined}>
              {block.spans.map((s: SpanNode, j: number) =>
                s.bold ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>
              )}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className={cn("space-y-1", i > 0 && "mt-3")}>
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-1.5">
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ─── toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  post: AgentPost | null;
  onClose: () => void;
}

export default function EditDraftModal({ post, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [changeMsg, setChangeMsg] = useState("");
  const [useImage, setUseImage] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // re-initialise when post changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!post) return;
    setTitle(post.headline ?? "");
    setBody(post.body ?? "");
    setChangeMsg("");
    setUseImage(!!post.image_url || post.image_status !== "none");
    setScheduledDate(isoToDateInput(post.suggested_publish_at));
    setScheduledTime(isoToTimeInput(post.suggested_publish_at));
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // ESC to close
  useEffect(() => {
    if (!post) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative mx-4 flex w-full max-w-[700px] flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <LuPencil className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Edit draft</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Body</label>
            {post.body_blocks ? (
              <div
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setBody(e.currentTarget.textContent ?? "")}
                className="min-h-[280px] w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 whitespace-pre-wrap"
              >
                {renderBlocks(post.body_blocks)}
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="w-full resize-y rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
            )}
          </div>

          {/* Mini composer — ask for changes */}
          <div className="rounded-xl border border-gray-200 px-4 py-3">
            <textarea
              value={changeMsg}
              onChange={(e) => setChangeMsg(e.target.value)}
              placeholder={`Ask for changes, or "show all drafts"...`}
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              {/* Knowledge chip */}
              <span className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                Using your knowledge base
                <button className="text-teal-400 hover:text-teal-600">
                  <LuX className="h-3 w-3" />
                </button>
              </span>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100">
                  <LuPlus className="h-3.5 w-3.5" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100">
                  <LuSettings className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={!changeMsg.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                  <LuSend className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Image */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Image</span>
              <Toggle checked={useImage} onChange={setUseImage} />
            </div>

            {useImage && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {post.image_url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.image_url} alt="" className="h-48 w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center">
                    <LuImage className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                <div className="flex justify-end border-t border-gray-200 bg-white px-3 py-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <LuUpload className="h-3.5 w-3.5" />
                    Change image
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
                </div>
              </div>
            )}
          </div>

          {/* Scheduled time */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Scheduled time</label>
            <p className="mb-2 text-xs text-gray-400">(agent-suggested, editable)</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
