"use client";

import { useState } from "react";
import { LuBook } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { linkedinService } from "@/service/linkedinService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import LinkedInManageModal from "@/components/linkedin-autopilot/LinkedInManageModal";
import KnowledgeBaseModal from "./KnowledgeBaseModal";

export default function AccountsView() {
  const [linkedInModalOpen, setLinkedInModalOpen] = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const { data: account, isLoading: accountLoading } = useQueryWithTokenRefresh(
    ["linkedin-account", workspaceId],
    () => linkedinService(workspaceId).getAccount(),
    { enabled: !!workspaceId }
  );

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
      setLinkedInModalOpen(false);
    } catch {
      toast.error("Failed to disconnect LinkedIn account.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = account?.connected ?? false;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      {/* Page header */}
      <div className="border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Accounts &amp; knowledge</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect LinkedIn and manage what the agent knows about your brand.
        </p>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* LinkedIn Account card */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <FaLinkedinIn className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">LinkedIn account</span>
                {accountLoading ? (
                  <span className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                ) : isConnected ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-gray-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                    Not connected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {accountLoading
                  ? "Loading..."
                  : isConnected
                    ? `${account?.name} · authorized via OAuth · publish enabled`
                    : "Connect your LinkedIn to start publishing"}
              </p>
            </div>
            <button
              onClick={() => setLinkedInModalOpen(true)}
              className="shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Manage
            </button>
          </div>

          {/* Knowledge base card */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100">
              <LuBook className="h-6 w-6 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-gray-900">Knowledge base</span>
              <p className="mt-0.5 text-sm text-gray-500">
                Websites, profiles &amp; documents the agent writes from
              </p>
            </div>
            <button
              onClick={() => setKnowledgeModalOpen(true)}
              className="shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      <LinkedInManageModal
        isOpen={linkedInModalOpen}
        onClose={() => setLinkedInModalOpen(false)}
        account={account}
        onConnect={handleConnect}
        isConnecting={isConnecting}
        onDisconnect={handleDisconnect}
        isDisconnecting={isDisconnecting}
      />

      <KnowledgeBaseModal
        isOpen={knowledgeModalOpen}
        onClose={() => setKnowledgeModalOpen(false)}
      />
    </div>
  );
}
