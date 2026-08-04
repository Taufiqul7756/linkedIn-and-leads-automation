"use client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { postsService } from "@/service/postsService";
import type { MarketingPlan } from "@/types/Agent";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_RING: Record<string, string> = {
  published: "ring-green-400 text-green-600",
  scheduled: "ring-blue-400 text-blue-600",
  approved: "ring-emerald-400 text-emerald-600",
  draft: "ring-violet-400 text-violet-600",
  failed: "ring-red-400 text-red-600",
};

const STATUS_BADGE: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  draft: "bg-violet-100 text-violet-700",
  failed: "bg-red-100 text-red-700",
};

export default function PlanDetailModal({
  plan,
  onClose,
}: {
  plan: MarketingPlan | null;
  onClose: () => void;
}) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const { data: postsData, isLoading } = useQueryWithTokenRefresh(
    ["posts", "by-plan", plan?.id, workspaceId],
    () => postsService(workspaceId).getDraftsByPlan(plan!.id),
    { enabled: !!plan && !!workspaceId }
  );

  if (!plan) return null;

  const posts = postsData?.results ?? [];

  return (
    <Modal isOpen onClose={onClose} title={plan.title} width="2xl">
      {/* ── Plan card with border ── */}
      <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
        {/* Top row: badges + post count */}
        <div className="mb-3 flex items-center gap-2">
          {plan.has_follow_up ? (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
              Continued ✓
            </span>
          ) : plan.post_count > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Used
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
              Unused
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {plan.post_count} post{plan.post_count !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {plan.brief?.target_audience && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-400">
                Audience
              </p>
              <p className="text-xs text-gray-700">{plan.brief.target_audience}</p>
            </div>
          )}
          {plan.brief?.region && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-400">
                Region
              </p>
              <p className="text-xs text-gray-700">{plan.brief.region}</p>
            </div>
          )}
          {plan.brief?.days && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-400">
                Window
              </p>
              <p className="text-xs text-gray-700">{plan.brief.days}d</p>
            </div>
          )}
        </div>

        {/* Angle */}
        {plan.angle && <p className="mt-2.5 text-xs leading-relaxed text-gray-600">{plan.angle}</p>}

        {/* Pillars */}
        {plan.pillars && plan.pillars.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.pillars.map((pillar) => (
              <span
                key={pillar}
                className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-medium text-blue-700"
              >
                {pillar}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Connector from plan card to posts ── */}
      {(isLoading || posts.length > 0) && <div className="ml-[19px] h-5 w-px bg-gray-200" />}

      {/* ── Posts section header ── */}
      {postsData && (
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-500">Posts from this plan</p>
          <span className="text-xs text-gray-400">{postsData.count} total</span>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className="ml-4 space-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200" />
                {i < 2 && <div className="my-1 h-10 w-px bg-gray-100" />}
              </div>
              <div className="mb-3 flex-1">
                <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && posts.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          No posts generated from this plan yet.
        </p>
      )}

      {/* ── Posts tree ── */}
      {!isLoading && posts.length > 0 && (
        <div className="ml-4">
          {posts.map((post, i) => (
            <div key={post.id} className="flex gap-4">
              {/* Left column: numbered circle + connecting line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold ring-2",
                    STATUS_RING[post.status] ?? "ring-gray-200 text-gray-400"
                  )}
                >
                  {i + 1}
                </div>
                {i < posts.length - 1 && <div className="my-1.5 w-px flex-1 bg-gray-200" />}
              </div>

              {/* Right column: post card */}
              <div className={cn("min-w-0 flex-1", i < posts.length - 1 ? "pb-3" : "")}>
                <div className="rounded-xl border border-gray-100 bg-white p-3 transition-colors hover:border-gray-200 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {post.headline && (
                        <p className="mb-0.5 line-clamp-1 text-xs font-medium text-gray-700">
                          {post.headline}
                        </p>
                      )}
                      <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
                        {post.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          STATUS_BADGE[post.status] ?? "bg-gray-100 text-gray-600"
                        )}
                      >
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>
                      {(post.scheduled_at || post.suggested_publish_at) && (
                        <span className="text-[10px] text-gray-400">
                          {formatDate(post.scheduled_at ?? post.suggested_publish_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
