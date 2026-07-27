"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import SetupStepper from "@/components/linkedin-autopilot/SetupStepper";
import AccountSection from "@/components/linkedin-autopilot/AccountSection";
import GeneratePostsSection from "@/components/linkedin-autopilot/GeneratePostsSection";
import ReviewApprovalSection from "@/components/linkedin-autopilot/ReviewApprovalSection";
import PostManagementSection from "@/components/linkedin-autopilot/PostManagementSection";
import AgentWorkflowSection from "@/components/linkedin-autopilot/AgentWorkflowSection";

// Syncs ?workspace=<id> from URL into WorkspaceContext on page load
function WorkspaceUrlSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

  // Sync URL ?workspace= → context. Only fires when URL or workspace list changes,
  // NOT when activeWorkspace changes — avoids reverting Navbar-initiated switches
  // where setActiveWorkspace fires before router.replace updates searchParams.
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
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeWorkspace, searchParams, router, pathname]);

  return null;
}

export default function LinkedInAutopilotPage() {
  return (
    <div className="flex-1 bg-[#E9ECF5] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-screen-xl space-y-4 sm:space-y-5">
        <Suspense fallback={null}>
          <WorkspaceUrlSync />
        </Suspense>
        <SetupStepper />
        <Suspense fallback={null}>
          <AccountSection />
        </Suspense>
        <GeneratePostsSection />
        <ReviewApprovalSection />
        <PostManagementSection />
        <AgentWorkflowSection />
      </div>
    </div>
  );
}
