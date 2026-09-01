"use client";
import { useState, useEffect, Suspense } from "react";
import { LuBot, LuPenLine } from "react-icons/lu";
import { cn } from "@/utils/cn";
import AccountSection from "@/components/linkedin-autopilot/AccountSection";
import AgentModeSection from "@/components/linkedin-autopilot/AgentModeSection";
import ManualModeSection from "@/components/linkedin-autopilot/ManualModeSection";
import ReviewApprovalSection from "@/components/linkedin-autopilot/ReviewApprovalSection";
import PostManagementSection from "@/components/linkedin-autopilot/PostManagementSection";

type Mode = "agent" | "manual";

const MODE_KEY = "linkedin-autopilot-mode";

function readStoredMode(): Mode {
  try {
    const v = sessionStorage.getItem(MODE_KEY);
    if (v === "manual" || v === "agent") return v;
  } catch {}
  return "agent";
}

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className ?? ""}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* LinkedIn card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Sk className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Sk className="h-4 w-40" />
            <Sk className="h-3 w-56" />
          </div>
          <Sk className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2"
          >
            <Sk className="h-3 w-20" />
            <Sk className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-2 gap-3">
        <Sk className="h-24 rounded-2xl" />
        <Sk className="h-24 rounded-2xl" />
      </div>

      {/* Review & Approval */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <Sk className="h-5 w-40" />
          <Sk className="h-6 w-16 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sk className="h-8 w-8 rounded-full shrink-0" />
                <Sk className="h-4 w-24" />
              </div>
              <Sk className="h-3 w-full" />
              <Sk className="h-3 w-5/6" />
              <Sk className="h-32 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinkedInAutopilotContent() {
  const [mode, setModeState] = useState<Mode>(readStoredMode);
  const [mounted, setMounted] = useState(false);
  const [agentTrigger, setAgentTrigger] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const openAgent = () => {
    setModeState("agent");
    try {
      sessionStorage.setItem(MODE_KEY, "agent");
    } catch {}
    setAgentTrigger((t) => t + 1);
  };

  const openManual = () => {
    setModeState("manual");
    try {
      sessionStorage.setItem(MODE_KEY, "manual");
    } catch {}
    setManualOpen(true);
  };

  if (!mounted) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* LinkedIn account + 8 stats cards — always at top */}
      <AccountSection mode={mode} />

      {/* Mode cards — clicking opens the respective modal */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={openAgent}
          className={cn(
            "rounded-2xl border p-4 text-left transition-all",
            mode === "agent"
              ? "border-blue-500 bg-blue-50 shadow-sm"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                mode === "agent" ? "bg-blue-600" : "bg-gray-100"
              )}
            >
              <LuBot className={cn("h-5 w-5", mode === "agent" ? "text-white" : "text-gray-500")} />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  mode === "agent" ? "text-blue-700" : "text-gray-900"
                )}
              >
                Agentic
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Let the agent research your brand, build a plan, and draft posts for you to approve.
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={openManual}
          className={cn(
            "rounded-2xl border p-4 text-left transition-all",
            mode === "manual"
              ? "border-blue-500 bg-blue-50 shadow-sm"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                mode === "manual" ? "bg-blue-600" : "bg-gray-100"
              )}
            >
              <LuPenLine
                className={cn("h-5 w-5", mode === "manual" ? "text-white" : "text-gray-500")}
              />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  mode === "manual" ? "text-blue-700" : "text-gray-900"
                )}
              >
                Manual
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Generate posts yourself from a prompt and your own knowledge base.
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Agent modal — card-less, triggered via mode card */}
      <AgentModeSection showCard={false} triggerOpen={agentTrigger} />

      {/* Manual modal — 3-step stepper */}
      <ManualModeSection open={manualOpen} onClose={() => setManualOpen(false)} />

      <ReviewApprovalSection mode={mode} />
      <PostManagementSection mode={mode} />
    </div>
  );
}

export default function LinkedInAutopilotPage() {
  return (
    <div className="flex-1 bg-[#E9ECF5] px-4 py-4">
      <Suspense fallback={null}>
        <LinkedInAutopilotContent />
      </Suspense>
    </div>
  );
}
