"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useAgentSettings } from "@/hooks/useAgentSettings";
import {
  LuPlus,
  LuHistory,
  LuSend,
  LuSettings,
  LuZap,
  LuDatabase,
  LuX,
  LuLoader,
  LuClock,
  LuPencil,
  LuCheck,
  LuChevronDown,
  LuPaperclip,
  LuLink,
  LuUpload,
  LuTrash2,
  LuAlignLeft,
  LuImage,
  LuSparkles,
  LuCpu,
  LuUndo2,
  LuBookOpen,
} from "react-icons/lu";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import { postsService } from "@/service/postsService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import toast from "react-hot-toast";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import KnowledgeBaseModal from "./KnowledgeBaseModal";
import EditDraftModal from "./EditDraftModal";
import AllDraftsModal from "./AllDraftsModal";
import VersionHistoryModal from "./VersionHistoryModal";
import SourceIcon from "./SourceIcon";
import { agentService } from "@/service/agentService";
import type { ProfileDocument, ProfileWebsite } from "@/types/Agent";
import type {
  Attachment,
  Conversation,
  ConversationListItem,
  PaginatedConversations,
  Question,
  AgentPost,
  AgentSettings,
  Finding,
  BlockNode,
  SpanNode,
  InterruptAnswers,
  PendingInterrupt,
  PostVersion,
  KnowledgeSwitch,
} from "@/types/LinkedInAgent";

// ─── constants ────────────────────────────────────────────────────────────────

// Display names for ai_models provider keys — unknown keys are capitalized
const MODEL_PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  gemini: "Gemini",
  openai: "OpenAI",
};

function providerLabel(provider: string) {
  return MODEL_PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

// const PROMPT_SUGGESTIONS = [
//   { text: "Give me 5 drafts for LinkedIn", tag: null },
//   { text: "Write a launch announcement", tag: null },
//   { text: "Draft a hiring post", tag: null },
//   {
//     text: `5 thought-leadership posts for SaaS, confident & punchy tone, 3 hashtags, spread over 2 weeks`,
//     tag: "All details included · skips questions",
//   },
// ];

const CYCLING_PLACEHOLDERS = [
  "e.g. Give me 5 LinkedIn drafts about our brand…",
  "e.g. Write a thought-leadership post about AI trends…",
  "e.g. Draft a hiring post for a senior engineer…",
  "e.g. 3 posts about our Q3 launch, bold & punchy tone…",
  "e.g. Write a personal story post about team culture…",
  "e.g. Generate posts about our product launch this week…",
];

const POLL_INTERVAL_MS = 2000;

// ─── helpers ──────────────────────────────────────────────────────────────────

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getSuggestedPublishError(error: unknown): string | null {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  const arr = data?.suggested_publish_at;
  if (Array.isArray(arr) && arr.length > 0) return arr[0] as string;
  return null;
}

function formatSuggestedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}

// Render body_blocks for DraftCard preview.
// Handles new Tiptap doc format ({type:"doc",content:[...]}) and legacy array format.
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
      // String-encoded Tiptap doc
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

type TiptapInline = { type: string; text?: string; marks?: { type: string }[] };
type TiptapNode = { type: string; attrs?: Record<string, unknown>; content?: unknown[] };

function renderTiptapNodes(nodes: unknown[]): React.ReactNode {
  return (
    <>
      {(nodes as TiptapNode[]).map((node, i) => {
        const isFirst = i === 0;
        if (node.type === "paragraph") {
          const inlines = (node.content ?? []) as TiptapInline[];
          return (
            <p key={i} className={cn(!isFirst && "mt-3")}>
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
          const tight = (node.attrs?.tight as boolean) ?? false;
          const items = (node.content ?? []) as TiptapNode[];
          return (
            <ul key={i} className={cn("space-y-1", !isFirst && !tight && "mt-3")}>
              {items.map((item, j) => {
                const para = ((item.content ?? []) as TiptapNode[])[0];
                const inlines = (para?.content ?? []) as TiptapInline[];
                return (
                  <li key={j} className="flex gap-1.5">
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

function getBodyPreview(blocksInput: unknown, fallback: string): string {
  // New Tiptap doc format
  if (blocksInput && typeof blocksInput === "object" && !Array.isArray(blocksInput)) {
    const doc = blocksInput as { type?: string; content?: unknown[] };
    if (doc.type === "doc" && Array.isArray(doc.content)) {
      return extractTiptapText(doc.content) || fallback;
    }
    return fallback;
  }

  // Legacy array or string
  let blocks: BlockNode[] = [];
  if (Array.isArray(blocksInput)) {
    blocks = blocksInput as BlockNode[];
  } else if (typeof blocksInput === "string") {
    try {
      const parsed = JSON.parse(blocksInput);
      if (parsed?.type === "doc" && Array.isArray(parsed.content)) {
        return extractTiptapText(parsed.content) || fallback;
      }
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

function extractTiptapText(nodes: unknown[]): string {
  return (nodes as TiptapNode[])
    .flatMap((node) => {
      if (node.type === "paragraph") {
        return ((node.content ?? []) as TiptapInline[]).map((i) => i.text ?? "");
      }
      if (node.type === "bulletList") {
        return ((node.content ?? []) as TiptapNode[]).flatMap((item) => {
          const para = ((item.content ?? []) as TiptapNode[])[0];
          return ((para?.content ?? []) as TiptapInline[]).map((i) => i.text ?? "");
        });
      }
      return [];
    })
    .join(" ");
}

// Post snapshot shape inside kind:"posts" and kind:"edit" message payloads.
// Optional fields match AgentPost field names exactly — backend adds them progressively.
type PostSnapshot = {
  post_id: string;
  headline: string;
  body: string;
  body_blocks: object | string;
  hashtags: string[];
  cta: string;
  // media (same names as AgentPost)
  image_url?: string;
  image_file?: string | null;
  image_status?: string;
  video_url?: string;
  video_file?: string | null;
  media_type?: string;
  // scheduling
  suggested_publish_at?: string | null;
};

function snapshotToAgentPost(snap: PostSnapshot): AgentPost {
  return {
    id: snap.post_id,
    state: "agent",
    plan: null,
    reference_link: null,
    tone: "",
    length: "",
    use_emoji: false,
    use_knowledge: false,
    length_hint: "",
    writer_model: "",
    headline: snap.headline,
    body: snap.body,
    body_blocks: snap.body_blocks,
    hashtags: Array.isArray(snap.hashtags) ? snap.hashtags.join(" ") : (snap.hashtags ?? ""),
    cta: snap.cta ?? null,
    image_url: snap.image_url ?? "",
    image_file: snap.image_file ?? null,
    image_status: snap.image_status ?? "",
    video_url: snap.video_url ?? "",
    video_file: snap.video_file ?? null,
    media_type: snap.media_type ?? "",
    status: "draft",
    scheduled_at: null,
    suggested_publish_at: snap.suggested_publish_at ?? null,
    published_at: null,
    linkedin_urn: "",
    conversation_id: null,
    single_post_conversation_id: null,
    created_at: "",
  };
}

function hasPendingInterrupt(conv: Conversation): boolean {
  const pi = conv.pending_interrupt as { id?: string };
  return !!pi?.id;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  small = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        small ? "h-4 w-8" : "h-6 w-11",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
          small ? "h-3 w-3" : "h-5 w-5",
          small
            ? checked
              ? "translate-x-4"
              : "translate-x-0"
            : checked
              ? "translate-x-5"
              : "translate-x-0"
        )}
      />
    </button>
  );
}

// Composer settings — collapsible group (Knowledge, Tone / Style). Collapsed by default.
function SettingsAccordion({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-2 text-left"
      >
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400">
          {summary}
          <LuChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function SourceStatus({ status }: { status: string }) {
  if (status === "failed" || status === "error")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500">
        Failed
      </span>
    );
  if (status !== "ready")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
        Processing
      </span>
    );
  return null;
}

function EmptySources({ onOpenKnowledgeBase }: { onOpenKnowledgeBase: () => void }) {
  return (
    <p className="text-xs text-gray-500">
      Nothing added yet —{" "}
      <button
        onClick={onOpenKnowledgeBase}
        className="font-medium text-blue-600 hover:text-blue-700"
      >
        Add in Knowledge base
      </button>
    </p>
  );
}

// Composer settings → one switch per knowledge source (tone/style references are never listed)
function KnowledgeSwitches({
  items,
  onToggle,
  onOpenKnowledgeBase,
}: {
  items: KnowledgeSwitch[];
  onToggle: (item: KnowledgeSwitch, enabled: boolean) => void;
  onOpenKnowledgeBase: () => void;
}) {
  const onCount = items.filter((i) => i.enabled).length;
  return (
    <SettingsAccordion
      title="Knowledge"
      summary={items.length ? `${onCount} of ${items.length} on` : "None"}
    >
      <p className="mb-2 text-xs text-gray-400">
        Only sources switched on are used. All off = no knowledge
      </p>
      {items.length === 0 ? (
        <EmptySources onOpenKnowledgeBase={onOpenKnowledgeBase} />
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <div
              key={`${item.kind}:${item.id}`}
              className="flex items-center gap-2 rounded-lg px-1 py-1.5"
            >
              <SourceIcon kind={item.kind} url={item.name} className="h-5 w-5" />
              {/* `label` is the user's note for the agent — shown under the source name */}
              <div
                className="min-w-0 flex-1"
                title={item.label ? `${item.name}\nNote: ${item.label}` : item.name}
              >
                <p className="truncate text-xs text-gray-700">{item.name}</p>
                {item.label && (
                  <p className="truncate text-[11px] text-gray-400">Note: {item.label}</p>
                )}
              </div>
              <SourceStatus status={item.status} />
              <Toggle small checked={item.enabled} onChange={(v) => onToggle(item, v)} />
            </div>
          ))}
        </div>
      )}
    </SettingsAccordion>
  );
}

interface ToneSource {
  id: string;
  kind: "pdf" | "website";
  name: string;
  status: string;
  isDefault: boolean;
}

// Composer settings → tone / style references (read-only — no per-source switch in the API)
function ToneSources({
  items,
  loading,
  onOpenKnowledgeBase,
}: {
  items: ToneSource[];
  loading: boolean;
  onOpenKnowledgeBase: () => void;
}) {
  return (
    <SettingsAccordion title="Tone / Style" summary={items.length ? `${items.length}` : "None"}>
      <p className="mb-2 text-xs text-gray-400">
        Writing samples the agent matches your voice to. Manage them in Knowledge base
      </p>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-gray-400">
          <LuLoader className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </p>
      ) : items.length === 0 ? (
        <EmptySources onOpenKnowledgeBase={onOpenKnowledgeBase} />
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <div
              key={`${item.kind}:${item.id}`}
              className="flex items-center gap-2 rounded-lg px-1 py-1.5"
            >
              <SourceIcon kind={item.kind} url={item.name} className="h-5 w-5" />
              <p className="min-w-0 flex-1 truncate text-xs text-gray-700" title={item.name}>
                {item.name}
              </p>
              {item.isDefault && (
                <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                  Default
                </span>
              )}
              <SourceStatus status={item.status} />
            </div>
          ))}
        </div>
      )}
    </SettingsAccordion>
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
              disabled={!!freeText}
              onChange={(e) => {
                setFreeText("");
                onChange(e.target.value);
              }}
              className={`w-full appearance-none rounded-lg border py-2.5 pl-3 pr-8 text-sm outline-none transition-colors ${
                freeText
                  ? "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                  : "border-gray-200 bg-white text-gray-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              }`}
            >
              {question.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <LuChevronDown
              className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${freeText ? "text-gray-300" : "text-gray-400"}`}
            />
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
  canSkip,
}: {
  questions: Question[];
  onSubmit: (answers: Record<string, string | string[]>, skipRemaining?: boolean) => void;
  submitting: boolean;
  canSkip?: boolean;
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
  // Per-question toggle — off = send "" for that question on Next (input kept for re-enabling)
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  if (questions.length === 0) return null;

  const answersForNext = Object.fromEntries(
    Object.entries(answers).map(([id, v]) => [id, skipped[id] ? "" : v])
  );

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
              {row.map((q) => {
                const isOn = !skipped[q.id];
                return (
                  <div key={q.id}>
                    <div className="mb-1.5 flex items-start justify-between gap-3">
                      <label
                        className={cn(
                          "block text-xs font-semibold transition-colors",
                          isOn ? "text-blue-600" : "text-gray-400"
                        )}
                      >
                        {q.question}
                        {!isOn && <span className="ml-1.5 font-medium">· Skipped</span>}
                      </label>
                      <span title={isOn ? "Skip this question" : "Answer this question"}>
                        <Toggle
                          small
                          checked={isOn}
                          onChange={(v) => setSkipped((prev) => ({ ...prev, [q.id]: !v }))}
                        />
                      </span>
                    </div>
                    {/* fieldset disables every control inside a skipped question */}
                    <fieldset
                      disabled={!isOn}
                      className={cn("min-w-0 transition-opacity", !isOn && "opacity-50")}
                    >
                      <QuestionField
                        question={q}
                        value={answers[q.id] ?? ""}
                        onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      />
                    </fieldset>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => onSubmit(answersForNext)}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            Next
          </button>
          {canSkip && (
            <button
              onClick={() => onSubmit(answers, true)}
              disabled={submitting}
              className="text-sm font-medium text-gray-500 underline-offset-2 transition-colors hover:text-blue-600 hover:underline disabled:opacity-50"
            >
              Skip questioning
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Headlines form — editable list: keep / reword / delete / add custom
function HeadlinesForm({
  headlines: initial,
  onSubmit,
  onSuggestMore,
  canGenerateMore,
  generatingMore,
  previousHeadlines,
  submitting,
}: {
  headlines: string[];
  onSubmit: (headlines: string[]) => void;
  onSuggestMore: (headlines: string[]) => void;
  canGenerateMore: boolean;
  // "Suggest more" run in flight — card stays visible, locked, with shimmer rows
  generatingMore: boolean;
  // List sent with the last "Suggest more" — lines not in it fade in as new
  previousHeadlines: string[];
  submitting: boolean;
}) {
  const [items, setItems] = useState(() =>
    initial.map((text, i) => ({
      id: String(i),
      text,
      isNew: previousHeadlines.length > 0 && !previousHeadlines.includes(text),
    }))
  );
  const busy = submitting || generatingMore;

  const update = (id: string, text: string) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));

  const remove = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const addCustom = () =>
    setItems((prev) => [...prev, { id: String(Date.now()), text: "", isNew: false }]);

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
            <div
              key={item.id}
              className={cn("flex items-center gap-2", item.isNew && "animate-fade-in-up")}
            >
              <input
                type="text"
                value={item.text}
                onChange={(e) => update(item.id, e.target.value)}
                disabled={generatingMore}
                placeholder="Write a first line…"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:bg-gray-50 disabled:text-gray-500"
              />
              <button
                onClick={() => remove(item.id)}
                disabled={generatingMore}
                className="shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
                title="Remove"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          ))}
          {/* Placeholders where the new headlines will land */}
          {generatingMore &&
            [0, 1, 2].map((i) => (
              <div key={`skeleton-${i}`} className="flex items-center gap-2">
                <div className="h-10 min-w-0 flex-1 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-8 w-8 shrink-0" />
              </div>
            ))}
        </div>

        <div className="mt-3 flex items-center gap-5">
          <button
            onClick={addCustom}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-60"
          >
            <LuPlus className="h-4 w-4" />
            Add concept/idea
          </button>
          {canGenerateMore && <span className="h-4 w-px bg-gray-200" />}
          {canGenerateMore && (
            <button
              onClick={() => onSuggestMore(final)}
              disabled={busy}
              className="flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-60"
            >
              {generatingMore ? (
                <LuLoader className="h-4 w-4 animate-spin" />
              ) : (
                <LuSparkles className="h-4 w-4" />
              )}
              {generatingMore ? "Suggesting…" : "Suggest more concepts/ideas"}
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {final.length} post{final.length !== 1 ? "s" : ""} will be written
          </p>
          <button
            onClick={() => onSubmit(final)}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && !generatingMore && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            Generate {final.length > 0 ? final.length : ""} draft{final.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// Single draft card
function DraftCard({
  post,
  onEdit,
  onEditTime,
  onApprove,
  isApproving,
  isSelected,
  onSelect,
  readOnly = false,
  oldVersion,
  onRestore,
  isRestoring = false,
  restoreDisabled = false,
  onShowHistory,
  onReadMore,
}: {
  post: AgentPost;
  onEdit: (post: AgentPost) => void;
  onEditTime: (post: AgentPost) => void;
  onApprove: (id: string) => void;
  isApproving: boolean;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
  // Not the latest card for this post — no approve / edit / select (they'd change the LIVE post)
  readOnly?: boolean;
  // Version shown on a read-only card — renders the "Old version · vN" badge
  oldVersion?: number;
  onRestore?: () => void;
  isRestoring?: boolean;
  restoreDisabled?: boolean;
  // Opens this post's version history list
  onShowHistory?: () => void;
  // Old cards only — opens the full post in a modal
  onReadMore?: () => void;
}) {
  const router = useRouter();
  const isVideoActive = post.media_type === "video";
  const hasImage = !!post.image_url;
  const hasVideo = !!post.video_url;
  const dateStr = formatSuggestedDate(post.suggested_publish_at);

  const isDraft = post.status === "draft";
  const canAct = !readOnly;

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    approved: { label: "Approved", cls: "bg-green-100 text-green-700" },
    scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-700" },
    published: { label: "Published", cls: "bg-emerald-100 text-emerald-700" },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
    draft: { label: "Draft", cls: "bg-violet-100 text-violet-700" },
  };
  const badge = STATUS_BADGE[post.status] ?? STATUS_BADGE.draft;

  return (
    // Outer wrapper: overflow-visible so floating buttons protrude above top border
    <div className="group relative h-72 w-96 shrink-0">
      {/* Checkbox — top-left, hover or selected; shown for any non-published card */}
      {canAct && onSelect && post.status !== "published" && (
        <button
          onClick={() => onSelect(isSelected ? null : post.id)}
          className={cn(
            "absolute left-3 top-0 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border bg-white shadow-sm transition-opacity",
            isSelected
              ? "border-blue-500 bg-blue-500 opacity-100"
              : "border-gray-300 opacity-0 group-hover:opacity-100"
          )}
          title={isSelected ? "Deselect draft" : "Select draft to prompt"}
        >
          {isSelected && <LuCheck className="h-3 w-3 text-white" />}
        </button>
      )}
      {/* Floating area — approve button for drafts */}
      <div className="absolute right-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5">
        {canAct && isDraft && (
          <button
            onClick={() => onApprove(post.id)}
            disabled={isApproving}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-500 disabled:opacity-50"
            title="Approve"
          >
            {isApproving ? (
              <LuLoader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LuCheck className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Card — overflow-hidden clips body text naturally at card boundary */}
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-4",
          isSelected
            ? "border-blue-400 ring-1 ring-blue-300"
            : isDraft || readOnly
              ? "border-gray-200"
              : "border-green-200"
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
          <div className="flex shrink-0 items-center gap-1">
            {oldVersion != null ? (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                Old version · v{oldVersion}
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  badge.cls
                )}
              >
                {badge.label}
              </span>
            )}
            {onShowHistory && (
              <button
                onClick={onShowHistory}
                className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                title="Version history"
              >
                <LuHistory className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scheduled time — live post's time, so hidden on old versions */}
        {canAct && dateStr && (
          <div className="mb-2 flex shrink-0 items-center gap-1 text-xs text-gray-400">
            <LuClock className="h-3 w-3 shrink-0" />
            <span>{dateStr}</span>
            <button
              onClick={() => onEditTime(post)}
              className="text-gray-400 transition-colors hover:text-blue-500"
              title="Edit suggested time"
            >
              <LuPencil className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Media — respects media_type field */}
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

        {/* Body — rich text when no media (fills height); plain truncated when media present */}
        <div className="min-h-0 flex-1 overflow-hidden pb-8 text-xs leading-relaxed text-gray-600">
          {post.image_status === "pending" || hasImage || hasVideo ? (
            <p className="line-clamp-3">{getBodyPreview(post.body_blocks, post.body)}</p>
          ) : (
            renderBlocks(post.body_blocks, post.body)
          )}
        </div>

        {/* Old version — read the full post, or restore it (not allowed once published) */}
        {readOnly && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {onReadMore && (
              <button
                onClick={onReadMore}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
              >
                <LuBookOpen className="h-3 w-3" />
                Read more
              </button>
            )}
            {onRestore && post.status !== "published" && (
              <button
                onClick={onRestore}
                disabled={isRestoring || restoreDisabled}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRestoring ? (
                  <LuLoader className="h-3 w-3 animate-spin" />
                ) : (
                  <LuUndo2 className="h-3 w-3" />
                )}
                Use this version
              </button>
            )}
          </div>
        )}

        {/* Hover action buttons — bottom center, hidden for published posts */}
        {canAct && post.status !== "published" && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onEdit(post)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <LuAlignLeft className="h-3 w-3" />
              Edit text
            </button>
            <button
              onClick={() => router.push(`/linkedin/edit-image/${post.id}?from=agent`)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <LuImage className="h-3 w-3" />
              Edit image
            </button>
            {!post.suggested_publish_at && (
              <button
                onClick={() => onEdit(post)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
              >
                <LuClock className="h-3 w-3" />
                Edit time
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DraftCardSkeleton() {
  return (
    <div className="flex h-72 w-96 shrink-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-3 animate-pulse rounded bg-gray-100" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

// Content comes from the version; status / schedule time always from the live post (base)
function applyVersion(base: AgentPost | undefined, v: PostVersion): AgentPost {
  const content = snapshotToAgentPost({
    post_id: v.post,
    headline: v.headline,
    body: v.body,
    body_blocks: v.body_blocks,
    hashtags: v.hashtags,
    cta: v.cta,
    image_url: v.image_url,
    image_status: v.image_status,
    video_url: v.video_url,
    media_type: v.media_type,
  });
  if (!base) return content;
  return {
    ...base,
    headline: content.headline,
    body: content.body,
    body_blocks: content.body_blocks,
    hashtags: content.hashtags,
    cta: content.cta,
    image_url: content.image_url,
    image_status: content.image_status,
    video_url: content.video_url,
    media_type: content.media_type,
  };
}

// Renders one post on a chat card at the version that card recorded (payload.versions).
// Cards without a version (pre-versioning chats) render the live post, as before.
function VersionedDraftCard({
  workspaceId,
  postId,
  version,
  basePost,
  isLatest,
  onRestore,
  onShowHistory,
  onReadMore,
  ...cardProps
}: {
  workspaceId: string;
  postId: string;
  version: number | undefined;
  // Live post (or its snapshot fallback before posts load) — source of status + time
  basePost: AgentPost | undefined;
  isLatest: boolean;
  onRestore: (postId: string, version: number) => void;
  onShowHistory: (postId: string) => void;
  onReadMore: (post: AgentPost, version: number | undefined) => void;
  onEdit: (post: AgentPost) => void;
  onEditTime: (post: AgentPost) => void;
  onApprove: (id: string) => void;
  isApproving: boolean;
  isRestoring: boolean;
  restoreDisabled: boolean;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const { data: ver, error } = useQueryWithTokenRefresh<PostVersion>(
    ["post-version", workspaceId, postId, version],
    () => linkedinAgentService(workspaceId).getPostVersion(postId, version!),
    {
      enabled: !!workspaceId && version != null,
      // A version never changes, except its picture filling in while image_status is "pending"
      staleTime: Infinity,
      retry: (count, err) => !isNotFound(err) && count < 2,
      refetchInterval: (q) => (q.state.data?.image_status === "pending" ? 3000 : false),
    }
  );

  if (version != null && isNotFound(error)) {
    return (
      <div className="flex h-72 w-96 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-400">
        This post was deleted.
      </div>
    );
  }

  let post: AgentPost | undefined;
  if (version == null) post = basePost;
  else if (ver) post = applyVersion(basePost, ver);
  else if (error) post = basePost; // version fetch failed for another reason — show live content
  if (!post) return <DraftCardSkeleton />;

  return (
    <DraftCard
      post={post}
      {...cardProps}
      readOnly={!isLatest}
      oldVersion={!isLatest ? version : undefined}
      onRestore={!isLatest && version != null ? () => onRestore(postId, version) : undefined}
      onShowHistory={() => onShowHistory(postId)}
      onReadMore={!isLatest ? () => onReadMore(post, version) : undefined}
    />
  );
}

function isNotFound(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

// For each post: the message id of its LATEST card = the last agent card whose
// payload.versions[postId] === post.current_version. Falls back to the last agent card showing
// the post (pre-versioning chats, or before the live post has loaded).
function getLatestCardByPost(
  messages: Conversation["messages"],
  posts: AgentPost[]
): Record<string, string> {
  const lastMatching: Record<string, string> = {};
  const lastAny: Record<string, string> = {};
  for (const msg of messages) {
    if (msg.role !== "agent" || (msg.kind !== "posts" && msg.kind !== "edit")) continue;
    const ids = (msg.payload.post_ids as string[] | undefined) ?? [];
    const versions = msg.payload.versions as Record<string, number> | undefined;
    for (const id of ids) {
      lastAny[id] = msg.id;
      const current = posts.find((p) => p.id === id)?.current_version;
      if (versions?.[id] != null && versions[id] === current) lastMatching[id] = msg.id;
    }
  }
  return { ...lastAny, ...lastMatching };
}

// Draft cards section
function DraftsSection({
  posts,
  renderCard,
  onViewAll,
  onGenerateMore,
  generatingMore = false,
  generateMoreDisabled = false,
  skeletonCount = 0,
  previousPostIds = [],
}: {
  posts: AgentPost[];
  // Renders one post at this message's version (see VersionedDraftCard)
  renderCard: (post: AgentPost) => React.ReactNode;
  onViewAll: (posts: AgentPost[]) => void;
  onGenerateMore?: () => void;
  // "Generate more drafts" run in flight for this message — cards locked, skeletons appended
  generatingMore?: boolean;
  generateMoreDisabled?: boolean;
  skeletonCount?: number;
  // Post ids before the last "Generate more" — cards not in it fade in as new
  previousPostIds?: string[];
}) {
  const draftPosts = posts.filter((p) => p.status === "draft");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bring the skeletons into view — they land at the end of the horizontal carousel
  useEffect(() => {
    if (!generatingMore || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [generatingMore]);

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

      {/* Horizontal scroll — pt-4 gives room for the floating ✓ button */}
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pt-4 pb-2">
        {posts.map((post) => (
          <div
            key={post.id}
            className={cn(
              "shrink-0",
              generatingMore && "pointer-events-none",
              previousPostIds.length > 0 &&
                !previousPostIds.includes(post.id) &&
                "animate-fade-in-up"
            )}
          >
            {renderCard(post)}
          </div>
        ))}
        {/* Placeholders where the new drafts will land */}
        {generatingMore &&
          Array.from({ length: skeletonCount }, (_, i) => (
            <DraftCardSkeleton key={`skeleton-${i}`} />
          ))}
      </div>

      {/* Generate more */}
      {onGenerateMore && (
        <button
          onClick={onGenerateMore}
          disabled={generatingMore || generateMoreDisabled}
          className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-60"
        >
          {generatingMore ? (
            <LuLoader className="h-4 w-4 animate-spin" />
          ) : (
            <LuSparkles className="h-4 w-4" />
          )}
          {generatingMore ? "Generating…" : "Generate more drafts"}
        </button>
      )}
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
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <Image src="/cg-fav.svg" alt="Agent" width={16} height={16} className="shrink-0" />
        <span className="absolute inset-0 rounded-xl animate-ping bg-blue-300 opacity-30" />
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
  // "Suggest more headlines" run in flight — snapshot keeps the headlines card on screen
  const [suggestMore, setSuggestMore] = useState<{
    convId: string;
    interruptId: string;
    headlines: string[];
    canGenerateMore: boolean;
  } | null>(null);
  // List sent with the last "Suggest more" — the next round fades in lines not in it
  const [previousHeadlines, setPreviousHeadlines] = useState<string[]>([]);
  // "Generate more drafts" run in flight — kept until the new posts are fetched (no blink)
  const [moreDrafts, setMoreDrafts] = useState<{ convId: string; messageId: string } | null>(null);
  // Post ids a message had before the last "Generate more" — new cards fade in
  const [moreDraftsBaseline, setMoreDraftsBaseline] = useState<{
    messageId: string;
    postIds: string[];
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [history, setHistory] = useState<PaginatedConversations | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editPost, setEditPost] = useState<AgentPost | null>(null);
  const [timeEditPost, setTimeEditPost] = useState<AgentPost | null>(null);
  const [timeEditDraft, setTimeEditDraft] = useState("");
  const [savingTimeEdit, setSavingTimeEdit] = useState(false);
  const [timeEditError, setTimeEditError] = useState<string | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllPosts, setViewAllPosts] = useState<AgentPost[]>([]);
  const [restoringConv, setRestoringConv] = useState(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  // `${postId}:${version}` of the "Use this version" request in flight
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  // Post whose version history modal is open
  const [versionsPostId, setVersionsPostId] = useState<string | null>(null);
  // Old-version card opened in the "Read more" modal
  const [readMore, setReadMore] = useState<{ post: AgentPost; version?: number } | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [deleteConvConfirm, setDeleteConvConfirm] = useState<{
    id: string;
    checking: boolean;
    scheduledCount: number;
    publishedCount: number;
  } | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  // Settings — served from the ["agent-settings", workspaceId] query (see below)
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelTab, setModelTab] = useState<string | null>(null);

  // refs
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imagePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postsRef = useRef<AgentPost[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottomRef = useRef(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Guards against React Strict Mode double-invoking the restore effect
  const restoredForWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [message]);

  const svc = useCallback(() => linkedinAgentService(workspaceId), [workspaceId]);
  const queryClient = useQueryClient();

  const {
    settings,
    settingsLoaded,
    saving: settingsSaving,
    saveSettings,
    setKnowledgeEnabled,
  } = useAgentSettings(workspaceId);

  // Tone / Style references for the composer settings accordion — shares the
  // Knowledge base modal's query keys so both stay in sync
  const { data: toneDocsData, isLoading: toneDocsLoading } = useQueryWithTokenRefresh(
    ["agent-documents", workspaceId],
    () => agentService(workspaceId).getAgentDocuments(),
    { enabled: !!workspaceId && settingsOpen }
  );
  const { data: toneSitesData, isLoading: toneSitesLoading } = useQueryWithTokenRefresh(
    ["agent-websites", workspaceId],
    () => agentService(workspaceId).getAgentWebsites(),
    { enabled: !!workspaceId && settingsOpen }
  );
  const isToneSource = (purpose: string) => purpose === "tone" || purpose === "style";
  const toneSources = [
    ...((toneSitesData as { results?: ProfileWebsite[] } | undefined)?.results ?? [])
      .filter((w) => isToneSource(w.purpose))
      .map((w) => ({
        id: w.id,
        kind: "website" as const,
        name: w.url,
        status: w.status,
        isDefault: w.is_default,
      })),
    ...((toneDocsData as { results?: ProfileDocument[] } | undefined)?.results ?? [])
      .filter((d) => isToneSource(d.purpose))
      .map((d) => ({
        id: d.id,
        kind: "pdf" as const,
        name: d.filename,
        status: d.status,
        isDefault: d.is_default,
      })),
  ];

  // ── approve draft posts ──
  const handleApprovePost = useCallback(
    async (id: string) => {
      setApprovingIds((prev) => new Set(prev).add(id));
      try {
        await postsService(workspaceId).approvePost(id);
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: "scheduled" } : p)));
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success("Post approved!");
      } catch (err) {
        const fieldErr = getSuggestedPublishError(err);
        if (fieldErr) {
          toast.error(fieldErr);
          const failedPost = postsRef.current.find((p) => p.id === id);
          if (failedPost) {
            setTimeEditPost(failedPost);
            setTimeEditDraft(
              failedPost.suggested_publish_at ? isoToLocal(failedPost.suggested_publish_at) : ""
            );
            setTimeEditError(null);
          }
        } else {
          toast.error(extractErrorMessage(err) || "Failed to approve post.");
        }
      } finally {
        setApprovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [workspaceId, queryClient]
  );

  // ── time edit modal ──
  const openTimeEdit = (post: AgentPost) => {
    setTimeEditPost(post);
    setTimeEditDraft(post.suggested_publish_at ? isoToLocal(post.suggested_publish_at) : "");
    setTimeEditError(null);
  };

  const saveTimeEdit = async () => {
    if (!timeEditPost || !timeEditDraft) return;
    const newIso = new Date(timeEditDraft).toISOString();
    setSavingTimeEdit(true);
    try {
      await postsService(workspaceId).patchPostRaw(timeEditPost.id, {
        suggested_publish_at: newIso,
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === timeEditPost.id ? { ...p, suggested_publish_at: newIso } : p))
      );
      toast.success("Suggested time updated.");
      setTimeEditPost(null);
      setTimeEditError(null);
    } catch (err) {
      const fieldErr = getSuggestedPublishError(err);
      if (fieldErr) {
        setTimeEditError(fieldErr);
      } else {
        toast.error(extractErrorMessage(err));
      }
    } finally {
      setSavingTimeEdit(false);
    }
  };

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
        const data = await svc().getAgentPosts({ ids: postIds });
        setPosts(data.results);
      } catch {
        // ignore
      }
    },
    [svc]
  );

  // ── "Use this version" on an old card — restores as a NEW version + appends its chat card ──
  const handleRestoreVersion = useCallback(
    async (postId: string, version: number): Promise<boolean> => {
      if (!conversation) return false;
      const convId = conversation.id;
      setRestoringKey(`${postId}:${version}`);
      try {
        const res = await svc().restoreVersion(convId, postId, version);
        queryClient.setQueryData(
          ["post-version", workspaceId, postId, res.version.number],
          res.version
        );
        // message is null when that version was already current — nothing to append
        if (res.message) {
          const msg = res.message;
          setConversation((prev) =>
            prev && prev.id === convId ? { ...prev, messages: [...prev.messages, msg] } : prev
          );
        }
        // current_version moved on (and an approved/scheduled post is back to draft)
        await fetchPosts(conversation.artifacts.post_ids);
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-versions", workspaceId, postId] });
        return true;
      } catch (err) {
        // 400 { post: ["…"] } is a field error; everything else carries "detail"
        const data = axios.isAxiosError(err)
          ? (err.response?.data as { post?: string[] } | undefined)
          : undefined;
        toast.error(data?.post?.[0] ?? (extractErrorMessage(err) || "Failed to restore version."));
        return false;
      } finally {
        setRestoringKey(null);
      }
    },
    [conversation, svc, queryClient, workspaceId, fetchPosts]
  );

  // ── image generation polling ──
  useEffect(() => {
    // Keep ref in sync so the interval callback always sees fresh post IDs
    postsRef.current = posts;

    const hasPending = posts.some((p) => p.image_status === "pending");

    if (!hasPending) {
      if (imagePollRef.current) {
        clearInterval(imagePollRef.current);
        imagePollRef.current = null;
      }
      return;
    }

    if (imagePollRef.current) return; // already polling

    imagePollRef.current = setInterval(() => {
      const ids = postsRef.current.map((p) => p.id);
      if (ids.length) fetchPosts(ids);
    }, 3000);

    return () => {
      if (imagePollRef.current) {
        clearInterval(imagePollRef.current);
        imagePollRef.current = null;
      }
    };
  }, [posts, fetchPosts]);

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
      refreshHistory();
      if (conv.status === "completed" && conv.artifacts.post_ids.length > 0) {
        // Skeletons stay until the new cards are in state, then swap in place
        fetchPosts(conv.artifacts.post_ids).finally(() => setMoreDrafts(null));
      } else {
        setMoreDrafts(null);
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

  // ── cycle placeholder text ──
  useEffect(() => {
    const status = conversation?.status;
    if (status === "running" || status === "awaiting_input") return;
    const iv = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % CYCLING_PLACEHOLDERS.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(iv);
  }, [conversation?.status]);

  // ── restore conversation on mount ──
  // Priority: ?conv= URL param → last conversation from history → empty state
  useEffect(() => {
    if (!workspaceId) return;
    // Prevent React Strict Mode's double-invocation from creating two conversations
    if (restoredForWorkspaceRef.current === workspaceId) return;
    restoredForWorkspaceRef.current = workspaceId;

    async function restore() {
      try {
        const params = new URLSearchParams(window.location.search);
        const convId = params.get("conv");
        const editPostId = params.get("editPostId");

        if (editPostId) {
          try {
            // Check if the post already has a single-post conversation
            const post = await svc().getAgentPost(editPostId);
            let conv: Conversation;
            if (post.single_post_conversation_id) {
              // Resume the existing single-post conversation
              conv = await svc().getConversation(post.single_post_conversation_id);
            } else {
              // No single-post conversation yet — create one
              const created = await svc().createConversation(editPostId);
              conv =
                created.messages.length > 0 ? created : await svc().getConversation(created.id);
            }
            setConversation(conv);
            refreshHistory();
            if (conv.status === "running") startPolling(conv.id);
            // Always fetch the edited post so its live status is in state
            // (approve updates posts state; cards read from it, not the frozen snapshot)
            fetchPosts(conv.artifacts.post_ids.length > 0 ? conv.artifacts.post_ids : [editPostId]);
          } catch {
            /* ignore */
          }
          return;
        }

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
    params.delete("editPostId"); // clear once conversation is created
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    // Reset scroll flag so the new conversation snaps to bottom on load
    hasScrolledToBottomRef.current = false;
  }, [conversation?.id]);

  // ── scroll to bottom on new messages/posts/questions; snap instantly on initial load ──
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // Double RAF: first frame commits DOM, second frame has final scrollHeight
    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!hasScrolledToBottomRef.current) {
          container.scrollTop = container.scrollHeight;
          hasScrolledToBottomRef.current = true;
        } else {
          container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // pending_interrupt?.id covers new grilling question sets arriving (not message-based)
  }, [
    conversation?.messages?.length,
    posts.length,
    (conversation?.pending_interrupt as { id?: string } | null)?.id,
  ]);

  // ── click-outside handlers ──
  useEffect(() => {
    if (!modelMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node))
        setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [modelMenuOpen]);

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
    // Capture snapshot before clearing selection
    const selectedPost = selectedDraftId ? posts.find((p) => p.id === selectedDraftId) : null;
    const optimisticPayload: Record<string, unknown> = selectedPost
      ? {
          post_id: selectedPost.id,
          snapshot: {
            post_id: selectedPost.id,
            headline: selectedPost.headline,
            body: selectedPost.body,
            body_blocks: selectedPost.body_blocks,
            hashtags: [],
            cta: selectedPost.cta ?? "",
            image_url: selectedPost.image_url,
            image_file: selectedPost.image_file,
            image_status: selectedPost.image_status,
            video_url: selectedPost.video_url,
            video_file: selectedPost.video_file,
            media_type: selectedPost.media_type,
            suggested_publish_at: selectedPost.suggested_publish_at,
          } satisfies PostSnapshot,
        }
      : {};
    try {
      let convId = conversation?.id;

      if (!convId || conversation?.status === "archived") {
        const newConv = await svc().createConversation();
        convId = newConv.id;
        setConversation(newConv);
        setPosts([]);
        refreshHistory();
      }

      await svc().sendMessage(convId!, text, selectedDraftId ?? undefined);
      setSelectedDraftId(null);
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
                  payload: optimisticPayload,
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
  // Returns true when the answer was accepted and the run started
  const handleAnswer = async (
    answers: InterruptAnswers,
    skipRemaining?: boolean
  ): Promise<boolean> => {
    if (!conversation || !workspaceId) return false;
    const pi = conversation.pending_interrupt as { id?: string };
    if (!pi?.id) return false;
    setAnswering(true);
    try {
      await svc().answerQuestion(conversation.id, pi.id, answers, skipRemaining);
      setConversation((prev) => (prev ? { ...prev, status: "running" } : prev));
      startPolling(conversation.id);
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return false;
    } finally {
      setAnswering(false);
    }
  };

  // Keep the headlines card on screen (locked + shimmer) while more headlines generate
  const handleSuggestMore = async (headlines: string[], pi: PendingInterrupt) => {
    if (!conversation) return;
    setPreviousHeadlines(headlines);
    setSuggestMore({
      convId: conversation.id,
      interruptId: pi.id,
      headlines,
      canGenerateMore: pi.can_generate_more === true,
    });
    const ok = await handleAnswer({ more_headlines: true, headlines });
    if (!ok) setSuggestMore(null);
  };

  // ── generate more drafts for one posts message — new posts append to that same message ──
  const handleGenerateMoreDrafts = async (messageId: string, currentPostIds: string[]) => {
    if (!conversation) return;
    const convId = conversation.id;
    setMoreDraftsBaseline({ messageId, postIds: currentPostIds });
    setMoreDrafts({ convId, messageId });
    setSelectedDraftId(null);
    try {
      await svc().generateMoreDrafts(convId, messageId);
      setConversation((prev) => (prev ? { ...prev, status: "running" } : prev));
      startPolling(convId);
    } catch (err) {
      setMoreDrafts(null);
      toast.error(extractErrorMessage(err));
    }
  };

  // ── ensure conversation exists (shared by attach handlers) ──
  const ensureConversation = async (): Promise<string | null> => {
    if (!workspaceId) return null;
    if (conversation?.id && conversation.status !== "archived") return conversation.id;
    const newConv = await svc().createConversation();
    setConversation(newConv);
    setPosts([]);
    refreshHistory();
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
    setSelectedDraftId(null);
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

  // ── delete conversation — open confirmation modal ──
  const handleDeleteConversationClick = async (id: string) => {
    setDeleteConvConfirm({ id, checking: true, scheduledCount: 0, publishedCount: 0 });
    try {
      const conv = await svc().getConversation(id);
      const postIds = conv.artifacts?.post_ids ?? [];
      if (postIds.length > 0) {
        const results = await Promise.all(
          postIds.map((pid) => postsService(workspaceId!).getPost(pid))
        );
        const posts = results.filter((p): p is NonNullable<typeof p> => !!p);
        const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
        const publishedCount = posts.filter((p) => p.status === "published").length;
        setDeleteConvConfirm({ id, checking: false, scheduledCount, publishedCount });
      } else {
        setDeleteConvConfirm({ id, checking: false, scheduledCount: 0, publishedCount: 0 });
      }
    } catch {
      setDeleteConvConfirm({ id, checking: false, scheduledCount: 0, publishedCount: 0 });
    }
  };

  // ── delete conversation — confirmed ──
  const handleDeleteConversation = async (id: string) => {
    setDeletingConv(true);
    try {
      await svc().deleteConversation(id);
      setHistory((prev) =>
        prev ? { ...prev, results: prev.results.filter((c) => c.id !== id) } : prev
      );
      if (conversation?.id === id) handleNewChat();
      setDeleteConvConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
    } catch {
      toast.error("Failed to delete conversation");
    } finally {
      setDeletingConv(false);
    }
  };

  // ── save settings ──
  const handleSettingChange = (key: keyof AgentSettings, value: boolean | number) =>
    saveSettings({ [key]: value });

  // ── writer model ──
  const modelGroups = Object.entries(settings.ai_models ?? {}).filter(
    ([, models]) => models.length > 0
  );
  const allModels = modelGroups.flatMap(([, models]) => models);
  const activeModel =
    allModels.find((m) => m.model_id === settings.writer_model) ??
    allModels.find((m) => m.selected);
  const activeModelProvider = modelGroups.find(([, models]) =>
    models.some((m) => m.model_id === activeModel?.model_id)
  )?.[0];
  // null = follow the selected model's provider (or the first tab)
  const currentModelTab = modelTab ?? activeModelProvider ?? modelGroups[0]?.[0];

  const handleModelChange = (modelId: string) => {
    setModelMenuOpen(false);
    if (modelId === activeModel?.model_id) return;
    const aiModels = Object.fromEntries(
      modelGroups.map(([provider, models]) => [
        provider,
        models.map((m) => ({ ...m, selected: m.model_id === modelId })),
      ])
    );
    saveSettings({ writer_model: modelId }, { ai_models: aiModels });
  };

  // ── derived state ──
  const isRunning = conversation?.status === "running";
  const isAwaiting = conversation?.status === "awaiting_input";
  const isCompleted = conversation?.status === "completed";
  const isFailed = conversation?.status === "failed";

  // "Post 2" = artifacts.post_ids[1] — the numbering the user sees in agent messages
  const postLabel = (id: string | null | undefined) => {
    const idx = id ? (conversation?.artifacts.post_ids.indexOf(id) ?? -1) : -1;
    return idx >= 0 ? `Post ${idx + 1}` : "Post";
  };

  // Post versioning — only the latest card per post gets approve / edit / select
  const latestCardByPost = getLatestCardByPost(conversation?.messages ?? [], posts);
  const renderPostCard = (
    msgId: string,
    postId: string,
    versions: Record<string, number> | undefined,
    basePost: AgentPost | undefined
  ) => {
    const version = versions?.[postId];
    const isLatest = latestCardByPost[postId] === msgId;
    return (
      <VersionedDraftCard
        key={postId}
        workspaceId={workspaceId}
        postId={postId}
        version={version}
        basePost={basePost}
        isLatest={isLatest}
        onRestore={handleRestoreVersion}
        onShowHistory={setVersionsPostId}
        onReadMore={(post, v) => setReadMore({ post, version: v })}
        isRestoring={restoringKey === `${postId}:${version}`}
        restoreDisabled={isRunning || restoringKey !== null}
        onEdit={setEditPost}
        onEditTime={openTimeEdit}
        onApprove={handleApprovePost}
        isApproving={approvingIds.has(postId)}
        isSelected={isLatest && selectedDraftId === postId}
        onSelect={conversation?.has_multiple_post ? setSelectedDraftId : undefined}
      />
    );
  };
  const isTerminal = conversation?.status === "cancelled" || conversation?.status === "archived";
  const hasPendingAttachments =
    conversation?.attachments?.some((a) => a.status === "pending") ?? false;
  const isDraft = conversation?.status === "draft";

  // Drop the "generate more drafts" flag when switching conversations mid-run
  const conversationId = conversation?.id;
  const [prevConversationId, setPrevConversationId] = useState(conversationId);
  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId);
    if (moreDrafts && moreDrafts.convId !== conversationId) setMoreDrafts(null);
    setMoreDraftsBaseline(null);
  }
  const isGeneratingMoreDrafts = !!moreDrafts && moreDrafts.convId === conversationId;
  // Generate more is allowed only from an idle conversation (same gate as sending)
  const canGenerateMoreDrafts =
    !isGeneratingMoreDrafts &&
    !sending &&
    !hasPendingAttachments &&
    (isCompleted || isFailed || conversation?.status === "cancelled");

  const canSend =
    !sending &&
    !isGeneratingMoreDrafts &&
    !isRunning &&
    !isAwaiting &&
    !hasPendingAttachments &&
    (!conversation || isDraft || isCompleted || isFailed || isTerminal);
  const showCancel = isRunning || isAwaiting;

  const pendingInterrupt =
    conversation && hasPendingInterrupt(conversation)
      ? (conversation.pending_interrupt as PendingInterrupt)
      : null;

  const isHeadlineInterrupt = pendingInterrupt?.kind === "headlines";

  // Drop the "suggest more" snapshot once the run ends (new headlines, failure, cancel…).
  // Adjusted during render rather than in an effect — see react.dev "storing information from previous renders"
  const conversationStatus = conversation?.status;
  const [prevConversationStatus, setPrevConversationStatus] = useState(conversationStatus);
  if (conversationStatus !== prevConversationStatus) {
    setPrevConversationStatus(conversationStatus);
    if (conversationStatus !== "running" && suggestMore) setSuggestMore(null);
  }
  const isSuggestingMore =
    !!suggestMore && suggestMore.convId === conversation?.id && (isRunning || answering);

  // Headlines card: the live interrupt, or the snapshot while "suggest more" is running
  const headlinesCard = isSuggestingMore
    ? {
        id: suggestMore.interruptId,
        headlines: suggestMore.headlines,
        canGenerateMore: suggestMore.canGenerateMore,
      }
    : isAwaiting && isHeadlineInterrupt && pendingInterrupt
      ? {
          id: pendingInterrupt.id,
          headlines: pendingInterrupt.headlines ?? [],
          canGenerateMore: pendingInterrupt.can_generate_more === true,
        }
      : null;

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
            Generate post drafts, approve them, and let Creative genie schedule &amp; publish.
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

          {/* Headlines before drafting toggle */}
          {!settingsLoaded ? (
            <div className="h-7 w-44 animate-pulse rounded-lg bg-gray-200" />
          ) : (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 text-xs",
                !settings.ignore_headline
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "bg-white text-gray-400"
              )}
            >
              <span>Concept/Idea before drafting</span>
              <Toggle
                small
                checked={!settings.ignore_headline}
                onChange={(v) => handleSettingChange("ignore_headline", !v)}
              />
            </div>
          )}

          {/* Questions before drafting toggle */}
          {!settingsLoaded ? (
            <div className="h-7 w-44 animate-pulse rounded-lg bg-gray-200" />
          ) : (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 text-xs",
                settings.ask_questions
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "bg-white text-gray-400"
              )}
            >
              <span>Ask questions before drafts</span>
              <Toggle
                small
                checked={settings.ask_questions}
                onChange={(v) => handleSettingChange("ask_questions", v)}
              />
            </div>
          )}

          {/* Default media — AI Image / Stock Image checkbox */}
          {!settingsLoaded ? (
            <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200" />
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">
              <span className="text-gray-500">Default media</span>
              {(
                [
                  { label: "AI Image", value: true },
                  { label: "Stock Image", value: false },
                ] as const
              ).map((opt) => {
                const checked = opt.value === settings.use_ai_image;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSettingChange("use_ai_image", opt.value)}
                    className="flex cursor-pointer items-center gap-1 select-none"
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors",
                        checked ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"
                      )}
                    >
                      {checked && (
                        <svg
                          viewBox="0 0 10 10"
                          className="h-2 w-2 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <polyline points="1.5,5 4,7.5 8.5,2.5" />
                        </svg>
                      )}
                    </span>
                    <span className={checked ? "font-medium text-blue-700" : "text-gray-400"}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Agent composer card */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white">
                <Image src="/cg-fav.svg" alt="Agent" width={16} height={16} className="shrink-0" />
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

          {/* Body row — chat + history panel */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Chat column */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Messages area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-6">
                {/* Loading state while restoring conversation */}
                {restoringConv && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                      <Image
                        src="/cg-fav.svg"
                        alt="Agent"
                        width={16}
                        height={16}
                        className="shrink-0"
                      />
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                      <Image
                        src="/cg-fav.svg"
                        alt="Agent"
                        width={16}
                        height={16}
                        className="shrink-0"
                      />
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
                    // Answer message — empty text, render Q&A pairs from payload.questions
                    if (!msg.text && msg.kind === "text") {
                      const questions = msg.payload.questions as
                        { id: string; question: string; answer: string | string[] }[] | undefined;
                      if (!questions?.length) return null;
                      const filled = questions.filter((q) =>
                        Array.isArray(q.answer) ? q.answer.length > 0 : !!q.answer
                      );
                      if (!filled.length) return null;
                      return (
                        <div key={msg.id} className="mt-4 flex justify-end">
                          <div className="max-w-md rounded-2xl rounded-tr-sm bg-blue-50 px-4 py-3 text-sm">
                            <div className="space-y-2.5">
                              {filled.map((q) => (
                                <div key={q.id}>
                                  <p className="text-xs font-medium text-blue-400">{q.question}</p>
                                  <p className="mt-0.5 text-sm text-blue-800">
                                    {Array.isArray(q.answer) ? q.answer.join(", ") : q.answer}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const snap = msg.payload.snapshot as PostSnapshot | undefined;
                    const hasSnapImage = !!snap?.image_url && snap.image_status !== "pending";
                    return (
                      <div key={msg.id} className="mt-4 flex flex-col items-end gap-1.5">
                        {snap && (
                          <div className="flex w-72 items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                            <div className="w-1 shrink-0 bg-blue-500" />
                            <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
                              {hasSnapImage && (
                                <img
                                  src={snap.image_url}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                                  Editing post
                                </p>
                                {snap.headline && (
                                  <p className="truncate text-xs font-semibold text-gray-800">
                                    {snap.headline}
                                  </p>
                                )}
                                {snap.body && (
                                  <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-gray-400">
                                    {snap.body}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="max-w-md break-words rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm leading-relaxed text-white">
                          {msg.text}
                        </div>
                      </div>
                    );
                  }

                  // Agent messages — edit turn
                  if (msg.kind === "edit") {
                    const field = msg.payload.field as "text" | "image" | undefined;
                    const editVersions = msg.payload.versions as Record<string, number> | undefined;
                    // Legacy cards carried an `after` snapshot; versioned cards only carry ids
                    const afterRaw = msg.payload.after as PostSnapshot | PostSnapshot[] | undefined;
                    const afterSnapshots = afterRaw
                      ? Array.isArray(afterRaw)
                        ? afterRaw
                        : [afterRaw]
                      : [];
                    const editPostIds =
                      (msg.payload.post_ids as string[] | undefined) ??
                      afterSnapshots.map((s) => s.post_id);
                    const editCards = editPostIds.filter(
                      (id) =>
                        editVersions?.[id] != null ||
                        posts.some((p) => p.id === id) ||
                        afterSnapshots.some((s) => s.post_id === id)
                    );
                    return (
                      <div key={msg.id} className="mt-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600">
                          <LuPencil className="h-4 w-4 text-white" />
                        </div>
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                            <LuPencil className="h-3 w-3" />
                            {field === "image" ? "Image updated" : "Post edited"}
                          </div>
                          {msg.text && (
                            <div className="break-words rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                              {msg.text}
                            </div>
                          )}
                          {editCards.length > 0 && (
                            <div className="flex gap-3 pt-4">
                              {editCards.map((id) => {
                                // Live post drives status + time; legacy snapshot until it loads
                                const snap = afterSnapshots.find((s) => s.post_id === id);
                                const basePost =
                                  posts.find((p) => p.id === id) ??
                                  (snap ? snapshotToAgentPost(snap) : undefined);
                                return renderPostCard(msg.id, id, editVersions, basePost);
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Agent messages — posts message: render inline with its own drafts
                  if (msg.kind === "posts") {
                    const msgPostIds = (msg.payload.post_ids as string[] | undefined) ?? [];
                    const livePostMatches = posts.filter((p) => msgPostIds.includes(p.id));
                    // Fall back to inline snapshot data so the card shows immediately before
                    // fetchPosts resolves (e.g. on the first render of an "edit with agent" conv)
                    const snapshotFallback = (
                      (msg.payload.snapshot as PostSnapshot[] | undefined) ?? []
                    ).map(snapshotToAgentPost);
                    const msgPosts =
                      livePostMatches.length > 0 ? livePostMatches : snapshotFallback;
                    return (
                      <div key={msg.id} className="mt-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                          <Image
                            src="/cg-fav.svg"
                            alt="Agent"
                            width={16}
                            height={16}
                            className="shrink-0"
                          />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="mb-3 inline-block break-words rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                            {msg.text}
                          </div>
                          {msgPosts.length > 0 && (
                            <DraftsSection
                              posts={msgPosts}
                              renderCard={(p) =>
                                renderPostCard(
                                  msg.id,
                                  p.id,
                                  msg.payload.versions as Record<string, number> | undefined,
                                  p
                                )
                              }
                              onViewAll={(p) => {
                                setViewAllPosts(p);
                                setViewAllOpen(true);
                              }}
                              onGenerateMore={
                                conversation?.has_multiple_post
                                  ? () =>
                                      handleGenerateMoreDrafts(
                                        msg.id,
                                        msgPosts.map((p) => p.id)
                                      )
                                  : undefined
                              }
                              generatingMore={
                                isGeneratingMoreDrafts && moreDrafts?.messageId === msg.id
                              }
                              generateMoreDisabled={!canGenerateMoreDrafts}
                              skeletonCount={settings.post_count}
                              previousPostIds={
                                moreDraftsBaseline?.messageId === msg.id
                                  ? moreDraftsBaseline.postIds
                                  : undefined
                              }
                            />
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Agent messages — web-search findings: render payload as a numbered list
                  if (msg.kind === "findings") {
                    const findings = (msg.payload.findings as Finding[] | undefined) ?? [];
                    return (
                      <div key={msg.id} className="mt-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                          <Image
                            src="/cg-fav.svg"
                            alt="Agent"
                            width={16}
                            height={16}
                            className="shrink-0"
                          />
                        </div>
                        <div className="max-w-xl rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                          <ol className="list-decimal space-y-3 pl-5">
                            {findings.map((f, i) => (
                              <li key={`${msg.id}-${i}`} className="break-words">
                                <p className="font-semibold text-gray-900">{f.title}</p>
                                {f.summary && <p className="mt-0.5">{f.summary}</p>}
                                {f.url && (
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:underline"
                                  >
                                    <LuLink className="h-3 w-3 shrink-0" />
                                    {f.url}
                                  </a>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="mt-4 flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                        <Image
                          src="/cg-fav.svg"
                          alt="Agent"
                          width={16}
                          height={16}
                          className="shrink-0"
                        />
                      </div>
                      <div
                        className={cn(
                          "max-w-xl break-words rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed",
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

                {/* Awaiting input — headline round (also stays up while "suggest more" runs) */}
                {headlinesCard && (
                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                      <Image
                        src="/cg-fav.svg"
                        alt="Agent"
                        width={16}
                        height={16}
                        className="shrink-0"
                      />
                    </div>
                    <div className="flex-1">
                      <HeadlinesForm
                        // remount with the fresh list when a new headlines round arrives
                        key={headlinesCard.id}
                        headlines={headlinesCard.headlines}
                        canGenerateMore={headlinesCard.canGenerateMore}
                        generatingMore={isSuggestingMore}
                        previousHeadlines={previousHeadlines}
                        submitting={answering}
                        onSubmit={(headlines) => void handleAnswer({ headlines })}
                        onSuggestMore={(headlines) => {
                          if (pendingInterrupt) void handleSuggestMore(headlines, pendingInterrupt);
                        }}
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                        <Image
                          src="/cg-fav.svg"
                          alt="Agent"
                          width={16}
                          height={16}
                          className="shrink-0"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="inline-block max-w-xl break-words rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                          Great — a few quick things so I draft the right posts. You can change any
                          of these.
                        </div>
                        <GrillForm
                          questions={piQuestions}
                          onSubmit={handleAnswer}
                          submitting={answering}
                          canSkip={pendingInterrupt?.can_skip}
                        />
                      </div>
                    </div>
                  )}

                {/* Running indicator — the headlines card shows its own loading state */}
                {isRunning && !isSuggestingMore && !isGeneratingMoreDrafts && (
                  <div className="mt-4">
                    <ThinkingIndicator />
                  </div>
                )}

                {/* Terminal states */}
                {isTerminal && (
                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-400">
                      <Image
                        src="/cg-fav.svg"
                        alt="Agent"
                        width={16}
                        height={16}
                        className="shrink-0"
                      />
                    </div>
                    <div className="break-words rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm text-gray-500">
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
              <div className="shrink-0 px-5 py-4">
                {/* Selected draft indicator */}
                {selectedDraftId &&
                  (() => {
                    const selectedPost = posts.find((p) => p.id === selectedDraftId);
                    const label = selectedPost?.headline || "Selected draft";
                    return (
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                          <LuAlignLeft className="h-3 w-3 shrink-0" />
                          <span className="max-w-[240px] truncate">Prompting for: {label}</span>
                          <button
                            onClick={() => setSelectedDraftId(null)}
                            className="ml-0.5 text-blue-400 hover:text-blue-600"
                            title="Clear selection"
                          >
                            <LuX className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                    );
                  })()}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-md">
                  {/* Textarea + cycling placeholder */}
                  <div className="relative px-4 pt-3 pb-1">
                    {!message &&
                      !isFocused &&
                      !isRunning &&
                      !isAwaiting &&
                      !isGeneratingMoreDrafts && (
                        <div
                          className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 transition-opacity duration-300"
                          style={{ opacity: placeholderVisible ? 1 : 0 }}
                        >
                          {CYCLING_PLACEHOLDERS[placeholderIdx]}
                        </div>
                      )}
                    <textarea
                      ref={textareaRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
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
                            : ""
                      }
                      disabled={isRunning || isAwaiting || isGeneratingMoreDrafts}
                      rows={2}
                      className="w-full resize-none break-all bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Attachment chips */}
                  {(conversation?.attachments?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
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

                  <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                    {/* Prompt suggestions — coming soon */}
                    <button
                      disabled
                      className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-400 cursor-not-allowed"
                    >
                      <LuZap className="h-3.5 w-3.5" />
                      Prompt suggestions
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                        Coming soon
                      </span>
                    </button>

                    {/* Right-side actions */}
                    <div className="flex items-center gap-2">
                      {/* Plus — file / URL attach */}
                      <div ref={plusRef} className="relative">
                        <button
                          disabled
                          title="Coming soon"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-300 cursor-not-allowed"
                        >
                          <LuPlus className="h-4 w-4" />
                        </button>
                        <span className="absolute -top-2 -right-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-400 leading-none">
                          Soon
                        </span>

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

                      {/* Writer model — same picker as the image chat */}
                      {allModels.length > 0 && (
                        <div ref={modelMenuRef} className="relative">
                          <button
                            onClick={() => {
                              // Reopen on the selected model's provider tab
                              setModelTab(null);
                              setModelMenuOpen((v) => !v);
                            }}
                            disabled={isRunning || isAwaiting || isGeneratingMoreDrafts}
                            className={cn(
                              "flex h-8 items-center gap-1.5 rounded-lg border pr-2 pl-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50",
                              modelMenuOpen ? "border-violet-300 bg-violet-50" : "border-gray-300"
                            )}
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-400">
                              <LuCpu className="h-3 w-3" />
                            </span>
                            <span className="max-w-28 truncate">
                              {activeModel?.label ?? "Model"}
                            </span>
                            <LuChevronDown
                              className={cn(
                                "h-3 w-3 text-gray-400 transition-transform",
                                modelMenuOpen && "rotate-180"
                              )}
                            />
                          </button>

                          {modelMenuOpen && (
                            <div className="absolute bottom-full right-0 z-20 mb-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                              <div className="flex items-start justify-between px-4 pt-3 pb-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">AI model</p>
                                  <p className="text-xs text-gray-400">
                                    Choose the model that writes your drafts
                                  </p>
                                </div>
                                <button
                                  onClick={() => setModelMenuOpen(false)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                                >
                                  <LuX className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {/* Provider tabs */}
                              <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3">
                                {modelGroups.map(([provider]) => {
                                  const isTab = provider === currentModelTab;
                                  return (
                                    <button
                                      key={provider}
                                      onClick={() => setModelTab(provider)}
                                      className={cn(
                                        "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors",
                                        isTab
                                          ? "border-violet-600 text-violet-700"
                                          : "border-transparent text-gray-500 hover:text-gray-700"
                                      )}
                                    >
                                      {providerLabel(provider)}
                                      {/* Dot marks the tab holding the selected model */}
                                      {provider === activeModelProvider && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto p-2">
                                {modelGroups
                                  .filter(([provider]) => provider === currentModelTab)
                                  .map(([provider, models]) => (
                                    <div key={provider} className="flex flex-col gap-1">
                                      {models.map((m) => {
                                        const isActive = m.model_id === activeModel?.model_id;
                                        return (
                                          <button
                                            key={m.model_id}
                                            onClick={() => handleModelChange(m.model_id)}
                                            className={cn(
                                              "flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                              isActive
                                                ? "border-violet-200 bg-violet-50"
                                                : "border-transparent hover:bg-gray-50"
                                            )}
                                          >
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                                              <LuCpu className="h-4 w-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-sm font-medium text-gray-900">
                                                {m.label}
                                              </p>
                                              <p className="truncate text-xs text-gray-400">
                                                {m.model_id}
                                              </p>
                                            </div>
                                            <span
                                              className={cn(
                                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                                isActive
                                                  ? "border-violet-600 bg-violet-600 text-white"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              {isActive && <LuCheck className="h-3 w-3" />}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Settings */}
                      <div ref={settingsRef} className="relative">
                        <button
                          onClick={() => setSettingsOpen((v) => !v)}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 hover:border-gray-400",
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
                                  <p className="text-sm font-medium text-gray-800">
                                    Posts per batch
                                  </p>
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
                                  <p className="text-xs text-gray-400">
                                    Sprinkle emoji into drafts
                                  </p>
                                </div>
                                <Toggle
                                  checked={settings.use_emoji}
                                  onChange={(v) => handleSettingChange("use_emoji", v)}
                                />
                              </div>
                              <div className="flex items-start justify-between gap-3 py-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-800">Use hashtags</p>
                                  <p className="text-xs text-gray-400">
                                    Add hashtags to each draft
                                  </p>
                                </div>
                                <Toggle
                                  checked={settings.use_hashtags}
                                  onChange={(v) => handleSettingChange("use_hashtags", v)}
                                />
                              </div>
                              <div className="flex items-start justify-between gap-3 py-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-800">
                                    Use target audience
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    Write for the audience set in Knowledge base
                                  </p>
                                </div>
                                <Toggle
                                  checked={settings.use_target_audience}
                                  onChange={(v) => handleSettingChange("use_target_audience", v)}
                                />
                              </div>
                              <div className="flex items-start justify-between gap-3 py-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-800">
                                    Use post length
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    Match the length set in Knowledge base
                                  </p>
                                </div>
                                <Toggle
                                  checked={settings.use_post_length}
                                  onChange={(v) => handleSettingChange("use_post_length", v)}
                                />
                              </div>
                              <KnowledgeSwitches
                                items={settings.knowledge ?? []}
                                onToggle={setKnowledgeEnabled}
                                onOpenKnowledgeBase={() => {
                                  setSettingsOpen(false);
                                  setKnowledgeOpen(true);
                                }}
                              />
                              <ToneSources
                                items={toneSources}
                                loading={toneDocsLoading || toneSitesLoading}
                                onOpenKnowledgeBase={() => {
                                  setSettingsOpen(false);
                                  setKnowledgeOpen(true);
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Send / Cancel — mutually exclusive */}
                      {showCancel ? (
                        <button
                          onClick={handleCancel}
                          disabled={cancelling}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                          {cancelling ? (
                            <LuLoader className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <span className="h-3 w-3 bg-white" />
                          )}
                        </button>
                      ) : (
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
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* /chat column */}
            </div>

            {/* History panel — right side */}
            {historyOpen && (
              <div className="flex w-60 shrink-0 flex-col border-l border-gray-100">
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
                              handleDeleteConversationClick(item.id);
                            }}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {/* /body row */}
          </div>
        </div>
      </div>

      {/* Delete conversation confirmation modal */}
      <Modal
        isOpen={!!deleteConvConfirm}
        onClose={() => !deletingConv && setDeleteConvConfirm(null)}
        title="Delete conversation"
        width="sm"
        disableBackdropClose={deletingConv}
      >
        {deleteConvConfirm?.checking ? (
          <div className="flex items-center justify-center py-6">
            <LuLoader className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>

            {(deleteConvConfirm?.scheduledCount ?? 0) > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">
                  {deleteConvConfirm!.scheduledCount} scheduled{" "}
                  {deleteConvConfirm!.scheduledCount === 1 ? "post" : "posts"}
                </span>{" "}
                associated with this conversation will also be deleted.
              </div>
            )}

            {(deleteConvConfirm?.publishedCount ?? 0) > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-semibold">
                  {deleteConvConfirm!.publishedCount} published{" "}
                  {deleteConvConfirm!.publishedCount === 1 ? "post" : "posts"}
                </span>{" "}
                associated with this conversation will be removed from the post management table.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDeleteConvConfirm(null)}
                disabled={deletingConv}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(deleteConvConfirm!.id)}
                disabled={deletingConv}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deletingConv && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      <KnowledgeBaseModal isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />

      {/* Time edit modal */}
      <Modal
        isOpen={timeEditPost !== null}
        onClose={() => {
          setTimeEditPost(null);
          setTimeEditError(null);
        }}
        title="Edit Suggested Publish Time"
        width="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Date &amp; Time (local)
            </label>
            <input
              type="datetime-local"
              value={timeEditDraft}
              onChange={(e) => {
                setTimeEditDraft(e.target.value);
                setTimeEditError(null);
              }}
              className={`h-10 w-full rounded-xl border px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 ${timeEditError ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-gray-200 focus:border-blue-500 focus:ring-blue-500"}`}
            />
            {timeEditError && <p className="mt-1.5 text-xs text-red-500">{timeEditError}</p>}
          </div>
          {timeEditDraft && !timeEditError && (
            <p className="text-xs text-gray-400">UTC: {new Date(timeEditDraft).toISOString()}</p>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            onClick={() => {
              setTimeEditPost(null);
              setTimeEditError(null);
            }}
            disabled={savingTimeEdit}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={saveTimeEdit}
            disabled={!timeEditDraft || savingTimeEdit}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingTimeEdit ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>

      <EditDraftModal
        post={editPost}
        onClose={() => setEditPost(null)}
        onSave={(activeMedia) => {
          // Optimistically update media_type so the card reflects the change immediately
          if (editPost) {
            setPosts((prev) =>
              prev.map((p) => (p.id === editPost.id ? { ...p, media_type: activeMedia } : p))
            );
          }
          if (conversation?.artifacts.post_ids.length) {
            fetchPosts(conversation.artifacts.post_ids);
          }
          // The save created a new version — backend appended its "You edited post N" card
          if (conversation) {
            const convId = conversation.id;
            svc()
              .getConversation(convId)
              .then((c) => setConversation((prev) => (prev?.id === convId ? c : prev)))
              .catch(() => {});
          }
          setEditPost(null);
        }}
      />

      {/* Read more — full content of an old-version card */}
      <Modal
        isOpen={readMore !== null}
        onClose={() => setReadMore(null)}
        title={
          readMore?.version != null
            ? `${postLabel(readMore.post.id)} · Old version v${readMore.version}`
            : postLabel(readMore?.post.id)
        }
        width="2xl"
      >
        {readMore && (
          <div>
            {readMore.post.headline && (
              <p className="mb-3 text-base font-semibold leading-snug text-gray-900">
                {readMore.post.headline}
              </p>
            )}
            {readMore.post.media_type === "video"
              ? readMore.post.video_url && (
                  <video
                    src={readMore.post.video_url}
                    controls
                    className="mb-4 max-h-80 w-full rounded-xl bg-black"
                  />
                )
              : readMore.post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={readMore.post.image_url}
                    alt=""
                    className="mb-4 max-h-80 w-full rounded-xl object-contain"
                  />
                )}
            <div className="text-sm leading-relaxed text-gray-700">
              {renderBlocks(readMore.post.body_blocks, readMore.post.body)}
            </div>
            {readMore.version != null && readMore.post.status !== "published" && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={async () => {
                    const ok = await handleRestoreVersion(readMore.post.id, readMore.version!);
                    if (ok) setReadMore(null);
                  }}
                  disabled={isRunning || restoringKey !== null}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {restoringKey === `${readMore.post.id}:${readMore.version}` ? (
                    <LuLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <LuUndo2 className="h-4 w-4" />
                  )}
                  Use this version
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <VersionHistoryModal
        key={versionsPostId ?? "no-post"}
        workspaceId={workspaceId}
        postId={versionsPostId}
        postLabel={postLabel(versionsPostId)}
        isPublished={posts.find((p) => p.id === versionsPostId)?.status === "published"}
        restoreDisabled={isRunning || restoringKey !== null}
        onRestore={handleRestoreVersion}
        onClose={() => setVersionsPostId(null)}
      />

      <AllDraftsModal
        isOpen={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        posts={viewAllPosts}
        onEdit={(post) => {
          setViewAllOpen(false);
          setEditPost(post);
        }}
        onApprove={(id) => {
          setViewAllOpen(false);
          handleApprovePost(id);
        }}
      />
    </div>
  );
}
