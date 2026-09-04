"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LuX,
  LuPencil,
  LuPlus,
  LuSettings,
  LuSend,
  LuImage,
  LuUpload,
  LuLoader,
} from "react-icons/lu";
import type { AgentPost, BlockNode, SpanNode } from "@/types/LinkedInAgent";
import TiptapEditor from "@/components/ui/TiptapEditor";
import { useWorkspace } from "@/context/WorkspaceContext";
import { postsService } from "@/service/postsService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import toast from "react-hot-toast";

// ─── convert body_blocks → Tiptap JSON ────────────────────────────────────────

// Handles new Tiptap doc format ({type:"doc",...}), legacy array format, or plain text fallback.
function getInitialContent(post: AgentPost): object {
  const bb = post.body_blocks;

  // New format: already a Tiptap doc object
  if (bb && typeof bb === "object" && !Array.isArray(bb)) {
    const doc = bb as { type?: string };
    if (doc.type === "doc") return bb as object;
    // {} means absent — fall through to body
  }

  // String: try JSON parsing (could be encoded Tiptap doc or legacy array)
  if (typeof bb === "string" && bb) {
    try {
      const parsed = JSON.parse(bb);
      if (parsed?.type === "doc") return parsed;
      if (Array.isArray(parsed) && parsed.length > 0) return legacyBlocksToTiptap(parsed);
    } catch {
      /* ignore */
    }
  }

  // Legacy array format
  if (Array.isArray(bb) && (bb as BlockNode[]).length > 0) {
    return legacyBlocksToTiptap(bb as BlockNode[]);
  }

  // Fallback to body plain text
  return post.body ? plainTextToTiptap(post.body) : { type: "doc", content: [] };
}

function legacyBlocksToTiptap(blocks: BlockNode[]): object {
  const content = blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return {
          type: "paragraph",
          content: block.spans.map((s: SpanNode) => ({
            type: "text",
            text: s.text,
            ...(s.bold ? { marks: [{ type: "bold" }] } : {}),
          })),
        };
      }
      if (block.type === "list") {
        return {
          type: "bulletList",
          content: block.items.map((item) => ({
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: item.spans.map((s: SpanNode) => ({
                  type: "text",
                  text: s.text,
                  ...(s.bold ? { marks: [{ type: "bold" }] } : {}),
                })),
              },
            ],
          })),
        };
      }
      return null;
    })
    .filter(Boolean);
  return { type: "doc", content };
}

function plainTextToTiptap(text: string): object {
  const content = text.split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
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
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? "bg-blue-600" : "bg-gray-200"}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  post: AgentPost | null;
  onClose: () => void;
  onSave?: () => void;
}

export default function EditDraftModal({ post, onClose, onSave }: Props) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [bodyJson, setBodyJson] = useState<object>({ type: "doc", content: [] });
  const [editorKey, setEditorKey] = useState(0);
  const [changeMsg, setChangeMsg] = useState("");
  const [useImage, setUseImage] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-initialise when post changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!post) return;
    setTitle(post.headline ?? "");
    setChangeMsg("");
    setUseImage(!!post.image_url || post.image_status !== "none");
    setScheduledDate(isoToDateInput(post.suggested_publish_at));
    setScheduledTime(isoToTimeInput(post.suggested_publish_at));
    setBodyJson(getInitialContent(post));
    // Remount the editor with fresh content
    setEditorKey((k) => k + 1);
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

  const handleSave = async () => {
    if (!post || !workspaceId) return;
    setSaving(true);
    try {
      let suggested_publish_at: string | null = null;
      if (scheduledDate) {
        suggested_publish_at = `${scheduledDate}T${scheduledTime || "00:00"}:00`;
      }
      await postsService(workspaceId).patchPost(post.id, {
        body_blocks: bodyJson,
        suggested_publish_at,
      });
      toast.success("Draft saved.");
      onSave?.();
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

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
          {/* Title — only shown when the post has a headline */}
          {post.headline && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
            </div>
          )}

          {/* Body — Tiptap rich text editor */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Body</label>
            <TiptapEditor
              key={editorKey}
              content={bodyJson}
              onChange={setBodyJson}
              minHeight="280px"
              placeholder="Write your LinkedIn post…"
            />
          </div>

          {/* Mini composer — ask for changes (disabled, coming soon) */}
          <div className="rounded-xl border border-gray-200 px-4 py-3 opacity-50 pointer-events-none select-none">
            <textarea
              value={changeMsg}
              onChange={(e) => setChangeMsg(e.target.value)}
              placeholder={`Ask for changes, or "show all drafts"...`}
              rows={2}
              disabled
              className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none disabled:cursor-not-allowed"
            />
            <div className="mt-2 flex items-center justify-between">
              {/* Knowledge chip */}
              <span className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                Using your knowledge base
                <button disabled className="text-teal-400">
                  <LuX className="h-3 w-3" />
                </button>
              </span>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400"
                >
                  <LuPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400"
                >
                  <LuSettings className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white opacity-50"
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
