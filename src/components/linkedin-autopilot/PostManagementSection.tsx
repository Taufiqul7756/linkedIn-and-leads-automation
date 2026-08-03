"use client";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LuEye,
  LuThumbsUp,
  LuMessageSquare,
  LuExternalLink,
  LuEllipsisVertical,
  LuTrash2,
  LuListFilter,
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuPlay,
} from "react-icons/lu";
import toast from "react-hot-toast";
import { cn } from "@/utils/cn";
import { postsService } from "@/service/postsService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { PostType, PostEngagement } from "@/types/Post";
import ScheduleModal from "./ScheduleModal";
import ViewPostModal from "./ViewPostModal";
import RejectConfirmModal from "./RejectConfirmModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function parseHashtags(raw: unknown): string[] {
  if (!raw) return [];
  const items: string[] = Array.isArray(raw)
    ? raw.map(String)
    : String(raw)
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
  return items.filter((t) => t.length > 0).map((t) => (t.startsWith("#") ? t : `#${t}`));
}

// ── Status config ─────────────────────────────────────────────────────────────
type StatusKey = PostType["status"];

const STATUS_LABELS: Record<StatusKey, string> = {
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

const STATUS_STYLES: Record<StatusKey, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  draft: "bg-violet-100 text-violet-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_DOTS: Record<StatusKey, string> = {
  published: "bg-green-500",
  scheduled: "bg-blue-500",
  approved: "bg-emerald-500",
  draft: "bg-violet-500",
  failed: "bg-red-500",
};

const FILTER_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

// ── Engagement cell ───────────────────────────────────────────────────────────
function EngagementCell({
  status,
  engagement,
}: {
  status: StatusKey;
  engagement: PostEngagement | null;
}) {
  if (status === "published" && engagement) {
    return (
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <LuEye className="h-3.5 w-3.5" />
          {formatCount(engagement.impressions)}
        </span>
        <span className="flex items-center gap-1">
          <LuThumbsUp className="h-3.5 w-3.5" />
          {formatCount(engagement.likes)}
        </span>
        <span className="flex items-center gap-1">
          <LuMessageSquare className="h-3.5 w-3.5" />
          {formatCount(engagement.comments)}
        </span>
        <span className="font-semibold text-green-600">{engagement.rate.toFixed(1)}%</span>
      </div>
    );
  }
  if (status === "scheduled")
    return <span className="text-xs font-medium text-blue-600">In queue</span>;
  if (status === "approved") return <span className="text-xs text-gray-400">Ready</span>;
  if (status === "draft") return <span className="text-xs text-gray-400">Awaiting review</span>;
  if (status === "failed")
    return <span className="text-xs font-medium text-red-600">Publishing failed</span>;
  return null;
}

// ── Row three-dot dropdown ────────────────────────────────────────────────────
function RowDropdown({
  post,
  onView,
  onDelete,
}: {
  post: PostType;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded p-1 transition-colors hover:bg-gray-100 hover:text-gray-700",
          open ? "bg-gray-100 text-gray-700" : "text-gray-400"
        )}
      >
        <LuEllipsisVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            onClick={() => {
              setOpen(false);
              onView(post.id);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LuEye className="h-4 w-4 text-gray-400" />
            View
          </button>
          <div className="mx-3 border-t border-gray-100" />
          <button
            onClick={() => {
              setOpen(false);
              onDelete(post.id);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <LuTrash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Filter dropdown ───────────────────────────────────────────────────────────
function FilterDropdown({
  active,
  onChange,
}: {
  active: StatusKey | "all";
  onChange: (v: StatusKey | "all") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeLabel = active === "all" ? "Filter" : STATUS_LABELS[active];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          active !== "all"
            ? "border-blue-600 bg-blue-50 text-blue-600"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        )}
      >
        <LuListFilter className="h-4 w-4" />
        {activeLabel}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Status
          </div>
          <button
            onClick={() => {
              onChange("all");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            All posts
            {active === "all" && <LuCheck className="h-4 w-4 text-blue-600" />}
          </button>
          <div className="mx-3 border-t border-gray-100" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOTS[opt.value])} />
                {opt.label}
              </span>
              {active === opt.value && <LuCheck className="h-4 w-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Indeterminate checkbox ────────────────────────────────────────────────────
function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 accent-blue-600"
    />
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
type ScheduleTarget = { post: PostType; mode: "schedule" | "reschedule" } | null;

const PAGE_SIZE_OPTIONS = [2, 5, 10, 15, 20];

export default function PostManagementSection({ mode }: { mode: "agent" | "manual" }) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [activeFilter, setActiveFilter] = useState<StatusKey | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [scheduleTarget, setScheduleTarget] = useState<ScheduleTarget>(null);
  const [viewPostId, setViewPostId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PostType | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const { data: postsData, isLoading } = useQueryWithTokenRefresh(
    ["posts", "all", workspaceId, mode, activeFilter, page, pageSize],
    () =>
      postsService(workspaceId).getAllPosts(
        activeFilter === "all" ? undefined : activeFilter,
        page,
        pageSize,
        mode
      ),
    { enabled: !!workspaceId }
  );

  const posts = postsData?.results ?? [];
  const totalCount = postsData?.count ?? 0;
  const hasNext = !!postsData?.next;
  const hasPrev = !!postsData?.previous;

  const allIds = posts.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id)) && !allSelected;
  const selectedCount = allIds.filter((id) => selected.has(id)).length;

  const handleFilterChange = (f: StatusKey | "all") => {
    setActiveFilter(f);
    setPage(1);
    setSelected(new Set());
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
    setSelected(new Set());
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scheduleMutation = useMutationWithTokenRefresh(
    ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      postsService(workspaceId).schedulePost(id, scheduledAt),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success(
          scheduleTarget?.mode === "reschedule" ? "Post rescheduled!" : "Post scheduled!"
        );
        setScheduleTarget(null);
      },
      onError: (error: unknown) => toast.error(extractErrorMessage(error)),
    }
  );

  const handleScheduleConfirm = (scheduledAt: string) => {
    if (!scheduleTarget) return;
    scheduleMutation.mutate({ id: scheduleTarget.post.id, scheduledAt });
  };

  const handleDeletePost = (id: string) => {
    const post = posts.find((p) => p.id === id) ?? null;
    setDeleteTarget(post);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsConfirmingDelete(true);
    try {
      await postsService(workspaceId).rejectPost(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
      toast.success("Post deleted.");
      setDeleteTarget(null);
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    setIsDeleting(true);
    await Promise.all([...selected].map((id) => postsService(workspaceId).rejectPost(id)));
    queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
    setSelected(new Set());
    toast.success(`${selectedCount} post${selectedCount > 1 ? "s" : ""} deleted.`);
    setIsDeleting(false);
  };

  return (
    <div>
      {/* Section header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="text-base font-semibold text-gray-900">Post Management</h2>
          {selectedCount >= 2 && (
            <>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {selectedCount} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <LuTrash2 className="h-4 w-4" />
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 sm:self-auto">
          <span className="hidden text-xs text-gray-400 md:inline">
            {totalCount > 0 && `${totalCount} posts`}
          </span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
          <FilterDropdown active={activeFilter} onChange={handleFilterChange} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-10 px-4 py-3">
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </th>
                {[
                  "POST",
                  "CREATED",
                  "SCHEDULED",
                  "PUBLISHED",
                  "STATUS",
                  "ENGAGEMENT",
                  "ACTIONS",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-gray-100" />
                    </td>
                  </tr>
                ))}

              {!isLoading && posts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                    No posts found.
                  </td>
                </tr>
              )}

              {!isLoading &&
                posts.map((post) => {
                  const isSelected = selected.has(post.id);
                  const tags = parseHashtags(post.hashtags);

                  return (
                    <tr
                      key={post.id}
                      className={cn(
                        "group transition-colors",
                        isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="w-10 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(post.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                        />
                      </td>
                      <td className="max-w-xs px-5 py-4">
                        <p className="line-clamp-2 text-sm text-gray-800">{post.body}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-xs text-blue-500">
                              {t}
                            </span>
                          ))}
                          {post.content_style && (
                            <span className="text-xs text-gray-400">
                              · {post.content_style.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                        {formatDate(post.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm">
                        {post.scheduled_at ? (
                          <span className="font-medium text-blue-600">
                            {formatDateTime(post.scheduled_at)}
                          </span>
                        ) : post.suggested_publish_at && post.status === "approved" ? (
                          <span className="text-gray-400" title="Suggested — not yet scheduled">
                            {formatDateTime(post.suggested_publish_at)}
                            <span className="ml-1 text-[10px] text-gray-300">suggested</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                        {post.published_at ? (
                          formatDateTime(post.published_at)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            STATUS_STYLES[post.status]
                          )}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[post.status])}
                          />
                          {STATUS_LABELS[post.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <EngagementCell status={post.status} engagement={post.engagement} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          {post.status === "published" && post.linkedin_urn && (
                            <a
                              href={`https://www.linkedin.com/feed/update/${post.linkedin_urn}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600"
                            >
                              <LuExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {post.status === "approved" && (
                            <button
                              onClick={() => setScheduleTarget({ post, mode: "schedule" })}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              Schedule
                            </button>
                          )}
                          {post.status === "scheduled" && (
                            <>
                              <button
                                onClick={() => setScheduleTarget({ post, mode: "reschedule" })}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                Reschedule
                              </button>
                              <button className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white transition-colors hover:bg-green-600">
                                <LuPlay className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {post.status === "failed" && (
                            <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100">
                              Retry
                            </button>
                          )}
                          <RowDropdown
                            post={post}
                            onView={setViewPostId}
                            onDelete={handleDeletePost}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-400">
            {totalCount > 0 ? `Page ${page} · ${totalCount} total` : "No posts"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrev}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <LuChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Next
              <LuChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <RejectConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        postExcerpt={deleteTarget?.body.split("\n")[0] ?? ""}
        onConfirm={handleConfirmDelete}
        isConfirming={isConfirmingDelete}
      />

      <ViewPostModal
        isOpen={viewPostId !== null}
        onClose={() => setViewPostId(null)}
        postId={viewPostId}
      />

      <ScheduleModal
        key={scheduleTarget?.post.id ?? "no-schedule"}
        isOpen={scheduleTarget !== null}
        onClose={() => setScheduleTarget(null)}
        mode={scheduleTarget?.mode ?? "schedule"}
        postExcerpt={scheduleTarget?.post.body ?? ""}
        currentScheduled={scheduleTarget?.post.scheduled_at}
        suggestedAt={
          scheduleTarget?.mode === "schedule" ? scheduleTarget?.post.suggested_publish_at : null
        }
        onConfirm={handleScheduleConfirm}
        isLoading={scheduleMutation.isPending}
      />
    </div>
  );
}
