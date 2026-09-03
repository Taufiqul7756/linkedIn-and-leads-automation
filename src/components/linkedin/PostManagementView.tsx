"use client";

import { Suspense } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { postsService } from "@/service/postsService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { PostStatsType } from "@/types/Post";
import ReviewApprovalSection from "@/components/linkedin-autopilot/ReviewApprovalSection";
import PostManagementSection from "@/components/linkedin-autopilot/PostManagementSection";

function formatNextScheduled(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "—";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

function buildStatCards(stats: PostStatsType | undefined) {
  const pw = stats?.published_this_week ?? null;
  const eng = stats?.avg_engagement ?? null;
  return [
    { label: "drafts", value: stats?.drafts ?? "—", note: null, noteColor: "" },
    { label: "approved", value: stats?.approved ?? "—", note: null, noteColor: "" },
    { label: "scheduled", value: stats?.scheduled ?? "—", note: null, noteColor: "" },
    {
      label: "published",
      value: stats?.published ?? "—",
      note: pw != null ? `+${pw} this week` : null,
      noteColor: "green",
    },
    { label: "failed", value: stats?.failed ?? "—", note: null, noteColor: "" },
    { label: "published this week", value: pw ?? "—", note: null, noteColor: "" },
    {
      label: "next scheduled",
      value: formatNextScheduled(stats?.next_scheduled_at),
      note: null,
      noteColor: "",
    },
    {
      label: "avg. engagement",
      value: eng != null ? `${eng.toFixed(1)}%` : "—",
      note: null,
      noteColor: "",
    },
  ];
}

function PostManagementContent() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const { data: postStats } = useQueryWithTokenRefresh(
    ["post-stats", workspaceId],
    () => postsService(workspaceId).getPostStats(),
    { enabled: !!workspaceId }
  );

  const statCards = buildStatCards(postStats);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Stats grid — 2 rows × 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            {stat.note && <p className="mt-0.5 text-xs font-medium text-green-600">{stat.note}</p>}
          </div>
        ))}
      </div>

      {/* Draft posts awaiting review */}
      <ReviewApprovalSection />

      {/* All non-draft posts table */}
      <PostManagementSection />
    </div>
  );
}

export default function PostManagementView() {
  return (
    <div className="flex-1 bg-[#E9ECF5] px-4 py-4">
      <Suspense fallback={null}>
        <PostManagementContent />
      </Suspense>
    </div>
  );
}
