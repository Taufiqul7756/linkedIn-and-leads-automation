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
  LuSettings,
  LuRatio,
  LuCpu,
  LuChevronDown,
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
import ImageRatioModal from "@/components/linkedin/ImageRatioModal";
import type { AgentPost, BlockNode, SpanNode } from "@/types/LinkedInAgent";
import type {
  ImageChat,
  ChatMessage,
  GeneratedImage,
  ImageChatSettings,
  ImageChatSettingsPatch,
  ImageModelOption,
} from "@/types/ImageChat";

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

// Chat input grows with its content up to this many lines, then scrolls inside
const CHAT_INPUT_MAX_ROWS = 8;

// Fixed prompt sent by the "AI Generated Image" quick-action button
const AI_GENERATED_IMAGE_PROMPT = "Make Ai generated image";

// ─── Image thinking steps (shown while image.status === "pending") ────────────

const IMAGE_STEPS = [
  { label: "Thought process", detail: "Analyzing your prompt and understanding the context…" },
  { label: "Image plan ready", detail: "Structuring composition, colors, and visual elements…" },
  { label: "Rendering image", detail: "Applying style, lighting, and fine details…" },
  { label: "Image ready", detail: "Your image has been generated successfully." },
];

function ImageThinkingSteps() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setVisibleCount(2), 1500);
    const t2 = setTimeout(() => setVisibleCount(3), 3200);
    const t3 = setTimeout(() => setVisibleCount(4), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="mt-1 flex flex-col gap-2 pl-1">
      {IMAGE_STEPS.slice(0, visibleCount).map((step, i) => {
        const isDone = i < visibleCount - 1;
        return (
          <div key={step.label} className="flex items-start gap-2.5 animate-fade-in-up">
            <div className="mt-0.5 shrink-0">
              {isDone ? (
                <LuCheck className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <LuLoader className="h-3.5 w-3.5 animate-spin text-blue-500" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  "text-sm font-medium leading-tight",
                  isDone ? "text-gray-400" : "text-gray-700"
                )}
              >
                {step.label}
              </span>
              <span
                className={cn("text-xs leading-snug", isDone ? "text-gray-300" : "text-gray-400")}
              >
                {step.detail}
              </span>
            </div>
          </div>
        );
      })}
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

// ─── AI model avatar (model image, or a fallback icon when the API sends none) ─

function ModelAvatar({ model, size }: { model?: ImageModelOption; size: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50 text-gray-400",
        size === "sm" ? "h-5 w-5 rounded-md" : "h-9 w-9 rounded-lg"
      )}
    >
      {model?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={model.image} alt={model.title} className="h-full w-full object-cover" />
      ) : (
        <LuCpu className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      )}
    </span>
  );
}

// ─── AI image suggestion (agent-style nudge after the last agent reply) ───────

function AiImageSuggestion({ onGenerate }: { onGenerate: () => void }) {
  return (
    // pl-10.5 = agent avatar (w-8) + gap (2.5) — aligns with the agent message content above
    <p className="animate-fade-in-up pb-6 pl-10.5 text-sm leading-relaxed text-gray-700">
      Next, I could generate another image for you. Just click on this:{" "}
      <button
        onClick={onGenerate}
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
      >
        AI generated image
      </button>
    </p>
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
  const [postNotFound, setPostNotFound] = useState(false);

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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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

  // Image chat settings
  const [imgSettings, setImgSettings] = useState<ImageChatSettings>({
    use_post_body: true,
    image_ratio: [],
    ai_model: [],
  });
  const [imgSettingsOpen, setImgSettingsOpen] = useState(false);
  const [imgSettingsSaving, setImgSettingsSaving] = useState(false);
  const imgSettingsRef = useRef<HTMLDivElement>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [ratioModalOpen, setRatioModalOpen] = useState(false);
  const activeModel = imgSettings.ai_model.find((m) => m.is_active);
  const activeRatio = imgSettings.image_ratio.find((r) => r.is_active);

  const isPublished = post?.status === "published";
  const isChatRunning = chat?.status === "running";
  // Agent-style "generate another image" nudge — only after the latest agent reply, when idle
  const showAiImageSuggestion =
    !isPublished && !isSending && !isChatRunning && chat?.messages.at(-1)?.role === "agent";

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
      setPostNotFound(false);
      setPostLoading(true);
      try {
        const p = await linkedinAgentService(workspaceId).getAgentPost(postId);
        setPost(p);
        setBodyJson(getInitialContent(p));
        setEditorKey((k) => k + 1);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setPostNotFound(true);
        } else {
          toast.error(extractErrorMessage(err));
        }
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
        const alreadyAdded = c.images.find((img) => img.is_added_on_post);
        if (alreadyAdded) setAddedImageId(alreadyAdded.id);
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

  // ── Load image chat settings ─────────────────────────────────────────────────

  // Settings are per chat — load once the chat is open
  const chatId = chat?.id;
  useEffect(() => {
    if (!workspaceId || !chatId) return;
    imageChatService(workspaceId)
      .getSettings(chatId)
      .then(setImgSettings)
      .catch(() => {
        // keep defaults on failure
      });
  }, [workspaceId, chatId]);

  // ── Close settings popup on outside click ────────────────────────────────────

  useEffect(() => {
    if (!imgSettingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (imgSettingsRef.current && !imgSettingsRef.current.contains(e.target as Node))
        setImgSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [imgSettingsOpen]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node))
        setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  // Optimistic update — apply `next` locally, PATCH only the changed field, roll back on failure
  async function saveImgSettings(next: ImageChatSettings, patch: ImageChatSettingsPatch) {
    if (!chatId) return;
    const prev = imgSettings;
    setImgSettings(next);
    setImgSettingsSaving(true);
    try {
      await imageChatService(workspaceId).patchSettings(chatId, patch);
    } catch {
      setImgSettings(prev);
      toast.error("Failed to save settings.");
    } finally {
      setImgSettingsSaving(false);
    }
  }

  function handleImgSettingChange(value: boolean) {
    void saveImgSettings({ ...imgSettings, use_post_body: value }, { use_post_body: value });
  }

  function handleModelChange(modelName: string) {
    setModelMenuOpen(false);
    if (modelName === activeModel?.model_name) return;
    void saveImgSettings(
      {
        ...imgSettings,
        ai_model: imgSettings.ai_model.map((m) => ({
          ...m,
          is_active: m.model_name === modelName,
        })),
      },
      { ai_model: modelName }
    );
  }

  function handleRatioChange(ratio: string) {
    setRatioModalOpen(false);
    if (ratio === activeRatio?.ratio) return;
    void saveImgSettings(
      {
        ...imgSettings,
        image_ratio: imgSettings.image_ratio.map((r) => ({ ...r, is_active: r.ratio === ratio })),
      },
      { image_ratio: ratio }
    );
  }

  // ── Send message ────────────────────────────────────────────────────────────

  function handleSend() {
    void sendPrompt(input.trim(), true);
  }

  function handleAiGeneratedImage() {
    void sendPrompt(AI_GENERATED_IMAGE_PROMPT, false);
  }

  // fromInput: text came from the textarea — clear it on send, restore it on failure
  async function sendPrompt(text: string, fromInput: boolean) {
    if (!text || isSending || isChatRunning || !chat) return;
    setIsSending(true);
    if (fromInput) setInput("");
    // Optimistically append the user message immediately
    setChat((prev) => {
      if (!prev) return prev;
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        text,
        image: null,
        created_at: new Date().toISOString(),
      };
      return { ...prev, messages: [...prev.messages, optimistic] };
    });
    try {
      const c = await imageChatService(workspaceId).sendMessage(chat.id, text);
      setChat(c);
      if (c.status === "running") startPolling(c.id);
    } catch (err) {
      const msg = extractErrorMessage(err);
      toast.error(msg);
      // Remove the optimistic message and restore input on failure
      setChat((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: prev.messages.filter((m) => !m.id.startsWith("optimistic-")) };
      });
      if (fromInput) setInput(text);
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

  // Auto-grow the chat input upward with its content (same as the LinkedIn Agent composer):
  // grows up to CHAT_INPUT_MAX_ROWS lines, then stops and the text scrolls inside.
  // Shrinks back when the input is cleared on send.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const maxHeight = parseFloat(getComputedStyle(el).lineHeight) * CHAT_INPUT_MAX_ROWS;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

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

  if (postNotFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-page-bg px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
          <LuImage className="h-7 w-7 text-slate-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Post not found in this workspace</h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">
            This post belongs to a different workspace. Switch back to the correct workspace or
            navigate to one of the pages below.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/linkedin/automation"
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <LuBot className="h-4 w-4" />
            Go to Agent
          </a>
          <a
            href="/linkedin/post-management"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            <LuFileText className="h-4 w-4" />
            Post Management
          </a>
        </div>
      </div>
    );
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
                {isChatRunning && (
                  <span className="absolute inset-0 rounded-lg animate-ping bg-blue-300 opacity-30" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">Image Agent</span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {showScrollBtn && (
              <div className="absolute left-0 right-0 top-2 z-10 flex justify-center pointer-events-none">
                <button
                  onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <LuArrowLeft className="h-3 w-3 rotate-[-90deg]" />
                  Scroll to newest
                </button>
              </div>
            )}
            <div
              ref={chatContainerRef}
              className="h-full overflow-y-auto px-4 py-4"
              onScroll={() => {
                const el = chatContainerRef.current;
                if (!el) return;
                const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                setShowScrollBtn(distFromBottom > 120);
              }}
            >
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
                  {showAiImageSuggestion && (
                    <AiImageSuggestion onGenerate={handleAiGeneratedImage} />
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
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
                      void handleSend();
                    }
                  }}
                  placeholder="Describe the image you want…"
                  rows={2}
                  className="w-full resize-none overflow-y-auto bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                />
                {imgSettings.use_post_body && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                      <LuFileText className="h-3 w-3" />
                      <span>Post body</span>
                      <button
                        onClick={() => void handleImgSettingChange(false)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-violet-200 transition-colors"
                      >
                        <LuX className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="group relative">
                      <button disabled className="cursor-not-allowed rounded-md p-1 text-gray-300">
                        <LuPaperclip className="h-4 w-4" />
                      </button>
                      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Soon
                      </span>
                    </div>
                    <div className="group relative">
                      <button disabled className="cursor-not-allowed rounded-md p-1 text-gray-300">
                        <LuSmile className="h-4 w-4" />
                      </button>
                      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Soon
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* AI model */}
                    {imgSettings.ai_model.length > 0 && (
                      <div ref={modelMenuRef} className="relative">
                        <button
                          onClick={() => setModelMenuOpen((v) => !v)}
                          className={cn(
                            "flex h-7 items-center gap-1.5 rounded-lg border pr-2 pl-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50",
                            modelMenuOpen ? "border-violet-300 bg-violet-50" : "border-gray-300"
                          )}
                        >
                          <ModelAvatar model={activeModel} size="sm" />
                          <span className="max-w-28 truncate">{activeModel?.title ?? "Model"}</span>
                          <LuChevronDown
                            className={cn(
                              "h-3 w-3 text-gray-400 transition-transform",
                              modelMenuOpen && "rotate-180"
                            )}
                          />
                        </button>

                        {modelMenuOpen && (
                          <div className="absolute bottom-full right-0 z-20 mb-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                            <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">AI model</p>
                                <p className="text-xs text-gray-400">
                                  Choose the model that renders your images
                                </p>
                              </div>
                              <button
                                onClick={() => setModelMenuOpen(false)}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                              >
                                <LuX className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex flex-col gap-1 p-2">
                              {imgSettings.ai_model.map((m) => (
                                <button
                                  key={m.model_name}
                                  onClick={() => handleModelChange(m.model_name)}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                    m.is_active
                                      ? "border-violet-200 bg-violet-50"
                                      : "border-transparent hover:bg-gray-50"
                                  )}
                                >
                                  <ModelAvatar model={m} size="md" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900">
                                      {m.title}
                                    </p>
                                    <p className="truncate text-xs text-gray-400">{m.model_name}</p>
                                  </div>
                                  <span
                                    className={cn(
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                      m.is_active
                                        ? "border-violet-600 bg-violet-600 text-white"
                                        : "border-gray-300"
                                    )}
                                  >
                                    {m.is_active && <LuCheck className="h-3 w-3" />}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Image ratio */}
                    {imgSettings.image_ratio.length > 0 && (
                      <button
                        onClick={() => setRatioModalOpen(true)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-gray-300 px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                      >
                        <LuRatio className="h-3.5 w-3.5" />
                        <span>{activeRatio?.ratio ?? "Size"}</span>
                      </button>
                    )}

                    {/* Settings */}
                    <div ref={imgSettingsRef} className="relative">
                      <button
                        onClick={() => setImgSettingsOpen((v) => !v)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100",
                          imgSettingsSaving && "opacity-50"
                        )}
                      >
                        <LuSettings className="h-3.5 w-3.5" />
                      </button>

                      {imgSettingsOpen && (
                        <div className="absolute bottom-full right-0 z-20 mb-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm font-semibold text-gray-900">
                              Image agent settings
                            </span>
                            <button
                              onClick={() => setImgSettingsOpen(false)}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                            >
                              <LuX className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="divide-y divide-gray-100 px-4 pb-4">
                            <div className="flex items-start justify-between gap-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">Use post body</p>
                                <p className="text-xs text-gray-400">
                                  Include post text as context for image generation
                                </p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={imgSettings.use_post_body}
                                onClick={() =>
                                  void handleImgSettingChange(!imgSettings.use_post_body)
                                }
                                className={cn(
                                  "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
                                  imgSettings.use_post_body ? "bg-blue-600" : "bg-gray-200"
                                )}
                              >
                                <span
                                  className={cn(
                                    "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                                    imgSettings.use_post_body ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Send */}
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
                onClick={() => {
                  const convId = post?.single_post_conversation_id ?? post?.conversation_id;
                  if (convId) {
                    router.push(`/linkedin/automation?conv=${convId}`);
                  } else {
                    router.push(`/linkedin/automation?editPostId=${postId}`);
                  }
                }}
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

      {/* ── Image ratio picker ────────────────────────────────────────────────── */}
      <ImageRatioModal
        isOpen={ratioModalOpen}
        onClose={() => setRatioModalOpen(false)}
        options={imgSettings.image_ratio}
        onSelect={handleRatioChange}
      />
    </div>
  );
}
