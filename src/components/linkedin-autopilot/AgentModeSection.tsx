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
} from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { agentService } from "@/service/agentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { LinkedInProfile, MarketingPlan } from "@/types/Agent";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "bold", label: "Bold / Contrarian" },
  { value: "storytelling", label: "Storytelling" },
];
const LENGTH_OPTIONS = ["Short", "Medium", "Long"] as const;
type Length = (typeof LENGTH_OPTIONS)[number];

type Phase =
  | "a-loading"
  | "a-submit"
  | "a-polling"
  | "a-ready"
  | "a-error"
  | "b-generating"
  | "b-select"
  | "c-configure"
  | "c-generating"
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

  const [phase, setPhase] = useState<Phase>("a-loading");
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [profileUrl, setProfileUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [plans, setPlans] = useState<MarketingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MarketingPlan | null>(null);
  const [postCount, setPostCount] = useState<number | "">(5);
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState<Length>("Medium");
  const [useEmoji, setUseEmoji] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

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

  const checkProfile = async () => {
    setPhase("a-loading");
    try {
      const data = await agentService(workspaceId).getProfiles();
      const latest = data?.results?.[0] ?? null;
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
    setProfileUrl("");
    setPlans([]);
    setSelectedPlan(null);
    setPostCount(5);
    setTone("professional");
    setLength("Medium");
    setUseEmoji(false);
    if (workspaceId) checkProfile();
  };

  const handleClose = () => {
    stopPolling();
    setOpen(false);
  };

  const handleSubmitProfile = async () => {
    if (!profileUrl.trim()) return;
    setProfileLoading(true);
    try {
      const p = await agentService(workspaceId).createProfile(profileUrl.trim());
      setProfile(p);
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
    setPhase("b-generating");
    try {
      const data = await agentService(workspaceId).generatePlans();
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

  const handleGenerateFromPlan = async () => {
    if (!selectedPlan || postCount === "" || (postCount as number) < 1) return;
    setPhase("c-generating");
    try {
      await agentService(workspaceId).generateFromPlan(selectedPlan.id, {
        count: postCount as number,
        tone,
        length: length.toLowerCase(),
        use_emoji: useEmoji,
        use_ai_image: true,
      });
      queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
      setPhase("c-done");
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setPhase("c-configure");
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

      <Modal isOpen={open} onClose={handleClose} title="Agent Mode" width="lg">
        <StepBar current={currentStep as "a" | "b" | "c"} />

        {/* ── Phase A: Loading ── */}
        {phase === "a-loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
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
          <div className="flex flex-col items-center gap-3 rounded-xl bg-blue-50 py-10">
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
        {phase === "a-ready" && profile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100">
                <LuUser className="h-5 w-5 text-teal-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {profile.name ?? "Profile ready"}
                </p>
                {profile.headline && (
                  <p className="truncate text-xs text-gray-500">{profile.headline}</p>
                )}
                <p className="truncate text-xs text-blue-600">{profile.url}</p>
              </div>
              <LuCheck className="h-5 w-5 shrink-0 text-teal-500" strokeWidth={2.5} />
            </div>
            <button
              onClick={handleGeneratePlans}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <LuSparkles className="h-4 w-4" />
              Generate Marketing Plans
            </button>
          </div>
        )}

        {/* ── Phase B: Generating plans ── */}
        {phase === "b-generating" && (
          <div className="flex flex-col items-center gap-3 py-10">
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
            <div className="space-y-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    selectedPlan?.id === plan.id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{plan.title}</p>
                    {selectedPlan?.id === plan.id && (
                      <LuCheck className="h-4 w-4 shrink-0 text-blue-600" strokeWidth={2.5} />
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{plan.description}</p>
                  {plan.themes && plan.themes.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {plan.themes.map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGeneratePlans}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LuRefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <button
                onClick={() => setPhase("c-configure")}
                disabled={!selectedPlan}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <LuArrowRight className="h-4 w-4" />
                Use this plan
              </button>
            </div>
          </div>
        )}

        {/* ── Phase C: Configure ── */}
        {phase === "c-configure" && selectedPlan && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-800">{selectedPlan.title}</p>
              <p className="mt-0.5 text-xs text-blue-600">{selectedPlan.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Post count */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Posts <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={postCount}
                  onChange={(e) =>
                    setPostCount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="e.g. 5"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Tone */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Length */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Length
                </label>
                <div className="flex gap-1">
                  {LENGTH_OPTIONS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLength(l)}
                      className={cn(
                        "flex h-9 flex-1 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                        length === l
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      {l[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Emoji
                </label>
                <div className="flex gap-1">
                  {(["No", "Yes"] as const).map((opt) => {
                    const active = opt === "Yes" ? useEmoji : !useEmoji;
                    return (
                      <button
                        key={opt}
                        onClick={() => setUseEmoji(opt === "Yes")}
                        className={cn(
                          "flex h-9 flex-1 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                          active
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPhase("b-select")}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleGenerateFromPlan}
                disabled={postCount === "" || (postCount as number) < 1}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <LuSparkles className="h-4 w-4" />
                Generate {postCount || ""} Posts
              </button>
            </div>
          </div>
        )}

        {/* ── Phase C: Generating ── */}
        {phase === "c-generating" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-700">Generating posts from your plan…</p>
            <p className="text-xs text-gray-400">
              Posts are created as drafts. Images generate in the background.
            </p>
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
                {postCount} draft posts have been generated from your plan. Review and approve them
                in the section below.
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
    </>
  );
}
