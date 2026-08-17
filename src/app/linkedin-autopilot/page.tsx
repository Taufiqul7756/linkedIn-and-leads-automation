"use client";
import { useState, useEffect, Suspense } from "react";
import SetupStepper from "@/components/linkedin-autopilot/SetupStepper";
import AccountSection from "@/components/linkedin-autopilot/AccountSection";
import GeneratePostsSection from "@/components/linkedin-autopilot/GeneratePostsSection";
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
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <Sk className="h-10 flex-1" />
        <Sk className="h-10 flex-1" />
      </div>

      {/* Setup stepper */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <Sk className="h-8 w-8 shrink-0 rounded-full" />
              {i < 4 && <Sk className="h-1 flex-1" />}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <Sk key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>

      {/* Agent mode banner */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Sk className="h-4 w-40" />
            <Sk className="h-3 w-64" />
          </div>
          <Sk className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Account + knowledge base cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <Sk className="h-4 w-32" />
          <Sk className="h-3 w-48" />
          <Sk className="h-8 w-24 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <Sk className="h-4 w-32" />
          <Sk className="h-3 w-48" />
          <Sk className="h-8 w-24 rounded-lg" />
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
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((j) => (
                  <Sk key={j} className="h-8 flex-1 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post Management */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <Sk className="h-5 w-36" />
          <Sk className="h-8 w-28 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Sk className="h-10 w-full rounded-lg" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Sk key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Agent Workflow */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <Sk className="h-5 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-2">
              <Sk className="h-8 w-8 rounded-full" />
              <Sk className="h-3 w-20" />
              <Sk className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinkedInAutopilotContent() {
  // sessionStorage is the sole source of truth for mode — immune to
  // Next.js hydration timing issues with useSearchParams().
  const [mode, setModeState] = useState<Mode>(readStoredMode);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const setMode = (newMode: Mode) => {
    setModeState(newMode);
    try {
      sessionStorage.setItem(MODE_KEY, newMode);
    } catch {}
  };

  if (!mounted) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Mode Tabs */}
      <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button
          onClick={() => setMode("agent")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            mode === "agent"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Agentic
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            mode === "manual"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Manual
        </button>
      </div>

      <SetupStepper mode={mode} />
      <AccountSection mode={mode} />
      {mode === "manual" && <GeneratePostsSection />}
      <ReviewApprovalSection mode={mode} />
      <PostManagementSection mode={mode} />
      {/* <AgentWorkflowSection /> */}
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
