"use client";
import { useState, useEffect, useRef } from "react";
import {
  LuZap,
  LuLink,
  LuLoader,
  LuCheck,
  LuTriangleAlert,
  LuRefreshCw,
  LuSparkles,
  LuArrowRight,
  LuUser,
  LuX,
  LuTrash2,
  LuPencil,
  LuSave,
} from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { agentService } from "@/service/agentService";
import { postsService } from "@/service/postsService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { LinkedInProfile, MarketingPlan } from "@/types/Agent";
import ModelSwitcher, { useSelectedModel } from "./ModelSwitcher";

type Phase =
  | "a-loading"
  | "a-submit"
  | "a-polling"
  | "a-ready"
  | "a-error"
  | "b-generating"
  | "b-select"
  | "c-generating"
  | "c-polling"
  | "c-done";

function StepBar({ current }: { current: "a" | "b" | "c" }) {
  const steps = [
    { key: "a", label: "LinkedIn Profile" },
    { key: "b", label: "Marketing Plans" },
    { key: "c", label: "Generate Posts" },
  ] as const;
  const order = ["a", "b", "c"] as const;
  const currentIdx = order.indexOf(current);

  return (
    <div className="mb-5 flex items-start">
      {steps.map((step, i) => {
        const idx = order.indexOf(step.key);
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done
                    ? "border-teal-500 bg-teal-500 text-white"
                    : active
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-white text-gray-400"
                )}
              >
                {done ? <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] font-medium",
                  done ? "text-teal-600" : active ? "text-blue-600" : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mt-3.5 h-0.5 flex-1 mx-3 rounded-full",
                  done ? "bg-teal-400" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AgentModeSection() {
  const [open, setOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();

  const selectedModelId = useSelectedModel();
  const [phase, setPhase] = useState<Phase>("a-loading");
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [profileUrl, setProfileUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LinkedInProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [plans, setPlans] = useState<MarketingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MarketingPlan | null>(null);
  const [generatedPlanId, setGeneratedPlanId] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<MarketingPlan>>({});
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const GENERATE_COUNT = 5;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const stopPostPolling = () => {
    if (postPollRef.current) {
      clearInterval(postPollRef.current);
      postPollRef.current = null;
    }
  };

  useEffect(
    () => () => {
      stopPolling();
      stopPostPolling();
    },

    []
  );

  const startProfilePolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const p = await agentService(workspaceId).getProfile(id);
      if (!p) return;
      setProfile(p);
      if (p.status === "ready") {
        stopPolling();
        setPhase("a-ready");
      } else if (p.status === "error") {
        stopPolling();
        setPhase("a-error");
      }
    }, 3000);
  };

  const startPostPolling = (planId: string, baselineDraftCount: number) => {
    stopPostPolling();
    let attempts = 0;
    postPollRef.current = setInterval(async () => {
      attempts++;
      const data = await postsService(workspaceId).getDraftsByPlan(planId);
      if (data && data.results.length >= GENERATE_COUNT) {
        stopPostPolling();
        // Hand off image polling to ReviewApprovalSection via the same flag software mode uses
        queryClient.setQueryData(["posts-generating"], baselineDraftCount);
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        setPhase("c-done");
        setTimeout(() => setOpen(false), 2000);
      } else if (attempts >= 30) {
        stopPostPolling();
        toast.error("Post generation is taking longer than expected. Check your drafts later.");
        setPhase("b-select");
      }
    }, 2500);
  };

  const checkProfile = async () => {
    setPhase("a-loading");
    try {
      const data = await agentService(workspaceId).getProfiles();
      const all = data?.results ?? [];
      setProfiles(all);
      const latest = all[0] ?? null;
      if (!latest) {
        setPhase("a-submit");
      } else if (latest.status === "ready") {
        setProfile(latest);
        setPhase("a-ready");
      } else if (latest.status === "error") {
        setProfile(latest);
        setPhase("a-error");
      } else {
        setProfile(latest);
        setPhase("a-polling");
        startProfilePolling(latest.id);
      }
    } catch {
      setPhase("a-submit");
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setProfile(null);
    setProfiles([]);
    setProfileUrl("");
    setDeleteTarget(null);
    setIsDeleting(false);
    setPlans([]);
    setSelectedPlan(null);
    setGeneratedPlanId("");
    setEditingPlanId(null);
    setEditDraft({});
    if (workspaceId) checkProfile();
  };

  const handleClose = () => {
    stopPolling();
    stopPostPolling();
    setOpen(false);
  };

  const handleSubmitProfile = async () => {
    if (!profileUrl.trim()) return;
    setProfileLoading(true);
    try {
      const p = await agentService(workspaceId).createProfile(profileUrl.trim());
      setProfile(p);
      setProfiles((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
      setProfileUrl("");
      if (p.status === "ready") {
        setPhase("a-ready");
      } else if (p.status === "error") {
        setPhase("a-error");
      } else {
        setPhase("a-polling");
        startProfilePolling(p.id);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await agentService(workspaceId).deleteProfile(deleteTarget.id);
      const remaining = profiles.filter((p) => p.id !== deleteTarget.id);
      setProfiles(remaining);
      setDeleteTarget(null);
      if (remaining.length === 0) {
        setProfile(null);
        setPhase("a-submit");
      } else {
        setProfile(remaining[0]);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryProfile = async () => {
    if (!profile) return;
    try {
      const p = await agentService(workspaceId).refetchProfile(profile.id);
      setProfile(p);
      if (p.status === "ready") {
        setPhase("a-ready");
      } else {
        setPhase("a-polling");
        startProfilePolling(p.id);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleGeneratePlans = async () => {
    setEditingPlanId(null);
    setEditDraft({});
    setPhase("b-generating");
    try {
      const data = await agentService(workspaceId).generatePlans(selectedModelId ?? undefined);
      const planList = Array.isArray(data)
        ? data
        : ((data as { results?: MarketingPlan[] }).results ?? []);
      if (planList.length === 0) {
        toast.error("No plans were generated. Please try again.");
        setPhase("a-ready");
        return;
      }
      setPlans(planList);
      setSelectedPlan(planList[0]);
      setPhase("b-select");
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setPhase("a-ready");
    }
  };

  const handleEditPlan = (plan: MarketingPlan) => {
    setEditingPlanId(plan.id);
    setEditDraft({
      title: plan.title,
      angle: plan.angle,
      target_audience: plan.target_audience,
      pillars: plan.pillars,
      sample_hooks: plan.sample_hooks,
    });
  };

  const handleSavePlan = async (planId: string) => {
    setIsSavingPlan(true);
    try {
      const updated = await agentService(workspaceId).updatePlan(planId, editDraft);
      if (updated) {
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        if (selectedPlan?.id === planId) setSelectedPlan(updated);
      }
      setEditingPlanId(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleGenerateFromPlan = async () => {
    if (!selectedPlan) return;
    // Capture baseline draft count before generation so ReviewApprovalSection
    // knows when new posts have appeared and images are done
    const cached = queryClient.getQueryData(["posts", "draft", workspaceId]) as
      { count?: number } | undefined;
    const baselineDraftCount = cached?.count ?? 0;

    setPhase("c-generating");
    try {
      await agentService(workspaceId).generateFromPlan(
        selectedPlan.id,
        selectedModelId ?? undefined
      );
      // 202 queued — poll until the plan's draft posts appear
      setGeneratedPlanId(selectedPlan.id);
      setPhase("c-polling");
      startPostPolling(selectedPlan.id, baselineDraftCount);
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setPhase("b-select");
    }
  };

  const currentStep = phase.startsWith("a") ? "a" : phase.startsWith("b") ? "b" : "c";

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <LuZap className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Agent Mode</p>
          <p className="text-xs text-gray-500">
            Analyze your LinkedIn profile, build a content plan, and generate posts automatically.
          </p>
        </div>
        <button
          onClick={handleOpen}
          disabled={!workspaceId}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <LuSparkles className="h-3.5 w-3.5" />
          Run Agent
        </button>
      </div>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title="Agent Mode"
        width="3xl"
        disableBackdropClose
        minHeight="480px"
        bodyClassName="flex flex-col"
      >
        <StepBar current={currentStep as "a" | "b" | "c"} />

        {/* ── Phase A: Loading ── */}
        {phase === "a-loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Checking LinkedIn profile…</p>
          </div>
        )}

        {/* ── Phase A: Submit URL ── */}
        {phase === "a-submit" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter your LinkedIn profile URL so the agent can analyze your presence and build a
              personalized content plan.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                LinkedIn Profile URL
              </label>
              <div className="relative">
                <LuLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitProfile();
                  }}
                  placeholder="https://linkedin.com/in/your-profile"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleSubmitProfile}
              disabled={!profileUrl.trim() || profileLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {profileLoading ? (
                <LuLoader className="h-4 w-4 animate-spin" />
              ) : (
                <LuArrowRight className="h-4 w-4" />
              )}
              {profileLoading ? "Submitting…" : "Analyze Profile"}
            </button>
          </div>
        )}

        {/* ── Phase A: Polling ── */}
        {phase === "a-polling" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-blue-50 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-700">
              {profile?.status === "fetching"
                ? "Fetching your LinkedIn data…"
                : "Processing your profile…"}
            </p>
            <p className="text-xs text-gray-400">{profile?.url}</p>
            <p className="text-xs text-gray-400">This usually takes 15–30 seconds.</p>
          </div>
        )}

        {/* ── Phase A: Error ── */}
        {phase === "a-error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
              <LuTriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-800">Profile fetch failed</p>
                <p className="mt-0.5 text-xs text-red-600">
                  {profile?.error_message ?? "An unknown error occurred."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setProfile(null);
                  setProfileUrl("");
                  setPhase("a-submit");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LuX className="h-4 w-4" />
                Change URL
              </button>
              <button
                onClick={handleRetryProfile}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <LuRefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Phase A: Ready ── */}
        {phase === "a-ready" && (
          <>
            {/* Spacer pushes controls to the bottom */}
            <div className="flex-1" />

            <div className="space-y-3">
              {/* Profile list */}
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100">
                    <LuUser className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {p.name ?? "Profile ready"}
                    </p>
                    {p.headline && <p className="truncate text-xs text-gray-500">{p.headline}</p>}
                    <p className="truncate text-xs text-blue-600">{p.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LuCheck className="h-4 w-4 text-teal-500" strokeWidth={2.5} />
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LuTrash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Inline delete confirm */}
              {deleteTarget && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                  <p className="text-sm font-medium text-red-800">
                    Remove{" "}
                    <span className="font-semibold">{deleteTarget.name || deleteTarget.url}</span>?
                  </p>
                  <p className="mt-0.5 text-xs text-red-500">This action cannot be undone.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      disabled={isDeleting}
                      className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteProfile}
                      disabled={isDeleting}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LuTrash2 className="h-3.5 w-3.5" />
                      )}
                      {isDeleting ? "Removing…" : "Yes, remove"}
                    </button>
                  </div>
                </div>
              )}

              {/* Add another profile URL */}
              {!deleteTarget && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <LuLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={profileUrl}
                      onChange={(e) => setProfileUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmitProfile();
                      }}
                      placeholder="Add another profile URL (optional)"
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {profileUrl.trim() && (
                      <button
                        onClick={handleSubmitProfile}
                        disabled={profileLoading}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        {profileLoading ? (
                          <LuLoader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LuArrowRight className="h-3.5 w-3.5" />
                        )}
                        Add
                      </button>
                    )}
                    <button
                      onClick={handleGeneratePlans}
                      disabled={profileLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      <LuSparkles className="h-4 w-4" />
                      Generate Marketing Plans
                    </button>
                    <ModelSwitcher dropUp />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Phase B: Generating plans ── */}
        {phase === "b-generating" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Building your content marketing plans…</p>
            <p className="text-xs text-gray-400">Analyzing your profile and knowledge base.</p>
          </div>
        )}

        {/* ── Phase B: Select plan ── */}
        {phase === "b-select" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose the marketing plan that best fits your goals. The agent will generate posts
              aligned to it.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((plan, i) => {
                const isSelected = selectedPlan?.id === plan.id;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={cn(
                      "relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    )}
                  >
                    {/* Card header */}
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {isSelected ? <LuCheck className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Selected
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlan(plan);
                          }}
                          className="flex items-center justify-center rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Edit plan"
                        >
                          <LuPencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-bold leading-snug text-gray-900">{plan.title}</p>

                    {/* Angle */}
                    {plan.angle && (
                      <div className="mt-2.5">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Angle
                        </p>
                        <p className="text-xs leading-relaxed text-gray-600">{plan.angle}</p>
                      </div>
                    )}

                    {/* Target audience */}
                    {plan.target_audience && (
                      <div className="mt-2.5">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Target Audience
                        </p>
                        <p className="text-xs leading-relaxed text-gray-600">
                          {plan.target_audience}
                        </p>
                      </div>
                    )}

                    {/* Content pillars */}
                    {plan.pillars && plan.pillars.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Content Pillars
                        </p>
                        <ul className="space-y-0.5">
                          {plan.pillars.map((pillar) => (
                            <li key={pillar} className="flex items-start gap-1.5">
                              <span
                                className={cn(
                                  "mt-1.5 h-1 w-1 shrink-0 rounded-full",
                                  isSelected ? "bg-blue-500" : "bg-gray-400"
                                )}
                              />
                              <span className="text-xs leading-relaxed text-gray-600">
                                {pillar}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Sample hook */}
                    {plan.sample_hooks && plan.sample_hooks.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Sample Hook
                        </p>
                        <p className="text-xs italic leading-relaxed text-gray-500">
                          &ldquo;{plan.sample_hooks[0]}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePlans}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LuRefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <ModelSwitcher dropUp />
              <button
                onClick={handleGenerateFromPlan}
                disabled={!selectedPlan}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <LuSparkles className="h-4 w-4" />
                Generate Posts
              </button>
            </div>
          </div>
        )}

        {/* ── Phase C: Queuing ── */}
        {phase === "c-generating" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <LuLoader className="h-7 w-7 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Sending to queue…</p>
          </div>
        )}

        {/* ── Phase C: Polling for posts ── */}
        {phase === "c-polling" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10">
            {/* Ring spinner */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-500" />
              <LuSparkles className="h-7 w-7 text-blue-500" />
            </div>

            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold text-gray-900">Creating your posts…</p>
              <p className="text-xs text-gray-400">Usually takes 5–10 seconds. Hang tight!</p>
            </div>

            {/* Bouncing dots */}
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>

            <p className="text-[11px] text-gray-300">{generatedPlanId}</p>
          </div>
        )}

        {/* ── Phase C: Done ── */}
        {phase === "c-done" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <LuCheck className="h-7 w-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <p className="text-base font-semibold text-gray-900">Posts created!</p>
              <p className="text-center text-sm text-gray-500">
                Draft posts have been generated from your plan. Review and approve them in the
                section below.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <LuCheck className="h-4 w-4" />
              View Drafts
            </button>
          </div>
        )}
      </Modal>

      {/* ── Edit Plan Modal ── */}
      <Modal
        isOpen={editingPlanId !== null}
        onClose={() => setEditingPlanId(null)}
        title="Edit Marketing Plan"
        width="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Title
            </label>
            <input
              type="text"
              value={editDraft.title ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Angle
            </label>
            <textarea
              value={editDraft.angle ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, angle: e.target.value }))}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Target Audience
            </label>
            <textarea
              value={editDraft.target_audience ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, target_audience: e.target.value }))}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Content Pillars (one per line)
            </label>
            <textarea
              value={(editDraft.pillars ?? []).join("\n")}
              onChange={(e) =>
                setEditDraft((d) => ({
                  ...d,
                  pillars: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Sample Hook
            </label>
            <textarea
              value={(editDraft.sample_hooks ?? [])[0] ?? ""}
              onChange={(e) =>
                setEditDraft((d) => ({
                  ...d,
                  sample_hooks: [e.target.value, ...(d.sample_hooks ?? []).slice(1)],
                }))
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditingPlanId(null)}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSavePlan(editingPlanId!)}
              disabled={isSavingPlan}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingPlan ? (
                <LuLoader className="h-4 w-4 animate-spin" />
              ) : (
                <LuSave className="h-4 w-4" />
              )}
              {isSavingPlan ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
