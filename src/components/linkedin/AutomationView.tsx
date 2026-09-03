"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuPlus,
  LuHistory,
  LuSend,
  LuSettings,
  LuZap,
  LuDatabase,
  LuX,
  LuLoader,
  LuSquare,
  LuClock,
  LuPencil,
  LuCheck,
  LuChevronDown,
  LuPaperclip,
  LuLink,
  LuUpload,
  LuTrash2,
  LuFilter,
} from "react-icons/lu";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import toast from "react-hot-toast";
import Link from "next/link";
import KnowledgeBaseModal from "./KnowledgeBaseModal";
import EditDraftModal from "./EditDraftModal";
import AllDraftsModal from "./AllDraftsModal";
import type {
  Attachment,
  Conversation,
  ConversationListItem,
  PaginatedConversations,
  Question,
  AgentPost,
  AgentSettings,
  BlockNode,
  SpanNode,
} from "@/types/LinkedInAgent";

// ─── constants ────────────────────────────────────────────────────────────────

const PROMPT_SUGGESTIONS = [
  { text: "Give me 5 drafts for LinkedIn", tag: null },
  { text: "Write a launch announcement", tag: null },
  { text: "Draft a hiring post", tag: null },
  {
    text: `5 thought-leadership posts for SaaS, confident & punchy tone, 3 hashtags, spread over 2 weeks`,
    tag: "All details included · skips questions",
  },
];

const POLL_INTERVAL_MS = 2000;

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatSuggestedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}

function renderBlocks(blocksInput: BlockNode[] | string, fallback: string): React.ReactNode {
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

  if (blocks.length === 0) {
    return <span>{fallback}</span>;
  }

  return (
    <>
      {blocks.map((block, i) => {
        const isFirst = i === 0;
        if (block.type === "paragraph") {
          return (
            <p key={i} className={cn(!isFirst && "mt-3")}>
              {block.spans.map((span: SpanNode, j: number) =>
                span.bold ? <strong key={j}>{span.text}</strong> : <span key={j}>{span.text}</span>
              )}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className={cn("space-y-1", !isFirst && !block.tight && "mt-3")}>
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-1.5">
                  <span className="shrink-0 text-gray-400">{block.marker}</span>
                  <span>
                    {item.spans.map((span: SpanNode, k: number) =>
                      span.bold ? (
                        <strong key={k}>{span.text}</strong>
                      ) : (
                        <span key={k}>{span.text}</span>
                      )
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

function getBodyPreview(blocksInput: BlockNode[] | string, fallback: string): string {
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
  if (blocks.length === 0) return fallback;
  return blocks
    .flatMap((block) => {
      if (block.type === "paragraph") return block.spans.map((s) => s.text);
      if (block.type === "list")
        return block.items.flatMap((item) => item.spans.map((s) => s.text));
      return [];
    })
    .join(" ");
}

function hasPendingInterrupt(conv: Conversation): boolean {
  const pi = conv.pending_interrupt as { id?: string };
  return !!pi?.id;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// Question form field
function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  // Local free-text state for allow_free_text choice questions.
  // freeText overrides the select when non-empty.
  const [freeText, setFreeText] = useState("");

  if (question.kind === "choice" && question.options && question.options.length > 0) {
    if (question.allow_free_text) {
      return (
        <div className="space-y-2">
          <div className="relative">
            <select
              value={freeText ? "" : value}
              onChange={(e) => {
                setFreeText("");
                onChange(e.target.value);
              }}
              className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            >
              {question.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <LuChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <input
            type="text"
            value={freeText}
            placeholder="Or type your own…"
            onChange={(e) => {
              setFreeText(e.target.value);
              onChange(e.target.value || value);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
        </div>
      );
    }

    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        >
          {question.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <LuChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    );
  }

  if (question.kind === "number") {
    return (
      <input
        type="number"
        value={value}
        min={question.min}
        max={question.max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      placeholder="(optional)"
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
    />
  );
}

// Grill form — renders pending_interrupt questions
function GrillForm({
  questions: rawQuestions,
  onSubmit,
  submitting,
}: {
  questions: Question[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
  submitting: boolean;
}) {
  // guard against undefined/null entries from API
  const questions = (rawQuestions ?? []).filter((q): q is Question => !!q && typeof q === "object");

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      init[q.id] = q.default !== undefined ? String(q.default) : (q.options?.[0] ?? "");
    }
    return init;
  });

  if (questions.length === 0) return null;

  // full-width: text kind, allow_free_text (two stacked inputs), or last in an odd count
  const pairs: Question[][] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    const next = questions[i + 1];
    const isFullWidth = q.kind === "text" || q.allow_free_text || !next;
    if (isFullWidth) {
      pairs.push([q]);
      i++;
    } else {
      pairs.push([q, next]);
      i += 2;
    }
  }

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="space-y-4">
          {pairs.map((row, ri) => (
            <div
              key={ri}
              className={cn("grid gap-4", row.length === 2 ? "grid-cols-2" : "grid-cols-1")}
            >
              {row.map((q) => (
                <div key={q.id}>
                  <label className="mb-1.5 block text-xs font-semibold text-blue-600">
                    {q.question}
                  </label>
                  <QuestionField
                    question={q}
                    value={answers[q.id] ?? ""}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <button
          onClick={() => onSubmit(answers)}
          disabled={submitting}
          className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
          Generate drafts
        </button>
      </div>
    </div>
  );
}

// Headlines form — editable list: keep / reword / delete / add custom
function HeadlinesForm({
  headlines: initial,
  onSubmit,
  submitting,
}: {
  headlines: string[];
  onSubmit: (headlines: string[]) => void;
  submitting: boolean;
}) {
  const [items, setItems] = useState(() => initial.map((text, i) => ({ id: String(i), text })));

  const update = (id: string, text: string) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));

  const remove = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const addCustom = () => setItems((prev) => [...prev, { id: String(Date.now()), text: "" }]);

  const final = items.map((i) => i.text.trim()).filter(Boolean);

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-5">
        <p className="mb-1 text-sm font-semibold text-gray-800">Edit first lines</p>
        <p className="mb-4 text-xs text-gray-400">
          Each line becomes one post. Edit, delete, or add your own — what you send is what gets
          written.
        </p>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text"
                value={item.text}
                onChange={(e) => update(item.id, e.target.value)}
                placeholder="Write a first line…"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
              <button
                onClick={() => remove(item.id)}
                className="shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                title="Remove"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addCustom}
          className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700"
        >
          <LuPlus className="h-4 w-4" />
          Add headline
        </button>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {final.length} post{final.length !== 1 ? "s" : ""} will be written
          </p>
          <button
            onClick={() => onSubmit(final)}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            Generate {final.length > 0 ? final.length : ""} draft{final.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// Single draft card
function DraftCard({ post, onEdit }: { post: AgentPost; onEdit: (post: AgentPost) => void }) {
  const hasImage = !!post.image_url;
  const dateStr = formatSuggestedDate(post.suggested_publish_at);

  return (
    // Outer wrapper: overflow-visible so floating buttons protrude above top border
    <div className="relative h-72 w-80 shrink-0">
      {/* ✓ × floating on the top border — half-outside the card */}
      <div className="absolute right-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5">
        <button className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-500">
          <LuCheck className="h-3.5 w-3.5" />
        </button>
        <button className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-400">
          <LuX className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card — overflow-hidden clips body text naturally at card boundary */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
        {/* Title row */}
        <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
          {post.headline ? (
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
              {post.headline}
            </p>
          ) : (
            <span />
          )}
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            Draft
          </span>
        </div>

        {/* Scheduled time */}
        {dateStr && (
          <div className="mb-2 flex shrink-0 items-center gap-1 text-xs text-gray-400">
            <LuClock className="h-3 w-3 shrink-0" />
            <span>{dateStr}</span>
          </div>
        )}

        {/* Image — only shown when URL exists */}
        {hasImage && (
          <div className="mb-2 flex h-24 shrink-0 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        {/* Body — rich text when no image (fills height); plain truncated when image present */}
        <div className="min-h-0 flex-1 overflow-hidden pb-8 text-xs leading-relaxed text-gray-600">
          {hasImage ? (
            <p className="line-clamp-3">{getBodyPreview(post.body_blocks, post.body)}</p>
          ) : (
            renderBlocks(post.body_blocks, post.body)
          )}
        </div>

        {/* Edit pencil — bottom right */}
        <button
          onClick={() => onEdit(post)}
          className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
        >
          <LuPencil className="h-3 w-3" />
          Edit
        </button>
      </div>
    </div>
  );
}

// Draft cards section
function DraftsSection({
  posts,
  onEdit,
  onViewAll,
}: {
  posts: AgentPost[];
  onEdit: (post: AgentPost) => void;
  onViewAll: (posts: AgentPost[]) => void;
}) {
  const draftPosts = posts.filter((p) => p.status === "draft");

  return (
    <div className="mt-2">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">Your drafts</span>
          {draftPosts.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {draftPosts.length} to approve
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/linkedin/post-management"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Go to Post management
          </Link>
          <button
            onClick={() => onViewAll(posts)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            View all drafts
          </button>
        </div>
      </div>

      {/* Horizontal scroll — pt-4 gives room for the floating ✓/× buttons */}
      <div className="flex gap-3 overflow-x-auto pt-4 pb-2">
        {posts.map((post) => (
          <DraftCard key={post.id} post={post} onEdit={onEdit} />
        ))}
      </div>

      {/* Generate more */}
      <button className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700">
        <LuPlus className="h-4 w-4" />
        Generate more drafts
      </button>
    </div>
  );
}

// Thinking / running indicator — cycles through status steps like Claude
const THINKING_STEPS = [
  "Thinking…",
  "Reading your sources…",
  "Analyzing your profile…",
  "Crafting your angle…",
  "Optimizing prompt…",
  "Writing drafts…",
  "Almost done…",
];

function ThinkingIndicator() {
  const [stepIndex, setStepIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setStepIndex((i) => (i < THINKING_STEPS.length - 1 ? i + 1 : i));
        setFade(true);
      }, 300);
    }, 3500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
        <LuPlus className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
        </div>
        <span
          className="text-sm text-gray-500 transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {THINKING_STEPS[stepIndex]}
        </span>
      </div>
    </div>
  );
}

// ─── history helpers ──────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function groupConversations(items: ConversationListItem[]) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const last7Start = new Date(todayStart);
  last7Start.setDate(last7Start.getDate() - 7);

  const groups: { label: string; items: ConversationListItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const item of items) {
    const t = new Date(item.updated_at).getTime();
    if (t >= todayStart.getTime()) groups[0].items.push(item);
    else if (t >= yesterdayStart.getTime()) groups[1].items.push(item);
    else if (t >= last7Start.getTime()) groups[2].items.push(item);
    else groups[3].items.push(item);
  }

  return groups.filter((g) => g.items.length > 0);
}

// ─── history sidebar item ─────────────────────────────────────────────────────

function HistoryItem({
  item,
  active,
  onClick,
  onDelete,
}: {
  item: ConversationListItem;
  active: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-lg px-3 py-2.5 text-left transition-colors",
        active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
      )}
    >
      <p className="truncate pr-7 text-sm font-medium">{item.title || "Untitled conversation"}</p>
      <p className="mt-0.5 text-xs text-gray-400">{relativeTime(item.updated_at)}</p>
      <span
        role="button"
        onClick={onDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        <LuTrash2 className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AutomationView() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  // UI state
  const [message, setMessage] = useState("");
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [addingUrl, setAddingUrl] = useState(false);

  // Conversation state
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [sending, setSending] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [history, setHistory] = useState<PaginatedConversations | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editPost, setEditPost] = useState<AgentPost | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllPosts, setViewAllPosts] = useState<AgentPost[]>([]);
  const [restoringConv, setRestoringConv] = useState(true);

  // Settings
  const [settings, setSettings] = useState<AgentSettings>({
    post_count: 5,
    use_hashtags: true,
    use_emoji: false,
    use_knowledge: true,
    use_ai_image: true,
    ignore_headline: false,
    ignore_grilling: false,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // refs
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const svc = useCallback(() => linkedinAgentService(workspaceId), [workspaceId]);

  // ── polling ──
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchPosts = useCallback(
    async (postIds: string[]) => {
      if (!postIds.length) return;
      try {
        const data = await svc().getAgentPosts({ pageSize: 50 });
        const byId = new Map(data.results.map((p) => [p.id, p]));
        const ordered = postIds.map((id) => byId.get(id)).filter(Boolean) as AgentPost[];
        setPosts(ordered);
      } catch {
        // ignore
      }
    },
    [svc]
  );

  const refreshHistory = useCallback(async () => {
    try {
      const data = await svc().getConversations();

      setHistory(data);
    } catch {
      // ignore
    }
  }, [svc]);

  const handlePollResult = useCallback(
    (conv: Conversation) => {
      setConversation(conv);
      if (conv.status === "running") return; // keep polling
      if (conv.attachments?.some((a) => a.status === "pending")) return; // keep polling for attachments
      stopPolling();
      if (conv.status === "completed") {
        refreshHistory();
        if (conv.artifacts.post_ids.length > 0) {
          fetchPosts(conv.artifacts.post_ids);
        }
      }
    },
    [stopPolling, fetchPosts, refreshHistory]
  );

  const startPolling = useCallback(
    (convId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const conv = await svc().getConversation(convId);
          handlePollResult(conv);
          if (conv.status !== "running") stopPolling();
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [svc, stopPolling, handlePollResult]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── restore conversation on mount ──
  // Priority: ?conv= URL param → last conversation from history → empty state
  useEffect(() => {
    if (!workspaceId) return;

    async function restore() {
      try {
        const params = new URLSearchParams(window.location.search);
        const convId = params.get("conv");

        const targetId =
          convId ??
          (await svc()
            .getConversations(1, 1)
            .then((r) => r.results[0]?.id ?? null)
            .catch(() => null));

        if (!targetId) return;

        const conv = await svc().getConversation(targetId);
        setConversation(conv);
        if (conv.status === "running") startPolling(conv.id);
        if (conv.status === "completed" && conv.artifacts.post_ids.length > 0) {
          fetchPosts(conv.artifacts.post_ids);
        }
      } catch {
        window.history.replaceState(null, "", window.location.pathname);
      } finally {
        setRestoringConv(false);
      }
    }

    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // ── write conv id to URL when conversation changes ──
  useEffect(() => {
    if (!conversation?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("conv") === conversation.id) return;
    params.set("conv", conversation.id);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [conversation?.id]);

  // ── scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, conversation?.status, posts]);

  // ── load settings once ──
  useEffect(() => {
    if (!workspaceId || settingsLoaded) return;
    svc()
      .getSettings()
      .then((s) => {
        setSettings(s);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [workspaceId, settingsLoaded, svc]);

  // ── click-outside handlers ──
  useEffect(() => {
    if (!promptOpen) return;
    const h = (e: MouseEvent) => {
      if (promptRef.current && !promptRef.current.contains(e.target as Node)) setPromptOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [promptOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [settingsOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [filterOpen]);

  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  // ── send first message (creates conversation) ──
  const handleSend = async () => {
    const text = message.trim();
    if (!text || !workspaceId) return;
    setSending(true);
    setMessage("");
    try {
      let convId = conversation?.id;

      if (!convId || conversation?.status === "archived") {
        const newConv = await svc().createConversation();
        convId = newConv.id;
        setConversation(newConv);
        setPosts([]);
      }

      await svc().sendMessage(convId!, text);
      // optimistically show user message
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              status: "running",
              messages: [
                ...prev.messages,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  kind: "text",
                  text,
                  payload: {},
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : prev
      );
      startPolling(convId!);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  // ── answer pending interrupt ──
  const handleAnswer = async (answers: Record<string, string | string[]>) => {
    if (!conversation || !workspaceId) return;
    const pi = conversation.pending_interrupt as { id?: string };
    if (!pi?.id) return;
    setAnswering(true);
    try {
      await svc().answerQuestion(conversation.id, pi.id, answers);
      setConversation((prev) => (prev ? { ...prev, status: "running" } : prev));
      startPolling(conversation.id);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAnswering(false);
    }
  };

  // ── ensure conversation exists (shared by attach handlers) ──
  const ensureConversation = async (): Promise<string | null> => {
    if (!workspaceId) return null;
    if (conversation?.id && conversation.status !== "archived") return conversation.id;
    const newConv = await svc().createConversation();
    setConversation(newConv);
    setPosts([]);
    return newConv.id;
  };

  // ── attach file (PDF only) ──
  const handleFileAttach = async (file: File) => {
    if ((conversation?.attachments?.length ?? 0) >= 5) {
      toast.error("Maximum 5 attachments per conversation.");
      return;
    }
    setUploadingAttachment(true);
    try {
      const convId = await ensureConversation();
      if (!convId) return;
      const att = await svc().uploadAttachment(convId, file);
      setConversation((prev) =>
        prev ? { ...prev, attachments: [...(prev.attachments ?? []), att] } : prev
      );
      startPolling(convId);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUploadingAttachment(false);
    }
  };

  // ── attach URL ──
  const handleUrlAttach = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if ((conversation?.attachments?.length ?? 0) >= 5) {
      toast.error("Maximum 5 attachments per conversation.");
      return;
    }
    setAddingUrl(true);
    setUrlInput("");
    setPlusOpen(false);
    try {
      const convId = await ensureConversation();
      if (!convId) return;
      const att = await svc().addAttachmentUrl(convId, trimmed);
      setConversation((prev) =>
        prev ? { ...prev, attachments: [...(prev.attachments ?? []), att] } : prev
      );
      startPolling(convId);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAddingUrl(false);
    }
  };

  // ── delete attachment ──
  const handleDeleteAttachment = async (aid: string) => {
    if (!conversation?.id) return;
    try {
      await svc().deleteAttachment(conversation.id, aid);
      setConversation((prev) =>
        prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== aid) } : prev
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  // ── cancel ──
  const handleCancel = async () => {
    if (!conversation) return;
    setCancelling(true);
    try {
      const updated = await svc().cancelConversation(conversation.id);
      setConversation(updated);
      stopPolling();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  // ── new chat ──
  const handleNewChat = () => {
    stopPolling();
    setConversation(null);
    setPosts([]);
    setMessage("");
    setUrlInput("");
    window.history.replaceState(null, "", window.location.pathname);
    textareaRef.current?.focus();
  };

  // ── restore history panel open state after hydration ──
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem("agent-history-open") === "true") setHistoryOpen(true);
  }, []);

  // ── persist history panel open state ──
  useEffect(() => {
    localStorage.setItem("agent-history-open", String(historyOpen));
  }, [historyOpen]);

  // ── load history whenever panel opens (or workspaceId changes while open) ──
  useEffect(() => {
    if (!historyOpen || !workspaceId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryLoading(true);
    svc()
      .getConversations()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen, workspaceId]);

  // ── toggle history panel (loading is handled by the effect above) ──
  const handleOpenHistory = () => {
    setHistoryOpen((v) => !v);
  };

  // ── load conversation from history ──
  const handleLoadConversation = async (id: string) => {
    stopPolling();
    setPosts([]);
    try {
      const conv = await svc().getConversation(id);
      setConversation(conv);
      if (conv.status === "running") startPolling(id);
      if (conv.status === "completed" && conv.artifacts.post_ids.length > 0) {
        fetchPosts(conv.artifacts.post_ids);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  // ── delete conversation ──
  const handleDeleteConversation = async (id: string) => {
    try {
      await svc().deleteConversation(id);
      setHistory((prev) =>
        prev ? { ...prev, results: prev.results.filter((c) => c.id !== id) } : prev
      );
      if (conversation?.id === id) handleNewChat();
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  // ── save settings ──
  const handleSettingChange = async (key: keyof AgentSettings, value: boolean | number) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSettingsSaving(true);
    try {
      await svc().patchSettings({ [key]: value });
    } catch {
      // revert
      setSettings(settings);
      toast.error("Failed to save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── derived state ──
  const isRunning = conversation?.status === "running";
  const isAwaiting = conversation?.status === "awaiting_input";
  const isCompleted = conversation?.status === "completed";
  const isFailed = conversation?.status === "failed";
  const isTerminal = conversation?.status === "cancelled" || conversation?.status === "archived";
  const hasPendingAttachments =
    conversation?.attachments?.some((a) => a.status === "pending") ?? false;
  const canSend =
    !sending &&
    !isRunning &&
    !isAwaiting &&
    !hasPendingAttachments &&
    (!conversation || isCompleted || isFailed || isTerminal || !conversation);
  const showCancel = isRunning || isAwaiting;

  const pendingInterrupt =
    conversation && hasPendingInterrupt(conversation)
      ? (conversation.pending_interrupt as {
          id: string;
          kind: "questions" | "headlines" | string;
          questions?: Question[];
          headlines?: string[];
        })
      : null;

  const isHeadlineInterrupt = pendingInterrupt?.kind === "headlines";

  // safe questions array (filter out any undefined entries the API might return)
  const piQuestions = (pendingInterrupt?.questions ?? []).filter(
    (q): q is Question => !!q && typeof q === "object"
  );

  const sourceCount = 0; // would come from knowledge base query

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Page header */}
      <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn Agent</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate post drafts, approve them, and let Relay schedule &amp; publish.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-5">
        {/* Top bar — Knowledge base + Filter + active chips */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Knowledge base button */}
          <button
            onClick={() => setKnowledgeOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            <LuDatabase className="h-3.5 w-3.5 text-gray-400" />
            Knowledge base
            {sourceCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-medium text-blue-600">{sourceCount} sources</span>
              </>
            )}
          </button>

          {/* Filter dropdown */}
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                filterOpen
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <LuFilter className="h-3.5 w-3.5" />
              Filter
              <LuChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-150",
                  filterOpen && "rotate-180"
                )}
              />
            </button>

            {filterOpen && (
              <div className="absolute left-0 top-full z-20 mt-1.5 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                <p className="px-4 pt-3.5 pb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Composer defaults
                </p>
                <div className="divide-y divide-gray-100 px-4 pb-3">
                  {/* Ask questions */}
                  <label className="flex cursor-pointer items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={!settings.ignore_grilling}
                      onChange={(e) => handleSettingChange("ignore_grilling", !e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Ask me questions first</p>
                      <p className="text-xs text-gray-400">
                        If off, skips straight to headlines using your defaults
                      </p>
                    </div>
                  </label>
                  {/* Show headlines */}
                  <label className="flex cursor-pointer items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={!settings.ignore_headline}
                      onChange={(e) => handleSettingChange("ignore_headline", !e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Show headlines to pick from
                      </p>
                      <p className="text-xs text-gray-400">If off, drafts are generated directly</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Active filter chips */}
          {!settings.ignore_grilling && (
            <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-600">
              Questions before drafting
              <button
                onClick={() => handleSettingChange("ignore_grilling", true)}
                className="ml-0.5 text-blue-400 hover:text-blue-600"
              >
                <LuX className="h-3 w-3" />
              </button>
            </span>
          )}
          {!settings.ignore_headline && (
            <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-600">
              Headlines before drafting
              <button
                onClick={() => handleSettingChange("ignore_headline", true)}
                className="ml-0.5 text-blue-400 hover:text-blue-600"
              >
                <LuX className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {/* Agent composer card */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <LuPlus className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">Agent composer</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-gray-400 lg:block">
                Everything happens in chat — drafts appear here for approval
              </span>

              {/* History */}
              <button
                onClick={handleOpenHistory}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
              >
                <LuHistory className="h-3.5 w-3.5" />
                History
              </button>

              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-100"
              >
                <LuPlus className="h-3.5 w-3.5" />
                New chat
              </button>
            </div>
          </div>

          {/* Body row — history panel + chat */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* History panel */}
            {historyOpen && (
              <div className="flex w-60 shrink-0 flex-col border-r border-gray-100">
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
                  <span className="text-sm font-semibold text-gray-900">Chat history</span>
                  <button
                    onClick={() => setHistoryOpen(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <LuX className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <button
                    onClick={handleNewChat}
                    className="mb-4 mt-1 flex w-full items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-100"
                  >
                    <LuPlus className="h-3.5 w-3.5" />
                    New chat
                  </button>
                  {historyLoading ? (
                    <div className="flex items-center gap-2 px-3 py-6 text-sm text-gray-400">
                      <LuLoader className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : !history?.results.length ? (
                    <p className="px-3 py-6 text-sm text-gray-400">No conversations yet.</p>
                  ) : (
                    groupConversations(history.results).map((group) => (
                      <div key={group.label} className="mb-4">
                        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {group.label}
                        </p>
                        {group.items.map((item) => (
                          <HistoryItem
                            key={item.id}
                            item={item}
                            active={item.id === conversation?.id}
                            onClick={() => handleLoadConversation(item.id)}
                            onDelete={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(item.id);
                            }}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Chat column */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-6">
                {/* Loading state while restoring conversation */}
                {restoringConv && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                      <LuPlus className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm text-gray-400">
                      <LuLoader className="h-4 w-4 animate-spin" />
                      Loading conversation…
                    </div>
                  </div>
                )}

                {/* Welcome message — only after restore completes with no conversation */}
                {!restoringConv && !conversation && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                      <LuPlus className="h-4 w-4 text-white" />
                    </div>
                    <div className="max-w-xl rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                      Tell me what you want and I&apos;ll research your brand, ask a couple of quick
                      questions, then draft posts right here for you to approve.
                    </div>
                  </div>
                )}

                {/* Conversation messages */}
                {conversation?.messages.map((msg) => {
                  if (msg.role === "user") {
                    // Answer message — empty text, render summary from payload.answers
                    if (!msg.text && msg.kind === "text") {
                      const answers = msg.payload.answers as
                        Record<string, string | string[]> | undefined;
                      if (!answers) return null;
                      const parts: string[] = [];
                      for (const [key, val] of Object.entries(answers)) {
                        if (Array.isArray(val)) {
                          parts.push(
                            key === "headlines"
                              ? `Approved ${val.length} headline${val.length !== 1 ? "s" : ""}`
                              : `${val.length} selected`
                          );
                        } else if (val) {
                          parts.push(val);
                        }
                      }
                      const summary = parts.join(" · ");
                      return (
                        <div key={msg.id} className="mt-4 flex justify-end">
                          <div className="max-w-md rounded-2xl rounded-tr-sm bg-blue-100 px-4 py-3 text-sm leading-relaxed text-blue-800">
                            {summary || "✓ Answered"}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="mt-4 flex justify-end">
                        <div className="max-w-md rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm leading-relaxed text-white">
                          {msg.text}
                        </div>
                      </div>
                    );
                  }

                  // Agent messages — edit turn
                  if (msg.kind === "edit") {
                    const field = msg.payload.field as "text" | "image" | undefined;
                    return (
                      <div key={msg.id} className="mt-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600">
                          <LuPencil className="h-4 w-4 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                            <LuPencil className="h-3 w-3" />
                            {field === "image" ? "Image updated" : "Post edited"}
                          </div>
                          {msg.text && (
                            <div className="rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                              {msg.text}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Agent messages — posts message: render inline with its own drafts
                  if (msg.kind === "posts") {
                    const msgPostIds = (msg.payload.post_ids as string[] | undefined) ?? [];
                    const msgPosts = posts.filter((p) => msgPostIds.includes(p.id));
                    return (
                      <div key={msg.id} className="mt-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                          <LuPlus className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="mb-3 inline-block rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                            {msg.text}
                          </div>
                          {msgPosts.length > 0 && (
                            <DraftsSection
                              posts={msgPosts}
                              onEdit={setEditPost}
                              onViewAll={(p) => {
                                setViewAllPosts(p);
                                setViewAllOpen(true);
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="mt-4 flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                        <LuPlus className="h-4 w-4 text-white" />
                      </div>
                      <div
                        className={cn(
                          "max-w-xl rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed",
                          msg.kind === "error"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-50 text-gray-700"
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {/* Awaiting input — headline round */}
                {isAwaiting && isHeadlineInterrupt && pendingInterrupt && (
                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                      <LuPlus className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <HeadlinesForm
                        headlines={pendingInterrupt.headlines ?? []}
                        submitting={answering}
                        onSubmit={(headlines) => handleAnswer({ headlines })}
                      />
                    </div>
                  </div>
                )}

                {/* Awaiting input — question form */}
                {isAwaiting &&
                  !isHeadlineInterrupt &&
                  pendingInterrupt &&
                  piQuestions.length > 0 && (
                    <div className="mt-4 flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                        <LuPlus className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="inline-block max-w-xl rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                          Great — a few quick things so I draft the right posts. You can change any
                          of these.
                        </div>
                        <GrillForm
                          questions={piQuestions}
                          onSubmit={handleAnswer}
                          submitting={answering}
                        />
                      </div>
                    </div>
                  )}

                {/* Running indicator */}
                {isRunning && (
                  <div className="mt-4">
                    <ThinkingIndicator />
                  </div>
                )}

                {/* Terminal states */}
                {isTerminal && (
                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-400">
                      <LuPlus className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      {conversation?.status === "archived" ? (
                        <>
                          This conversation was archived after 7 days.{" "}
                          <button
                            onClick={handleNewChat}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            Start a new one
                          </button>
                        </>
                      ) : (
                        "Generation stopped. You can keep chatting or send a new message."
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="shrink-0 border-t border-gray-100 px-5 py-4">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && canSend && message.trim()) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isAwaiting
                      ? "Answer the questions above…"
                      : isRunning
                        ? "Agent is working…"
                        : "e.g. Give me 5 LinkedIn drafts about our brand..."
                  }
                  disabled={isRunning || isAwaiting}
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none disabled:opacity-50"
                />

                {/* Attachment chips */}
                {(conversation?.attachments?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {conversation!.attachments.map((a: Attachment) => {
                      const isPending = a.status === "pending";
                      const isFailed = a.status === "failed";
                      const chipCls = isFailed
                        ? "border-red-200 bg-red-50 text-red-700"
                        : isPending
                          ? "border-gray-200 bg-gray-50 text-gray-500"
                          : "border-blue-200 bg-blue-50 text-blue-700";
                      return (
                        <span
                          key={a.id}
                          title={isFailed ? a.error : undefined}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${chipCls}`}
                        >
                          {isPending ? (
                            <LuLoader className="h-3 w-3 shrink-0 animate-spin" />
                          ) : a.kind === "url" ? (
                            <LuLink className="h-3 w-3 shrink-0" />
                          ) : (
                            <LuPaperclip className="h-3 w-3 shrink-0" />
                          )}
                          <span className="max-w-[140px] truncate">{a.label}</span>
                          {isFailed && (
                            <span className="shrink-0 text-[10px] text-red-400">Failed</span>
                          )}
                          <button
                            onClick={() => handleDeleteAttachment(a.id)}
                            className="shrink-0 opacity-60 hover:opacity-100"
                          >
                            <LuX className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Hidden file input — PDF only */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = "";
                    setPlusOpen(false);
                    handleFileAttach(file);
                  }}
                />

                <div className="mt-3 flex items-center justify-between">
                  {/* Prompt suggestions */}
                  <div ref={promptRef} className="relative">
                    <button
                      onClick={() => setPromptOpen((v) => !v)}
                      disabled={isRunning || isAwaiting}
                      className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      <LuZap className="h-3.5 w-3.5" />
                      Prompt suggestions
                    </button>

                    {promptOpen && (
                      <div className="absolute bottom-full left-0 z-20 mb-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                        <div className="divide-y divide-gray-100">
                          {PROMPT_SUGGESTIONS.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setMessage(s.text);
                                setPromptOpen(false);
                              }}
                              className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50"
                            >
                              <p className="text-sm text-gray-800">{s.text}</p>
                              {s.tag && (
                                <span className="mt-1 inline-block text-xs font-medium text-teal-600">
                                  {s.tag}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right-side actions */}
                  <div className="flex items-center gap-2">
                    {/* Cancel */}
                    {showCancel && (
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        {cancelling ? (
                          <LuLoader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LuSquare className="h-3.5 w-3.5" />
                        )}
                        Cancel
                      </button>
                    )}

                    {/* Plus — file / URL attach */}
                    <div ref={plusRef} className="relative">
                      <button
                        onClick={() => setPlusOpen((v) => !v)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100"
                      >
                        <LuPlus className="h-4 w-4" />
                      </button>

                      {plusOpen && (
                        <div className="absolute bottom-full right-0 z-20 mb-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-lg">
                          {(conversation?.attachments?.length ?? 0) >= 5 && (
                            <p className="mb-2 text-center text-xs text-amber-600">
                              Maximum 5 attachments reached.
                            </p>
                          )}
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={
                              uploadingAttachment || (conversation?.attachments?.length ?? 0) >= 5
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {uploadingAttachment ? (
                              <LuLoader className="h-4 w-4 animate-spin text-gray-400" />
                            ) : (
                              <LuUpload className="h-4 w-4 text-gray-400" />
                            )}
                            {uploadingAttachment ? "Uploading…" : "Upload a PDF"}
                          </button>
                          <div className="mt-2 flex gap-2">
                            <input
                              type="url"
                              placeholder="Paste a URL"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUrlAttach(urlInput);
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                            />
                            <button
                              disabled={
                                !urlInput.trim() ||
                                addingUrl ||
                                (conversation?.attachments?.length ?? 0) >= 5
                              }
                              onClick={() => handleUrlAttach(urlInput)}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                              {addingUrl ? (
                                <LuLoader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Add"
                              )}
                            </button>
                          </div>
                          <p className="mt-2 text-center text-[10px] text-gray-400">
                            PDF or URL · used only in this conversation
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Settings */}
                    <div ref={settingsRef} className="relative">
                      <button
                        onClick={() => setSettingsOpen((v) => !v)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100",
                          settingsSaving && "opacity-50"
                        )}
                      >
                        <LuSettings className="h-4 w-4" />
                      </button>

                      {settingsOpen && (
                        <div className="absolute bottom-full right-0 z-20 mb-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm font-semibold text-gray-900">
                              Composer settings
                            </span>
                            <button
                              onClick={() => setSettingsOpen(false)}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                            >
                              <LuX className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="divide-y divide-gray-100 px-4 pb-4">
                            {/* Post count */}
                            <div className="flex items-center justify-between gap-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">Posts per batch</p>
                                <p className="text-xs text-gray-400">
                                  How many drafts per run (1–20)
                                </p>
                              </div>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={settings.post_count}
                                onChange={(e) => {
                                  const n = Math.min(20, Math.max(1, Number(e.target.value)));
                                  if (!isNaN(n)) handleSettingChange("post_count", n);
                                }}
                                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                              />
                            </div>

                            {/* Content toggles */}
                            <div className="flex items-start justify-between gap-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">Use emoji</p>
                                <p className="text-xs text-gray-400">Sprinkle emoji into drafts</p>
                              </div>
                              <Toggle
                                checked={settings.use_emoji}
                                onChange={(v) => handleSettingChange("use_emoji", v)}
                              />
                            </div>
                            <div className="flex items-start justify-between gap-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">Use hashtags</p>
                                <p className="text-xs text-gray-400">Add hashtags to each draft</p>
                              </div>
                              <Toggle
                                checked={settings.use_hashtags}
                                onChange={(v) => handleSettingChange("use_hashtags", v)}
                              />
                            </div>
                            <div className="flex items-start justify-between gap-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">Use AI image</p>
                                <p className="text-xs text-gray-400">
                                  Generate a visual for each draft
                                </p>
                              </div>
                              <Toggle
                                checked={settings.use_ai_image}
                                onChange={(v) => handleSettingChange("use_ai_image", v)}
                              />
                            </div>
                            <div className="flex items-start justify-between gap-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  Use knowledge base
                                </p>
                                <p className="text-xs text-gray-400">
                                  Ground drafts in your connected sources
                                </p>
                              </div>
                              <Toggle
                                checked={settings.use_knowledge}
                                onChange={(v) => handleSettingChange("use_knowledge", v)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Send */}
                    <button
                      onClick={handleSend}
                      disabled={!canSend || !message.trim() || sending}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
                        canSend && message.trim()
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-blue-600 opacity-50"
                      )}
                    >
                      {sending ? (
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LuSend className="h-3.5 w-3.5" />
                      )}
                      Send
                    </button>
                  </div>
                </div>
              </div>
              {/* /chat column */}
            </div>
            {/* /body row */}
          </div>
        </div>
      </div>

      <KnowledgeBaseModal isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />

      <EditDraftModal post={editPost} onClose={() => setEditPost(null)} />

      <AllDraftsModal
        isOpen={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        posts={viewAllPosts}
        onEdit={(post) => {
          setViewAllOpen(false);
          setEditPost(post);
        }}
      />
    </div>
  );
}
