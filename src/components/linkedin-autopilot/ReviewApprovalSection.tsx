"use client";
import React, { useState, useEffect, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  LuPencil,
  LuCheck,
  LuLoader,
  LuX,
  LuCalendarClock,
  LuChevronDown,
  LuMessageSquare,
} from "react-icons/lu";
import toast from "react-hot-toast";
import { cn } from "@/utils/cn";
import Modal from "@/components/ui/Modal";
import { postsService } from "@/service/postsService";
import { linkedinService } from "@/service/linkedinService";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import type { ConversationListItem } from "@/types/LinkedInAgent";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { PostType } from "@/types/Post";
import EditPostModal from "./EditPostModal";
import RejectConfirmModal from "./RejectConfirmModal";
import Pagination from "@/components/ui/Pagination";

// ─── Rich-text body rendering (mirrors AutomationView) ───────────────────────

type TiptapInline = { type: string; text?: string; marks?: { type: string }[] };
type TiptapBlockNode = { type: string; attrs?: Record<string, unknown>; content?: unknown[] };

function renderTiptapNodes(nodes: unknown[]): React.ReactNode {
  return (
    <>
      {(nodes as TiptapBlockNode[]).map((node, i) => {
        const isFirst = i === 0;
        if (node.type === "paragraph") {
          const inlines = (node.content ?? []) as TiptapInline[];
          return (
            <p key={i} className={cn(!isFirst && "mt-2")}>
              {inlines.map((inline, j) => {
                const bold = inline.marks?.some((m) => m.type === "bold");
                const italic = inline.marks?.some((m) => m.type === "italic");
                const strike = inline.marks?.some((m) => m.type === "strike");
                let el: React.ReactNode = inline.text;
                if (strike) el = <s>{el}</s>;
                if (italic) el = <em>{el}</em>;
                if (bold) el = <strong>{el}</strong>;
                return <span key={j}>{el}</span>;
              })}
            </p>
          );
        }
        if (node.type === "bulletList" || node.type === "orderedList") {
          const items = (node.content ?? []) as TiptapBlockNode[];
          const Tag = node.type === "orderedList" ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={cn(
                "space-y-0.5 pl-4",
                !isFirst && "mt-2",
                node.type === "orderedList" ? "list-decimal" : "list-disc"
              )}
            >
              {items.map((item, j) => {
                const para = ((item.content ?? []) as TiptapBlockNode[])[0];
                const inlines = (para?.content ?? []) as TiptapInline[];
                return (
                  <li key={j}>
                    {inlines.map((inline, k) => {
                      const bold = inline.marks?.some((m) => m.type === "bold");
                      const italic = inline.marks?.some((m) => m.type === "italic");
                      let el: React.ReactNode = inline.text;
                      if (italic) el = <em>{el}</em>;
                      if (bold) el = <strong>{el}</strong>;
                      return <span key={k}>{el}</span>;
                    })}
                  </li>
                );
              })}
            </Tag>
          );
        }
        return null;
      })}
    </>
  );
}

function renderBodyBlocks(post: PostType): React.ReactNode {
  const p = post as PostType & { body_blocks?: unknown };
  const bb = p.body_blocks;

  if (bb && typeof bb === "object" && !Array.isArray(bb)) {
    const doc = bb as { type?: string; content?: unknown[] };
    if (doc.type === "doc" && Array.isArray(doc.content) && doc.content.length > 0) {
      return renderTiptapNodes(doc.content);
    }
  }

  if (typeof bb === "string" && bb) {
    try {
      const parsed = JSON.parse(bb);
      if (parsed?.type === "doc" && Array.isArray(parsed.content) && parsed.content.length > 0) {
        return renderTiptapNodes(parsed.content);
      }
    } catch {
      /* ignore */
    }
  }

  // Fallback: plain text
  return <span className="whitespace-pre-line">{post.body}</span>;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const PAGE_SIZE_OPTIONS = [4, 8, 12, 16, 20];

export default function ReviewApprovalSection({ mode }: { mode?: "agent" | "manual" }) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convDropdownOpen, setConvDropdownOpen] = useState(false);
  const convDropdownRef = useRef<HTMLDivElement>(null);
  const [editPost, setEditPost] = useState<PostType | null>(null);
  const [rejectPost, setRejectPost] = useState<PostType | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: textGeneratingFlag } = useQuery<number | null>({
    queryKey: ["posts-text-generating"],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  const isTextGenerating = textGeneratingFlag != null;

  const { data: baseline } = useQuery<number | null>({
    queryKey: ["posts-generating"],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  const isPolling = baseline !== null && baseline !== undefined;
  const baselineCount = typeof baseline === "number" ? baseline : 0;

  const { data: conversationsData } = useQueryWithTokenRefresh(
    ["agent-conversations-filter", workspaceId],
    () => linkedinAgentService(workspaceId).getConversations(1, 50),
    { enabled: !!workspaceId }
  );
  const conversations: ConversationListItem[] = conversationsData?.results ?? [];

  useEffect(() => {
    if (!convDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (convDropdownRef.current && !convDropdownRef.current.contains(e.target as Node))
        setConvDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [convDropdownOpen]);

  const { data: postsData, isLoading } = useQueryWithTokenRefresh(
    ["posts", "draft", workspaceId, mode, page, pageSize, selectedConvId],
    () =>
      postsService(workspaceId).getDraftPosts(mode, page, pageSize, selectedConvId ?? undefined),
    {
      enabled: !!workspaceId,
      refetchInterval: isPolling
        ? (query) => {
            const data = query.state.data as { count?: number; results?: PostType[] } | undefined;
            const count = data?.count ?? 0;
            const results = data?.results ?? [];
            const done =
              count > baselineCount && results.every((p) => p.image_status !== "pending");
            return done ? false : 5000;
          }
        : false,
    }
  );

  const posts = postsData?.results ?? [];
  const totalCount = postsData?.count ?? 0;
  const hasNext = !!postsData?.next;
  const hasPrev = !!postsData?.previous;
  const isGenerating = isPolling && totalCount <= baselineCount;

  useEffect(() => {
    const count = postsData?.count ?? 0;
    const results = postsData?.results ?? [];
    if (isPolling && count > baselineCount && results.every((p) => p.image_status !== "pending")) {
      queryClient.setQueryData(["posts-generating"], null);
    }
  }, [postsData, isPolling, baselineCount, queryClient]);

  const { data: account } = useQueryWithTokenRefresh(
    ["linkedin-account", workspaceId],
    () => linkedinService(workspaceId).getAccount(),
    { enabled: !!workspaceId }
  );
  const accountName = account?.name ?? "LinkedIn User";

  const approveMutation = useMutationWithTokenRefresh(
    (id: string) => postsService(workspaceId).approvePost(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId], exact: false });
        queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success("Post approved!");
        setApprovingId(null);
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error));
        setApprovingId(null);
      },
    }
  );

  const rejectMutation = useMutationWithTokenRefresh(
    (id: string) => postsService(workspaceId).rejectPost(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId], exact: false });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success("Post deleted.");
        setRejectPost(null);
        setRejectingId(null);
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error));
        setRejectingId(null);
      },
    }
  );

  const [publishModalPost, setPublishModalPost] = useState<PostType | null>(null);
  const [publishDraft, setPublishDraft] = useState("");
  const [savingPublish, setSavingPublish] = useState(false);

  const formatSuggested = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const isoToLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  };

  const openPublishModal = (post: PostType) => {
    setPublishModalPost(post);
    setPublishDraft(post.suggested_publish_at ? isoToLocal(post.suggested_publish_at) : "");
  };

  const savePublishTime = async () => {
    if (!publishModalPost || !publishDraft) return;
    const newIso = new Date(publishDraft).toISOString();
    const postId = publishModalPost.id;
    setSavingPublish(true);
    try {
      await postsService(workspaceId).patchPost(postId, { suggested_publish_at: newIso });
      queryClient.setQueryData(
        ["posts", "draft", workspaceId, mode, page, pageSize, selectedConvId],
        (
          old:
            | { count: number; next: string | null; previous: string | null; results: PostType[] }
            | undefined
        ) => {
          if (!old) return old;
          return {
            ...old,
            results: old.results.map((p) =>
              p.id === postId ? { ...p, suggested_publish_at: newIso } : p
            ),
          };
        }
      );
      toast.success("Suggested time updated.");
      setPublishModalPost(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSavingPublish(false);
    }
  };

  const handleSelectConv = (id: string | null) => {
    setSelectedConvId(id);
    setPage(1);
    setConvDropdownOpen(false);
  };

  const handleApprove = (id: string) => {
    setApprovingId(id);
    approveMutation.mutate(id);
  };

  const handleRejectConfirm = () => {
    if (!rejectPost) return;
    setRejectingId(rejectPost.id);
    rejectMutation.mutate(rejectPost.id);
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-gray-900">Review &amp; Approval</h2>
          {!isLoading && totalCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {totalCount} awaiting
            </span>
          )}
          {conversations.length > 0 && (
            <div ref={convDropdownRef} className="relative">
              <div className="flex items-center">
                <button
                  onClick={() => setConvDropdownOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedConvId
                      ? "rounded-r-none border-r-0 border-violet-300 bg-violet-50 text-violet-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <LuMessageSquare className="h-3 w-3" />
                  {selectedConvId
                    ? conversations.find((c) => c.id === selectedConvId)?.title || "Untitled"
                    : "All conversations"}
                  {!selectedConvId && <LuChevronDown className="h-3 w-3" />}
                </button>
                {selectedConvId && (
                  <button
                    onClick={() => handleSelectConv(null)}
                    className="flex self-stretch items-center rounded-r-lg border border-violet-300 bg-violet-50 px-1.5 text-violet-400 transition-colors hover:bg-violet-100 hover:text-violet-700"
                    title="Clear filter"
                  >
                    <LuX className="h-3 w-3" />
                  </button>
                )}
              </div>
              {convDropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => handleSelectConv(null)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50",
                      !selectedConvId ? "font-semibold text-violet-700" : "text-gray-700"
                    )}
                  >
                    All conversations
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConv(conv.id)}
                      className={cn(
                        "w-full truncate px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50",
                        selectedConvId === conv.id
                          ? "font-semibold text-violet-700"
                          : "text-gray-700"
                      )}
                    >
                      {conv.title || "Untitled conversation"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && (isTextGenerating || isGenerating) && (
        <div className="mb-4 rounded-xl border border-dashed border-blue-200 bg-blue-50 py-12 text-center">
          <LuLoader className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-blue-600">Generating posts…</p>
          <p className="mt-1 text-xs text-blue-400">This usually takes 5–10 seconds.</p>
        </div>
      )}

      {!isLoading && !isTextGenerating && !isGenerating && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-400">No drafts awaiting review.</p>
        </div>
      )}

      {!isLoading && posts.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 lg:grid-cols-4">
          {posts.map((post) => {
            const isApproving = approvingId === post.id;
            const isRejecting = rejectingId === post.id;
            const hasImage = !!post.image_url;

            return (
              // Outer wrapper: overflow-visible so floating buttons protrude above top border
              <div key={post.id} className="group relative h-80">
                {/* Floating approve / reject buttons */}
                <div className="absolute right-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5">
                  <button
                    onClick={() => handleApprove(post.id)}
                    disabled={isApproving || isRejecting}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-500 disabled:opacity-50"
                    title="Approve"
                  >
                    {isApproving ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuCheck className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setRejectPost(post)}
                    disabled={isApproving || isRejecting}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-400 disabled:opacity-50"
                    title="Delete"
                  >
                    {isRejecting ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuX className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Card — overflow-hidden clips body text at card boundary */}
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
                  {/* Header: avatar + name + Draft badge */}
                  <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">
                        {getInitials(accountName)}
                      </div>
                      <p className="truncate text-sm font-bold text-gray-900">{accountName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                      Draft
                    </span>
                  </div>

                  {/* Headline */}
                  {post.headline && (
                    <p className="mb-1.5 line-clamp-1 shrink-0 text-xs text-gray-500">
                      {post.headline}
                    </p>
                  )}

                  {/* Suggested time */}
                  {post.suggested_publish_at && (
                    <div className="mb-2 flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
                      <LuCalendarClock className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">
                        {formatSuggested(post.suggested_publish_at)}
                      </span>
                      <button
                        onClick={() => openPublishModal(post)}
                        className="text-gray-400 transition-colors hover:text-blue-500"
                        title="Edit suggested time"
                      >
                        <LuPencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Image */}
                  {post.image_status === "pending" ? (
                    <div className="mb-2 flex h-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-blue-200 bg-blue-50">
                      <div className="flex flex-col items-center gap-1">
                        <LuLoader className="h-4 w-4 animate-spin text-blue-400" />
                        <span className="text-[10px] text-blue-400">Generating image…</span>
                      </div>
                    </div>
                  ) : hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.image_url}
                      alt=""
                      className="mb-2 h-32 w-full shrink-0 rounded-xl object-cover"
                    />
                  ) : post.video_url ? (
                    <video
                      src={post.video_url}
                      controls
                      className="mb-2 h-32 w-full shrink-0 rounded-xl object-cover"
                    />
                  ) : null}

                  {/* Body */}
                  <div className="min-h-0 flex-1 overflow-hidden pb-8 text-xs leading-relaxed text-gray-600">
                    {post.image_status === "pending" || hasImage || post.video_url ? (
                      <p className="line-clamp-3">{post.body}</p>
                    ) : (
                      renderBodyBlocks(post)
                    )}
                  </div>

                  {/* Edit — pinned bottom-right, sits above overflow-hidden via absolute on outer */}
                  <button
                    onClick={() => setEditPost(post)}
                    className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <LuPencil className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <EditPostModal
        key={editPost?.id ?? "no-post"}
        isOpen={editPost !== null}
        onClose={() => setEditPost(null)}
        post={editPost}
        accountName={accountName}
      />

      <RejectConfirmModal
        isOpen={rejectPost !== null}
        onClose={() => {
          setRejectPost(null);
          setRejectingId(null);
        }}
        postExcerpt={rejectPost?.body.split("\n")[0] ?? ""}
        onConfirm={handleRejectConfirm}
        isConfirming={rejectingId !== null}
      />

      <Modal
        isOpen={publishModalPost !== null}
        onClose={() => setPublishModalPost(null)}
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
              value={publishDraft}
              onChange={(e) => setPublishDraft(e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {publishDraft && (
            <p className="text-xs text-gray-400">UTC: {new Date(publishDraft).toISOString()}</p>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            onClick={() => setPublishModalPost(null)}
            disabled={savingPublish}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={savePublishTime}
            disabled={!publishDraft || savingPublish}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPublish ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
