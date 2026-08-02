"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import SetupStepper from "@/components/linkedin-autopilot/SetupStepper";
import AccountSection from "@/components/linkedin-autopilot/AccountSection";
import GeneratePostsSection from "@/components/linkedin-autopilot/GeneratePostsSection";
import ReviewApprovalSection from "@/components/linkedin-autopilot/ReviewApprovalSection";
import PostManagementSection from "@/components/linkedin-autopilot/PostManagementSection";
import AgentModeSection from "@/components/linkedin-autopilot/AgentModeSection";
import AgentWorkflowSection from "@/components/linkedin-autopilot/AgentWorkflowSection";

type Mode = "agent" | "manual";

function LinkedInAutopilotContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialized from URL so reload restores the correct mode.
  // No effect — useSearchParams() returns a new object every render,
  // which would fire an effect and reset mode back before router.replace completes.
  const [mode, setModeState] = useState<Mode>(() =>
    searchParams.get("mode") === "manual" ? "manual" : "agent"
  );

  const setMode = (newMode: Mode) => {
    setModeState(newMode); // immediate UI — no waiting for router
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", newMode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

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
      {mode === "agent" && <AgentModeSection />}
      <AccountSection />
      {mode === "manual" && <GeneratePostsSection />}
      <ReviewApprovalSection />
      <PostManagementSection />
      <AgentWorkflowSection />
    </div>
  );
}

export default function LinkedInAutopilotPage() {
  return (
    <div className="flex-1 bg-[#E9ECF5] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-screen-xl">
        <Suspense fallback={null}>
          <LinkedInAutopilotContent />
        </Suspense>
      </div>
    </div>
  );
}
