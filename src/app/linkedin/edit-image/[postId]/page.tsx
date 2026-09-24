"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LuArrowLeft,
  LuBot,
  LuFileText,
  LuX,
  LuSend,
  LuPaperclip,
  LuSmile,
  LuPencil,
  LuClock,
  LuShare2,
  LuImage,
  LuThumbsUp,
  LuMessageSquare,
  LuDownload,
  LuPlus,
  LuLoader,
  LuCheck,
  LuTrash2,
} from "react-icons/lu";
import Image from "next/image";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import { postsService } from "@/service/postsService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import toast from "react-hot-toast";
import TiptapEditor from "@/components/ui/TiptapEditor";
import type { AgentPost, BlockNode, SpanNode } from "@/types/LinkedInAgent";

// ─── body_blocks → Tiptap helpers (same as EditDraftModal) ───────────────────

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

function getInitialContent(post: AgentPost): object {
  const bb = post.body_blocks;
  if (bb && typeof bb === "object" && !Array.isArray(bb)) {
    const doc = bb as { type?: string };
    if (doc.type === "doc") return bb as object;
  }
  if (typeof bb === "string" && bb) {
    try {
      const parsed = JSON.parse(bb);
      if (parsed?.type === "doc") return parsed;
      if (Array.isArray(parsed) && parsed.length > 0) return legacyBlocksToTiptap(parsed);
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(bb) && (bb as BlockNode[]).length > 0)
    return legacyBlocksToTiptap(bb as BlockNode[]);
  return post.body ? plainTextToTiptap(post.body) : { type: "doc", content: [] };
}

// ─── Mock chat data ───────────────────────────────────────────────────────────

type ChatMsg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  image?: boolean;
  isGenerating?: boolean;
};

const INITIAL_MESSAGES: ChatMsg[] = [
  {
    id: 1,
    role: "user",
    text: "Create a professional image for this post about founders and investors",
  },
  {
    id: 2,
    role: "assistant",
    text: "A funnel/filter diagram representing the two-sided deal framework:",
    image: true,
  },
];

// ─── Generated image visual ───────────────────────────────────────────────────

function GeneratedImage({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-xl bg-blue-500", className)}>
      <div className="flex flex-col items-center px-4 pt-4 pb-3">
        <p className="text-center text-[11px] font-extrabold uppercase leading-tight tracking-wide text-white">
          The Two-Sided Deal Filter:
        </p>
        <p className="text-center text-[10px] font-bold uppercase leading-tight text-white/90">
          How Founders &amp; Investors — Say No Faster, Yes Smarter
        </p>
        <p className="mt-0.5 text-center text-[9px] text-white/70">
          A judgment-first framework for founder-investor fit
        </p>

        <div className="relative mt-2 flex w-full flex-col items-center">
          <div className="flex w-full items-start justify-around">
            {["💡", "⚖️", "❓"].map((icon, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  {icon}
                </div>
                <div className="h-8 w-px bg-white/40" />
              </div>
            ))}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div
                className="h-0 w-0"
                style={{
                  borderLeft: "36px solid transparent",
                  borderRight: "36px solid transparent",
                  borderTop: "20px solid rgba(255,255,255,0.22)",
                }}
              />
              <div
                className="h-0 w-0"
                style={{
                  borderLeft: "22px solid transparent",
                  borderRight: "22px solid transparent",
                  borderTop: "26px solid rgba(255,255,255,0.32)",
                }}
              />
              <div className="h-5 w-2.5 bg-white/40" />
            </div>
            <span className="absolute left-0 -translate-x-2 text-lg">🧑‍💼</span>
            <span className="absolute right-0 translate-x-2 text-lg">👩‍💼</span>
          </div>

          <div className="flex w-full items-end justify-around">
            {["📋", "✅", "❌"].map((icon, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="h-8 w-px bg-white/40" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  {icon}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-blue-950 px-3 py-1.5 text-center">
        <p className="text-[10px] font-bold tracking-wide text-white">
          Comment &quot;TWOSIDED&quot; and I will send it
        </p>
      </div>
    </div>
  );
}

// ─── Image thinking steps ─────────────────────────────────────────────────────

const IMAGE_STEPS = ["Thought process", "Image plan ready", "Image ready"];

function ImageThinkingSteps() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setVisibleCount(2), 1500);
    const t2 = setTimeout(() => setVisibleCount(3), 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
      {IMAGE_STEPS.map((step, i) => (
        <div
          key={step}
          className={cn(
            "flex items-center gap-2 text-sm transition-opacity duration-500",
            i < visibleCount ? "opacity-100" : "opacity-0"
          )}
        >
          {i < visibleCount - 1 ? (
            <LuCheck className="h-3.5 w-3.5 shrink-0 text-green-500" />
          ) : (
            <LuLoader className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />
          )}
          <span className={cn("text-sm", i < visibleCount - 1 ? "text-gray-400" : "text-gray-700")}>
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Image result card ────────────────────────────────────────────────────────

function ImageResultCard({
  onAdd,
  isAdded,
  onPreview,
}: {
  onAdd: () => void;
  isAdded: boolean;
  onPreview: () => void;
}) {
  return (
    <div className="mt-2 w-[26rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative">
        <div onClick={onPreview} className="cursor-zoom-in">
          <GeneratedImage className="min-h-64" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2.5">
          <button
            onClick={onAdd}
            disabled={isAdded}
            className={cn(
              "flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-md transition",
              isAdded ? "cursor-default text-green-600" : "text-sidebar-dark hover:bg-white/90"
            )}
          >
            {isAdded ? <LuCheck className="h-3.5 w-3.5" /> : <LuPlus className="h-3.5 w-3.5" />}
            {isAdded ? "Added" : "Add to post"}
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/75 text-white shadow-md backdrop-blur-sm transition hover:bg-gray-800/90">
            <LuDownload className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat message ─────────────────────────────────────────────────────────────

function ChatMessage({
  message,
  onAddImage,
  addedImageIds,
  onPreviewImage,
}: {
  message: ChatMsg;
  onAddImage: (id: number) => void;
  addedImageIds: Set<number>;
  onPreviewImage: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <span className="px-1 text-[10px] font-medium text-gray-400">
        {isUser ? "You" : "Image Agent"}
      </span>
      <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
        {isUser ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-semibold text-white">
            T
          </div>
        ) : (
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <Image src="/cg-fav.svg" alt="Agent" width={16} height={16} className="shrink-0" />
            {message.isGenerating && (
              <span className="absolute inset-0 rounded-xl animate-ping bg-blue-300 opacity-30" />
            )}
          </div>
        )}
        <div className={cn("min-w-0", isUser ? "max-w-[75%]" : "flex-1")}>
          {message.isGenerating ? (
            <ImageThinkingSteps />
          ) : (
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                isUser
                  ? "rounded-tr-sm bg-violet-600 text-white"
                  : "rounded-tl-sm border border-gray-100 bg-white text-gray-700 shadow-sm"
              )}
            >
              {message.text}
            </div>
          )}
          {message.image && (
            <ImageResultCard
              onAdd={() => onAddImage(message.id)}
              isAdded={addedImageIds.has(message.id)}
              onPreview={onPreviewImage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LinkedIn post preview ────────────────────────────────────────────────────

function LinkedInPostPreview({
  post,
  addedImageCount,
}: {
  post: AgentPost | null;
  addedImageCount: number;
}) {
  const body =
    post?.body ??
    "Most founders and investors think the hard part of a deal is finding the yes. The hard part is saying no to a wrong yes before it wastes your time or your money....";
  return (
    <div className="mx-auto w-full max-w-[500px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm mb-2">
      <div className="flex items-start justify-between px-4 pt-4 pb-1">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-rose-500">
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
              G
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Garry Doel</p>
            <p className="text-xs text-gray-500">Founder, Investor and IT Enthusiast</p>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                New
              </span>
              <span className="text-[10px] text-gray-400">●</span>
            </div>
          </div>
        </div>
        <button className="mt-1 rounded-full p-1 text-gray-400 hover:bg-gray-100">
          <span className="text-sm font-bold leading-none tracking-widest text-gray-400">···</span>
        </button>
      </div>
      <div className="px-4 py-2">
        <p className="line-clamp-3 text-sm leading-relaxed text-gray-700">
          {body} <button className="font-semibold text-gray-900 hover:underline">see more</button>
        </p>
      </div>
      {addedImageCount === 0 ? null : addedImageCount === 1 ? (
        <GeneratedImage className="rounded-none" />
      ) : (
        <div className="grid grid-cols-2 gap-0.5">
          {Array.from({ length: Math.min(addedImageCount, 4) }).map((_, i) => {
            const displayCount = Math.min(addedImageCount, 4);
            const isLast = i === displayCount - 1;
            const isOdd = displayCount % 2 !== 0;
            return (
              <div key={i} className={cn("relative", isLast && isOdd && "col-span-2")}>
                <GeneratedImage className="rounded-none" />
                {isLast && addedImageCount > 4 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-lg font-bold text-white">+{addedImageCount - 4}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm">❤️</span>
          <span className="text-sm">👏</span>
          <span className="ml-1 text-xs text-gray-500">1,37</span>
        </div>
        <span className="text-xs text-gray-500">1 comment · 3 reposts</span>
      </div>
      <div className="mx-4 border-t border-gray-100" />
      <div className="flex items-center px-2 py-1">
        {[
          { icon: LuThumbsUp, label: "Like" },
          { icon: LuMessageSquare, label: "Comment" },
          { icon: LuImage, label: "Repost" },
          { icon: LuSend, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Schedule popover ─────────────────────────────────────────────────────────

function SchedulePopover({
  onConfirm,
  onClose,
  loading,
  initialDate,
  initialTime,
}: {
  onConfirm: (date: string, time: string) => void;
  onClose: () => void;
  loading: boolean;
  initialDate?: string;
  initialTime?: string;
}) {
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState(initialTime ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg z-10"
    >
      <p className="mb-3 text-xs font-semibold text-gray-700">Schedule post</p>
      <div className="flex flex-col gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
        <button
          onClick={() => onConfirm(date, time)}
          disabled={!date || loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
          Confirm schedule
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditImagePage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  void searchParams;

  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  // Post data
  const [post, setPost] = useState<AgentPost | null>(null);
  const [postLoading, setPostLoading] = useState(true);

  // Editor
  const [bodyJson, setBodyJson] = useState<object>({ type: "doc", content: [] });
  const [editorKey, setEditorKey] = useState(0);

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Added images (keyed by message id)
  const [addedImageIds, setAddedImageIds] = useState<Set<number>>(new Set());

  // Extra images uploaded via "Add more"
  const [extraImages, setExtraImages] = useState<{ id: number; name: string; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image lightbox
  const [previewOpen, setPreviewOpen] = useState(false);

  function handleAddImage(id: number) {
    setAddedImageIds((prev) => new Set(prev).add(id));
  }

  function handleRemoveImage(id: number) {
    setAddedImageIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newImages = files.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setExtraImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  }

  function handleRemoveExtraImage(id: number) {
    setExtraImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  const totalMediaCount = addedImageIds.size + extraImages.length;

  // Tabs
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");

  // Actions
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [backingToDraft, setBackingToDraft] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPublished = post?.status === "published";

  // Fetch post
  useEffect(() => {
    if (!workspaceId || !postId) return;
    async function fetchPost() {
      setPostLoading(true);
      try {
        const p = await linkedinAgentService(workspaceId).getAgentPost(postId);
        setPost(p);
        setBodyJson(getInitialContent(p));
        setEditorKey((k) => k + 1);
      } catch (err) {
        toast.error(extractErrorMessage(err));
      } finally {
        setPostLoading(false);
      }
    }
    void fetchPost();
  }, [workspaceId, postId]);

  // Save body
  async function handleSave() {
    if (!post || !workspaceId) return;
    setSaving(true);
    try {
      await postsService(workspaceId).patchPost(post.id, { body_blocks: bodyJson });
      toast.success("Draft saved.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Approve = Publish now
  async function handleApprove() {
    if (!post || !workspaceId) return;
    setApproving(true);
    setConfirmPublishOpen(false);
    try {
      await postsService(workspaceId).approvePost(post.id);
      setApproved(true);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  // Schedule — updates suggested_publish_at (same as pencil icon in ReviewApprovalSection)
  async function handleSchedule(date: string, time: string) {
    if (!post || !workspaceId || !date) return;
    const newIso = new Date(`${date}T${time || "00:00"}`).toISOString();
    setScheduling(true);
    try {
      await postsService(workspaceId).patchPost(post.id, { suggested_publish_at: newIso });
      setPost((prev) => (prev ? { ...prev, suggested_publish_at: newIso } : prev));
      toast.success("Suggested time updated.");
      setScheduleOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setScheduling(false);
    }
  }

  // Back to draft
  async function handleBackToDraft() {
    if (!post || !workspaceId) return;
    setBackingToDraft(true);
    try {
      await postsService(workspaceId).patchPost(post.id, { status: "draft" });
      toast.success("Post moved back to draft.");
      setApproved(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBackingToDraft(false);
    }
  }

  // Chat send
  function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: ChatMsg = { id: Date.now(), role: "user", text };
    const pendingMsg: ChatMsg = {
      id: Date.now() + 1,
      role: "assistant",
      text: "Working on it…",
      isGenerating: true,
    };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    setIsSending(true);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { ...m, text: `Updated based on: "${text}"`, isGenerating: false, image: true }
            : m
        )
      );
      setIsSending(false);
    }, 2000);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-page-bg">
      {/* ── Two-panel layout ──────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── LEFT PANEL — Image agent chatbox ─────────────────────────────── */}
        <div className="flex min-h-0 w-1/2 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
            <div className="flex items-center gap-2">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white">
                <Image src="/cg-fav.svg" alt="Agent" width={16} height={16} className="shrink-0" />
                {isSending && (
                  <span className="absolute inset-0 rounded-lg animate-ping bg-blue-300 opacity-30" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">Image Agent</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onAddImage={handleAddImage}
                  addedImageIds={addedImageIds}
                  onPreviewImage={() => setPreviewOpen(true)}
                />
              ))}
            </div>
          </div>

          {isPublished ? (
            <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
              <p className="text-center text-xs text-gray-400">
                This post has been published and cannot be edited.
              </p>
            </div>
          ) : (
            <div className="shrink-0 border-t border-gray-200 bg-white p-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-md">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Describe the image you want…"
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button className="rounded-md p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600">
                      <LuPaperclip className="h-4 w-4" />
                    </button>
                    <button className="rounded-md p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600">
                      <LuSmile className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
                  >
                    {isSending ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuSend className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL — Post editor ─────────────────────────────────────── */}
        <div className="flex min-h-0 w-1/2 flex-col overflow-hidden bg-[#E9ECF5]">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-5">
            {!isPublished && (
              <div className="flex items-center gap-1">
                {(["edit", "preview"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                      activeTab === tab
                        ? "bg-gray-100 text-gray-800"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {tab === "edit" ? (
                      <LuPencil className="h-3 w-3" />
                    ) : (
                      <LuImage className="h-3 w-3" />
                    )}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => router.push(`/linkedin/automation?editPostId=${postId}`)}
                className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
              >
                <LuBot className="h-3.5 w-3.5" />
                Go to Agent
              </button>
              <button
                onClick={() => router.push("/linkedin/post-management")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                <LuFileText className="h-3.5 w-3.5" />
                Post Management
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {postLoading ? (
              <div className="flex items-center justify-center py-20">
                <LuLoader className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : isPublished || activeTab === "preview" ? (
              <LinkedInPostPreview post={post} addedImageCount={totalMediaCount} />
            ) : (
              <div className="mx-auto w-full max-w-[500px] space-y-3">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <TiptapEditor
                    key={editorKey}
                    content={bodyJson}
                    onChange={setBodyJson}
                    minHeight="360px"
                    placeholder="Write your LinkedIn post…"
                  />
                </div>

                {/* MEDIA section */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Media
                    </span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      <LuPlus className="h-3.5 w-3.5" />
                      Add more
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                  {totalMediaCount === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      No images attached yet. Add images from the chat or click &quot;Add
                      more&quot;.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {messages
                        .filter((m) => m.image && addedImageIds.has(m.id))
                        .map((m, idx) => (
                          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                              <GeneratedImage className="h-full w-full" />
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-700">
                              Image {idx + 1}
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-600">
                              <LuCheck className="h-3 w-3" />
                              Attached
                            </span>
                            <button
                              onClick={() => handleRemoveImage(m.id)}
                              className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      {extraImages.map((img, idx) => (
                        <div key={img.id} className="flex items-center gap-3 px-4 py-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.name}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                          <span className="flex-1 truncate text-sm font-medium text-gray-700">
                            Image {addedImageIds.size + idx + 1}
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-600">
                            <LuCheck className="h-3 w-3" />
                            Attached
                          </span>
                          <button
                            onClick={() => handleRemoveExtraImage(img.id)}
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <LuTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {isPublished ? null : approved ? (
            /* ── Approved success state ── */
            <div className="flex shrink-0 items-center justify-between border-t border-green-100 bg-green-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
                  <LuCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Post approved!</p>
                  <p className="text-xs text-green-600">Your post has been approved and queued.</p>
                </div>
              </div>
              <button
                onClick={handleBackToDraft}
                disabled={backingToDraft}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {backingToDraft ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuArrowLeft className="h-3.5 w-3.5" />
                )}
                Back to draft
              </button>
            </div>
          ) : (
            /* ── Normal footer ── */
            <div className="relative flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-5 py-3">
              <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50">
                <LuShare2 className="h-3.5 w-3.5" />
                Share for Feedback
              </button>

              <div className="flex items-center gap-2">
                {activeTab === "edit" && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    {saving ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuCheck className="h-3.5 w-3.5" />
                    )}
                    Save
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={() => setScheduleOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    <LuClock className="h-3.5 w-3.5" />
                    Schedule
                  </button>
                  {scheduleOpen && (
                    <SchedulePopover
                      onConfirm={handleSchedule}
                      onClose={() => setScheduleOpen(false)}
                      loading={scheduling}
                      initialDate={isoToDateInput(post?.suggested_publish_at ?? null)}
                      initialTime={isoToTimeInput(post?.suggested_publish_at ?? null)}
                    />
                  )}
                </div>

                <button
                  onClick={() => setConfirmPublishOpen(true)}
                  disabled={approving}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {approving ? (
                    <LuLoader className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LuCheck className="h-3.5 w-3.5" />
                  )}
                  Approve
                </button>
              </div>

              {/* Publish confirmation modal */}
              {confirmPublishOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={() => setConfirmPublishOpen(false)}
                  />
                  <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                    <div className="mb-4 flex justify-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                        <LuCheck className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="mb-1 text-center text-base font-semibold text-gray-900">
                      Approve this post?
                    </h3>
                    <p className="mb-5 text-sm text-gray-500">
                      This will approve the post and move it out of drafts. You can again back to
                      the draft.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmPublishOpen(false)}
                        className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {approving && <LuLoader className="h-4 w-4 animate-spin" />}
                        Yes, publish
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Image lightbox ────────────────────────────────────────────────────── */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-gray-600 transition hover:bg-gray-100"
            >
              <LuX className="h-4 w-4" />
            </button>
            <GeneratedImage className="rounded-none" />
          </div>
        </div>
      )}
    </div>
  );
}
