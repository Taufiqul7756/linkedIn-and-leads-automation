"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
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
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

  const mode: Mode = searchParams.get("mode") === "manual" ? "manual" : "agent";

  const setMode = (newMode: Mode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", newMode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Sync ?workspace= → context
  useEffect(() => {
    const urlId = searchParams.get("workspace");
    if (!urlId || workspaces.length === 0) return;
    const found = workspaces.find((w) => w.id === urlId);
    if (found && found.id !== activeWorkspace?.id) {
      setActiveWorkspace(urlId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, workspaces, setActiveWorkspace]);

  // On mount: if no ?workspace= in URL but we have an active workspace, add it
  useEffect(() => {
    if (!activeWorkspace) return;
    const urlId = searchParams.get("workspace");
    if (!urlId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("workspace", activeWorkspace.id);
      if (!params.get("mode")) params.set("mode", "agent");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeWorkspace, searchParams, router, pathname]);

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
