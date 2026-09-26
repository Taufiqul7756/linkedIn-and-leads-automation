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
  LuImage,
  LuThumbsUp,
  LuMessageSquare,
  LuRepeat2,
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
import { imageChatService } from "@/service/imageChatService";
import { linkedinService } from "@/service/linkedinService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import toast from "react-hot-toast";
import TiptapEditor from "@/components/ui/TiptapEditor";
import type { AgentPost, BlockNode, SpanNode } from "@/types/LinkedInAgent";
import type { ImageChat, ChatMessage, GeneratedImage } from "@/types/ImageChat";

// ─── body_blocks → Tiptap helpers ────────────────────────────────────────────

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

// ─── Image thinking steps (shown while image.status === "pending") ────────────

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

// ─── Image result card (real image from API) ──────────────────────────────────

function ImageResultCard({
  image,
  isAdded,
  onAdd,
  onPreview,
}: {
  image: GeneratedImage;
  isAdded: boolean;
  onAdd: () => void;
  onPreview: (url: string) => void;
}) {
  if (image.status === "failed") return null;

  return (
    <div className="mt-2 w-[26rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {image.status === "pending" ? (
          <div className="flex h-full w-full items-center justify-center">
            <LuLoader className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.prompt || "Generated image"}
            className="h-full w-full cursor-zoom-in object-cover"
            onClick={() => onPreview(image.url)}
          />
        )}
        {image.status === "ready" && (
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
            <button
              onClick={async () => {
                const blob = await fetch(image.url).then((r) => r.blob());
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `image-${image.id}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/75 text-white shadow-md backdrop-blur-sm transition hover:bg-gray-800/90"
            >
              <LuDownload className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat message ─────────────────────────────────────────────────────────────

function ChatMessageItem({
  message,
  addedImageId,
  onAddToPost,
  onPreviewImage,
}: {
  message: ChatMessage;
  addedImageId: string | null;
  onAddToPost: (imageId: string) => void;
  onPreviewImage: (url: string) => void;
}) {
  const isUser = message.role === "user";
  const isPending = message.image?.status === "pending";

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {isUser && <span className="px-1 text-[10px] font-medium text-gray-400">You</span>}
      <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
        {isUser ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-semibold text-white">
            T
          </div>
        ) : (
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <Image src="/cg-fav.svg" alt="Agent" width={16} height={16} className="shrink-0" />
            {isPending && (
              <span className="absolute inset-0 rounded-xl animate-ping bg-blue-300 opacity-30" />
            )}
          </div>
        )}
        <div className={cn("min-w-0", isUser ? "max-w-[75%]" : "flex-1")}>
          {isPending ? (
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
          {message.image && message.image.status !== "pending" && (
            <ImageResultCard
              image={message.image}
              isAdded={addedImageId === message.image.id}
              onAdd={() => onAddToPost(message.image!.id)}
              onPreview={onPreviewImage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProseMirror doc renderer ─────────────────────────────────────────────────

type PMNode = {
  type: string;
  text?: string;
  marks?: { type: string }[];
  content?: PMNode[];
};

function renderInline(nodes: PMNode[]): React.ReactNode {
  return nodes.map((node, i) => {
    if (node.type !== "text") return null;
    const isBold = node.marks?.some((m) => m.type === "bold");
    const isItalic = node.marks?.some((m) => m.type === "italic");
    let el: React.ReactNode = node.text ?? "";
    if (isBold) el = <strong key={i}>{el}</strong>;
    if (isItalic) el = <em key={i}>{el}</em>;
    return <span key={i}>{el}</span>;
  });
}

function renderDoc(doc: object): React.ReactNode[] {
  const root = doc as { type?: string; content?: PMNode[] };
  if (root.type !== "doc" || !root.content) return [];
  return root.content.map((block, i) => {
    if (block.type === "paragraph") {
      return (
        <p key={i} className="text-sm leading-relaxed text-gray-700 mt-2 first:mt-0">
          {block.content ? renderInline(block.content) : <br />}
        </p>
      );
    }
    if (block.type === "bulletList") {
      return (
        <ul key={i} className="list-disc pl-5 mt-2 space-y-0.5">
          {block.content?.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed text-gray-700">
              {item.content?.[0]?.content ? renderInline(item.content[0].content) : null}
            </li>
          ))}
        </ul>
      );
    }
    return null;
  });
}

// ─── LinkedIn post preview ────────────────────────────────────────────────────

function LinkedInPostPreview({
  bodyJson,
  postImageUrl,
  extraImageCount,
  accountName,
}: {
  bodyJson: object;
  postImageUrl: string;
  extraImageCount: number;
  accountName: string;
}) {
  const [showFull, setShowFull] = useState(false);

  const totalImages = (postImageUrl ? 1 : 0) + extraImageCount;
  const initial = accountName ? accountName.charAt(0).toUpperCase() : "?";

  const rendered = renderDoc(bodyJson);
  // "collapsed" = first 3 paragraphs only
  const collapsed = rendered.slice(0, 3);
  const hasMore = rendered.length > 3;

  return (
    <div className="mx-auto w-full max-w-[500px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm mb-2">
      <div className="flex items-start justify-between px-4 pt-4 pb-1">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-rose-500">
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
              {initial}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{accountName || "—"}</p>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                Now
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
        {showFull ? rendered : collapsed}
        {hasMore && (
          <button
            onClick={() => setShowFull((v) => !v)}
            className="mt-1 text-xs font-semibold text-gray-500 hover:underline"
          >
            {showFull ? "see less" : "…see more"}
          </button>
        )}
      </div>
      {totalImages > 0 &&
        (postImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={postImageUrl} alt="Post image" className="w-full aspect-video object-cover" />
        ) : null)}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            <div
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full ring-1 ring-white"
              style={{ backgroundColor: "var(--reaction-like)" }}
            >
              <Image
                src="/icons/Linkedin-Like-Icon-Thumbup.png"
                alt="Like"
                width={13}
                height={13}
              />
            </div>
            <div
              className="-ml-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-1 ring-white"
              style={{ backgroundColor: "var(--reaction-support)" }}
            >
              <Image
                src="/icons/Linkedin-Support-Icon-HeartinHand.png"
                alt="Support"
                width={13}
                height={13}
              />
            </div>
            <div
              className="-ml-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-1 ring-white"
              style={{ backgroundColor: "var(--reaction-celebrate)" }}
            >
              <Image
                src="/icons/Linkedin-Celebrate-Icon-ClappingHands.png"
                alt="Celebrate"
                width={13}
                height={13}
              />
            </div>
          </div>
          <span className="ml-1 text-xs text-gray-500">1,37</span>
        </div>
        <span className="text-xs text-gray-500">1 comment · 3 reposts</span>
      </div>
      <div className="mx-4 border-t border-gray-100" />
      <div className="flex items-center px-2 py-1">
        {[
          { icon: LuThumbsUp, label: "Like" },
          { icon: LuMessageSquare, label: "Comment" },
          { icon: LuRepeat2, label: "Repost" },
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

  // LinkedIn account
  const { data: linkedInAccount } = useQueryWithTokenRefresh(
    ["linkedin-account", workspaceId],
    () => linkedinService(workspaceId).getAccount(),
    { enabled: !!workspaceId }
  );

  // Post data
  const [post, setPost] = useState<AgentPost | null>(null);
  const [postLoading, setPostLoading] = useState(true);

  // Editor
  const [bodyJson, setBodyJson] = useState<object>({ type: "doc", content: [] });
  const [editorKey, setEditorKey] = useState(0);

  // Chat
  const [chat, setChat] = useState<ImageChat | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [addedImageId, setAddedImageId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extra images uploaded via "Add more"
  const [extraImages, setExtraImages] = useState<{ id: number; name: string; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image lightbox
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");

  // Actions
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [backingToDraft, setBackingToDraft] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPublished = post?.status === "published";
  const isChatRunning = chat?.status === "running";

  // ── Polling helpers ─────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(chatId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const c = await imageChatService(workspaceId).getChat(chatId);
        setChat(c);
        if (c.status === "ready") stopPolling();
      } catch {
        // keep polling on transient errors
      }
    }, 2000);
  }

  useEffect(() => () => stopPolling(), []);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  // ── Fetch post ──────────────────────────────────────────────────────────────

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

  // ── Open image chat ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId || !postId) return;
    async function openChat() {
      setChatLoading(true);
      try {
        const c = await imageChatService(workspaceId).openChat(postId);
        setChat(c);
        // resume polling if a generation is already running
        if (c.status === "running") startPolling(c.id);
      } catch (err) {
        toast.error(extractErrorMessage(err));
      } finally {
        setChatLoading(false);
      }
    }
    void openChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, postId]);

  // ── Send message ────────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || isChatRunning || !chat) return;
    setIsSending(true);
    setInput("");
    try {
      const c = await imageChatService(workspaceId).sendMessage(chat.id, text);
      setChat(c);
      if (c.status === "running") startPolling(c.id);
    } catch (err) {
      const msg = extractErrorMessage(err);
      toast.error(msg);
      setInput(text); // restore input so user can retry
    } finally {
      setIsSending(false);
    }
  }

  // ── Add image to post ───────────────────────────────────────────────────────

  async function handleAddToPost(imageId: string) {
    if (!chat) return;
    try {
      const c = await imageChatService(workspaceId).addToPost(chat.id, imageId);
      setChat(c);
      setAddedImageId(imageId);
      toast.success("Image added to post.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  // ── Right-panel actions ─────────────────────────────────────────────────────

  const [input, setInput] = useState("");

  async function handleSave() {
    if (!post || !workspaceId) return;
    setSaving(true);
    try {
      await postsService(workspaceId).patchPost(post.id, { body_blocks: bodyJson });
      setIsDirty(false);
      toast.success("Draft saved.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

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

  const [removingChatImage, setRemovingChatImage] = useState(false);

  async function handleRemoveChatImage() {
    if (!post || !workspaceId) return;
    setRemovingChatImage(true);
    try {
      await postsService(workspaceId).patchPost(post.id, { image_url: "" });
      setAddedImageId(null);
      setChat((prev) => (prev ? { ...prev, post_image_url: "" } : prev));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setRemovingChatImage(false);
    }
  }

  function handleRemoveExtraImage(id: number) {
    setExtraImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  const postImageUrl = chat?.post_image_url ?? "";
  const totalMediaCount = (postImageUrl ? 1 : 0) + extraImages.length;

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
                {isChatRunning && (
                  <span className="absolute inset-0 rounded-lg animate-ping bg-blue-300 opacity-30" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">Image Agent</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {chatLoading ? (
              <div className="flex items-center justify-center py-20">
                <LuLoader className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {chat?.messages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    addedImageId={addedImageId}
                    onAddToPost={handleAddToPost}
                    onPreviewImage={(url) => {
                      setPreviewUrl(url);
                      setPreviewOpen(true);
                    }}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
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
                      void handleSend();
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
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || isSending || isChatRunning}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
                  >
                    {isSending || isChatRunning ? (
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
              <LinkedInPostPreview
                bodyJson={bodyJson}
                postImageUrl={postImageUrl}
                extraImageCount={extraImages.length}
                accountName={linkedInAccount?.name ?? ""}
              />
            ) : (
              <div className="mx-auto w-full max-w-[500px] space-y-3">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <TiptapEditor
                    key={editorKey}
                    content={bodyJson}
                    onChange={(val) => {
                      setBodyJson(val);
                      setIsDirty(true);
                    }}
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
                      {postImageUrl && (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={postImageUrl}
                              alt="Generated image"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="flex-1 text-sm font-medium text-gray-700">AI Image</span>
                          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-600">
                            <LuCheck className="h-3 w-3" />
                            Attached
                          </span>
                          <button
                            onClick={() => void handleRemoveChatImage()}
                            disabled={removingChatImage}
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          >
                            {removingChatImage ? (
                              <LuLoader className="h-4 w-4 animate-spin" />
                            ) : (
                              <LuTrash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      )}
                      {extraImages.map((img, idx) => (
                        <div key={img.id} className="flex items-center gap-3 px-4 py-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.name}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                          <span className="flex-1 truncate text-sm font-medium text-gray-700">
                            Image {(postImageUrl ? 1 : 0) + idx + 1}
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
            <div className="relative flex shrink-0 items-center justify-end border-t border-gray-200 bg-white px-5 py-3">
              <div className="flex items-center gap-2">
                {activeTab === "edit" && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40",
                      isDirty
                        ? "border border-violet-500 bg-violet-50 text-violet-700 hover:bg-violet-100"
                        : "border border-gray-200 bg-white text-gray-400"
                    )}
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
            className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-gray-600 transition hover:bg-gray-100"
            >
              <LuX className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full aspect-video object-cover rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
