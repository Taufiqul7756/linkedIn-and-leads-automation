"use client";

import { useWorkspace } from "@/context/WorkspaceContext";
import AutomationView from "@/components/linkedin/AutomationView";

export default function AutomationPage() {
  const { activeWorkspace } = useWorkspace();
  return <AutomationView key={activeWorkspace?.id ?? "no-workspace"} />;
}
