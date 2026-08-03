"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LuCheck } from "react-icons/lu";
import toast from "react-hot-toast";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { linkedinService } from "@/service/linkedinService";
import { agentService } from "@/service/agentService";
import { documentService } from "@/service/documentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import LinkedInManageModal from "./LinkedInManageModal";
import ProfileUrlModal from "./ProfileUrlModal";
import KnowledgeUploadModal from "./KnowledgeUploadModal";
import AgentKnowledgeUploadModal from "./AgentKnowledgeUploadModal";

type KnowledgeType = "knowledge" | "tune" | "style";

type ModalState =
  | { type: "none" }
  | { type: "linkedin" }
  | { type: "profileUrl" }
  | { type: "knowledge"; initialType: KnowledgeType };

type Mode = "agent" | "manual";

const ALL_STEPS: { label: string; modal: ModalState }[] = [
  { label: "LinkedIn Connect", modal: { type: "linkedin" } },
  { label: "Profile URL", modal: { type: "profileUrl" } },
  { label: "Knowledge", modal: { type: "knowledge", initialType: "knowledge" } },
  { label: "Tone", modal: { type: "knowledge", initialType: "tune" } },
  { label: "Style Upload", modal: { type: "knowledge", initialType: "style" } },
];

export default function SetupStepper({ mode }: { mode: Mode }) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // ── Data queries (shared cache with AccountSection) ──
  const { data: account } = useQueryWithTokenRefresh(
    ["linkedin-account", workspaceId],
    () => linkedinService(workspaceId).getAccount(),
    { enabled: !!workspaceId }
  );

  const { data: profiles } = useQueryWithTokenRefresh(
    ["linkedin-profiles", workspaceId],
    () => agentService(workspaceId).getProfiles(),
    { enabled: !!workspaceId }
  );

  const hasReadyProfile = profiles?.results?.some((p) => p.status === "ready") ?? false;

  // Manual mode — workspace documents
  const { data: documents } = useQueryWithTokenRefresh(
    ["documents", workspaceId],
    () => documentService(workspaceId).getDocuments(),
    { enabled: mode === "manual" && !!workspaceId }
  );
  const docs = documents?.results ?? [];

  // Agent mode — agent-level documents + websites (independent APIs)
  const { data: agentDocsData } = useQueryWithTokenRefresh(
    ["agent-documents", workspaceId],
    () => agentService(workspaceId).getAgentDocuments(),
    { enabled: mode === "agent" && !!workspaceId }
  );
  const { data: agentWebsitesData } = useQueryWithTokenRefresh(
    ["agent-websites", workspaceId],
    () => agentService(workspaceId).getAgentWebsites(),
    { enabled: mode === "agent" && !!workspaceId }
  );
  const agentDocs = agentDocsData?.results ?? [];
  const agentSites = agentWebsitesData?.results ?? [];

  const hasAgentSource = (purpose: string) =>
    agentDocs.some((d) => d.purpose === purpose) || agentSites.some((s) => s.purpose === purpose);

  const allCompleted = [
    account?.connected === true,
    hasReadyProfile,
    mode === "agent" ? hasAgentSource("knowledge") : docs.some((d) => d.purpose === "knowledge"),
    mode === "agent" ? hasAgentSource("tone") : docs.some((d) => d.purpose === "tone"),
    mode === "agent" ? hasAgentSource("style") : docs.some((d) => d.purpose === "style"),
  ];

  // In manual mode, hide the Profile URL step (index 1)
  const STEPS = mode === "manual" ? ALL_STEPS.filter((_, i) => i !== 1) : ALL_STEPS;
  const completed = mode === "manual" ? allCompleted.filter((_, i) => i !== 1) : allCompleted;

  const activeIndex = completed.findIndex((c) => !c);
  const effectiveActive = activeIndex === -1 ? STEPS.length : activeIndex;

  // ── LinkedIn handlers ──
  const handleConnect = async () => {
    if (!workspaceId) return;
    setIsConnecting(true);
    try {
      const result = await linkedinService(workspaceId).getConnectUrl();
      if (result?.authorize_url) {
        window.location.href = result.authorize_url;
      } else {
        toast.error("Failed to get LinkedIn authorization URL.");
        setIsConnecting(false);
      }
    } catch {
      toast.error("Failed to initiate LinkedIn connection.");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!workspaceId) return;
    setIsDisconnecting(true);
    try {
      await linkedinService(workspaceId).disconnectAccount();
      queryClient.invalidateQueries({ queryKey: ["linkedin-account", workspaceId] });
      toast.success("LinkedIn account disconnected.");
      setModal({ type: "none" });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start">
          {STEPS.map((step, i) => {
            const isDone = completed[i];
            const isActive = i === effectiveActive;

            return (
              <div key={step.label} className="contents">
                {/* Step node — natural width only */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => setModal(step.modal)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all hover:scale-105 hover:shadow-md ${
                      isDone
                        ? "border-teal-500 bg-teal-500 text-white"
                        : isActive
                          ? "border-blue-500 bg-white text-blue-600"
                          : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {isDone ? (
                      <LuCheck className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <span className="text-xs font-semibold">{i + 1}</span>
                    )}
                  </button>
                  <button
                    onClick={() => setModal(step.modal)}
                    className={`whitespace-nowrap text-xs font-medium transition-colors hover:underline ${
                      isDone ? "text-teal-600" : isActive ? "text-blue-600" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </button>
                </div>

                {/* Connector — flex-1 fills all space between steps */}
                {i < STEPS.length - 1 && (
                  <div className="mt-4 flex flex-1 items-center px-3">
                    <div
                      className={`h-0.5 w-full rounded-full transition-colors ${
                        completed[i] ? "bg-teal-400" : "bg-gray-200"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modals ── */}
      <LinkedInManageModal
        isOpen={modal.type === "linkedin"}
        onClose={() => setModal({ type: "none" })}
        account={account}
        onConnect={handleConnect}
        isConnecting={isConnecting}
        onDisconnect={handleDisconnect}
        isDisconnecting={isDisconnecting}
      />

      <ProfileUrlModal
        isOpen={modal.type === "profileUrl"}
        onClose={() => setModal({ type: "none" })}
      />

      {modal.type === "knowledge" && mode === "manual" && (
        <KnowledgeUploadModal
          key={modal.initialType}
          isOpen
          onClose={() => setModal({ type: "none" })}
          initialType={modal.initialType}
        />
      )}

      {modal.type === "knowledge" && mode === "agent" && (
        <AgentKnowledgeUploadModal
          key={modal.initialType}
          isOpen
          onClose={() => setModal({ type: "none" })}
          initialType={modal.initialType}
        />
      )}
    </>
  );
}
