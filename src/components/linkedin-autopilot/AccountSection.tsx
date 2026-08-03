"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FaLinkedinIn } from "react-icons/fa";
import { LuGlobe, LuUpload, LuRefreshCw } from "react-icons/lu";
import toast from "react-hot-toast";
import { linkedinService } from "@/service/linkedinService";
import { postsService } from "@/service/postsService";
import { websiteService } from "@/service/websiteService";
import { documentService } from "@/service/documentService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PostStatsType } from "@/types/Post";
import LinkedInManageModal from "./LinkedInManageModal";
import KnowledgeUploadModal from "./KnowledgeUploadModal";
import AgentModeSection from "./AgentModeSection";

function formatNextScheduled(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "—";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

function buildStatCards(stats: PostStatsType | undefined) {
  const pw = stats?.published_this_week ?? null;
  const eng = stats?.avg_engagement ?? null;
  return [
    { label: "drafts", value: stats?.drafts ?? "—", note: null, noteColor: "" },
    { label: "approved", value: stats?.approved ?? "—", note: null, noteColor: "" },
    { label: "scheduled", value: stats?.scheduled ?? "—", note: null, noteColor: "" },
    {
      label: "published",
      value: stats?.published ?? "—",
      note: pw != null ? `+${pw} this week` : null,
      noteColor: "green",
    },
    { label: "failed", value: stats?.failed ?? "—", note: null, noteColor: "" },
    { label: "published this week", value: pw ?? "—", note: null, noteColor: "" },
    {
      label: "next scheduled",
      value: formatNextScheduled(stats?.next_scheduled_at),
      note: null,
      noteColor: "",
    },
    {
      label: "avg. engagement",
      value: eng != null ? `${eng.toFixed(1)}%` : "—",
      note: null,
      noteColor: "",
    },
  ];
}

export default function AccountSection({ mode }: { mode: "agent" | "manual" }) {
  const [linkedInModalOpen, setLinkedInModalOpen] = useState(false);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Fetch live account status
  const { data: account, isLoading: accountLoading } = useQueryWithTokenRefresh(
    ["linkedin-account", workspaceId],
    () => linkedinService(workspaceId).getAccount(),
    { enabled: !!workspaceId }
  );

  // Handle OAuth callback — preserve ?mode= when cleaning up ?code= and ?state=
  const cleanOAuthParams = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("code");
    params.delete("state");
    const qs = params.toString();
    router.replace(`/linkedin-autopilot${qs ? `?${qs}` : ""}`);
  };

  useEffect(() => {
    if (!code || !state) return;
    const sessionKey = `linkedin_callback_${state}`;
    if (sessionStorage.getItem(sessionKey)) {
      cleanOAuthParams();
      return;
    }
    sessionStorage.setItem(sessionKey, "1");
    linkedinService(workspaceId)
      .handleCallback(code, state)
      .then((result) => {
        if (result) {
          // Invalidate by prefix — workspaceId may be "" at this point (stale closure on redirect)
          queryClient.invalidateQueries({ queryKey: ["linkedin-account"] });
          toast.success("LinkedIn account connected!");
        } else {
          toast.error("Failed to connect LinkedIn account.");
        }
      })
      .catch(() => toast.error("Failed to connect LinkedIn account."))
      .finally(() => cleanOAuthParams());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state]);

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

  // Fetch websites
  const { data: websites, isLoading: websitesLoading } = useQueryWithTokenRefresh(
    ["websites", workspaceId],
    () => websiteService(workspaceId).getWebsites(),
    {
      enabled: !!workspaceId,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        const isProcessing = results.some((w) => w.status === "pending" || w.status === "crawling");
        return isProcessing ? 4000 : false;
      },
    }
  );
  const website = websites?.results?.[0];

  // Fetch uploaded documents
  const { data: documents } = useQueryWithTokenRefresh(
    ["documents", workspaceId],
    () => documentService(workspaceId).getDocuments(),
    { enabled: !!workspaceId }
  );
  const docCount = documents?.results?.length ?? 0;

  // Fetch post stats scoped to the current mode (agent / manual)
  const { data: postStats } = useQueryWithTokenRefresh(
    ["post-stats", workspaceId, mode],
    () => postsService(workspaceId).getPostStats(mode),
    { enabled: !!workspaceId }
  );

  const recrawl = useMutationWithTokenRefresh(
    () => websiteService(workspaceId).recrawl(website!.id, website!.url),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
        toast.success("Re-crawl started!");
      },
      onError: () => toast.error("Failed to start re-crawl."),
    }
  );

  const websiteStatusBadge = () => {
    if (websitesLoading) return <span className="h-4 w-16 animate-pulse rounded bg-gray-200" />;
    if (!website) return null;
    if (website.status === "pending" || website.status === "crawling")
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          {website.status === "crawling" ? "Crawling" : "Indexing"}
        </span>
      );
    if (website.status === "error")
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-red-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
          Error
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
        Ready
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Account cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* LinkedIn account */}
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <FaLinkedinIn className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">LinkedIn account</span>
              {accountLoading ? (
                <span className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              ) : isConnected ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Not connected
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {accountLoading
                ? "Loading..."
                : isConnected
                  ? `${account?.name} · authorized via OAuth · publish enabled`
                  : "Connect your LinkedIn to start publishing"}
            </p>
          </div>
          <button
            onClick={() => setLinkedInModalOpen(true)}
            className="shrink-0 rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Manage
          </button>
        </div>

        {/* Knowledge base (manual) or Agent Mode (agent) */}
        {mode === "agent" ? (
          <AgentModeSection />
        ) : (
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
              <LuGlobe className="h-5 w-5 text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Knowledge base</span>
                {websiteStatusBadge()}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {websitesLoading ? (
                  "Loading..."
                ) : website ? (
                  <>
                    <span className="text-blue-600">{website.url}</span>
                    {docCount > 0 && (
                      <span className="ml-2 text-gray-400">
                        · {docCount} document{docCount > 1 ? "s" : ""} uploaded
                      </span>
                    )}
                  </>
                ) : docCount > 0 ? (
                  <span className="text-violet-600">
                    {docCount} document{docCount > 1 ? "s" : ""} uploaded
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={() => setSourcesModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LuUpload className="h-3.5 w-3.5" />
                Add sources
              </button>
              <button
                onClick={() => recrawl.mutate(undefined)}
                disabled={
                  !website ||
                  recrawl.isPending ||
                  website?.status === "crawling" ||
                  website?.status === "pending"
                }
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                <LuRefreshCw
                  className={`h-3.5 w-3.5 ${
                    recrawl.isPending ||
                    website?.status === "crawling" ||
                    website?.status === "pending"
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Re-crawl
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid — 2 rows × 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {buildStatCards(postStats).map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            {stat.note && (
              <p
                className={
                  stat.noteColor === "green"
                    ? "mt-0.5 text-xs font-medium text-green-600"
                    : "mt-0.5 text-xs text-gray-500"
                }
              >
                {stat.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      <LinkedInManageModal
        isOpen={linkedInModalOpen}
        onClose={() => setLinkedInModalOpen(false)}
        account={account}
        onConnect={handleConnect}
        isConnecting={isConnecting}
        onDisconnect={handleDisconnect}
        isDisconnecting={isDisconnecting}
      />
      <KnowledgeUploadModal isOpen={sourcesModalOpen} onClose={() => setSourcesModalOpen(false)} />
    </div>
  );
}
