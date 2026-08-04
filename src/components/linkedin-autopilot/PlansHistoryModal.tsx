"use client";
import { useState, useMemo } from "react";
import { LuChevronRight } from "react-icons/lu";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { agentService } from "@/service/agentService";
import type { MarketingPlan } from "@/types/Agent";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import PlanDetailModal from "./PlanDetailModal";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PlansHistoryModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const [selectedPlan, setSelectedPlan] = useState<MarketingPlan | null>(null);

  const { data, isLoading } = useQueryWithTokenRefresh(
    ["plans", "all", workspaceId],
    () => agentService(workspaceId).getAllPlans("all"),
    { enabled: isOpen && !!workspaceId }
  );

  // Group by batch, newest batch first
  const batches = useMemo(() => {
    const plans = data?.results ?? [];
    const map = new Map<string, MarketingPlan[]>();
    plans.forEach((p) => {
      const arr = map.get(p.batch) ?? [];
      arr.push(p);
      map.set(p.batch, arr);
    });
    return [...map.entries()].sort((a, b) => {
      const aTime = Math.max(...a[1].map((p) => new Date(p.created_at).getTime()));
      const bTime = Math.max(...b[1].map((p) => new Date(p.created_at).getTime()));
      return bTime - aTime;
    });
  }, [data?.results]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Plans History" width="2xl">
        {isLoading && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        )}

        {!isLoading && batches.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">No plans created yet.</p>
        )}

        {!isLoading && batches.length > 0 && (
          <div className="space-y-6">
            {batches.map(([batchId, batchPlans], batchIdx) => {
              const batchDate = batchPlans.reduce(
                (min, p) => (p.created_at < min ? p.created_at : min),
                batchPlans[0].created_at
              );
              return (
                <div key={batchId}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">
                      Batch {batches.length - batchIdx}
                    </span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatDate(batchDate)}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {batchPlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={cn(
                          "flex flex-col items-start rounded-xl border p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50",
                          plan.post_count > 0
                            ? "border-gray-200 bg-white"
                            : "border-gray-100 bg-gray-50 opacity-60"
                        )}
                      >
                        <div className="mb-1.5 flex w-full items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            {plan.has_follow_up ? (
                              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">
                                Continued ✓
                              </span>
                            ) : plan.post_count > 0 ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                Used
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">
                                Unused
                              </span>
                            )}
                          </div>
                          <LuChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                        </div>
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-gray-800">
                          {plan.title}
                        </p>
                        {plan.post_count > 0 && (
                          <p className="mt-1 text-[10px] text-gray-400">
                            {plan.post_count} post{plan.post_count !== 1 ? "s" : ""}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <PlanDetailModal
        key={selectedPlan?.id ?? "no-plan"}
        plan={selectedPlan}
        onClose={() => setSelectedPlan(null)}
        onFollowUpSuccess={onClose}
      />
    </>
  );
}
