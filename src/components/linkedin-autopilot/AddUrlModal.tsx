"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LuLink, LuTrash2, LuGlobe, LuLoader } from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { websiteService } from "@/service/websiteService";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { cn } from "@/utils/cn";
import type { WebsiteType } from "@/types/Website";

interface AddUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function WebsiteStatusDot({ status }: { status: WebsiteType["status"] }) {
  const colors: Record<WebsiteType["status"], string> = {
    ready: "bg-green-500",
    crawling: "bg-amber-400",
    pending: "bg-gray-300",
    error: "bg-red-400",
    failed: "bg-red-400",
  };
  return (
    <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", colors[status] ?? "bg-gray-300")} />
  );
}

export default function AddUrlModal({ isOpen, onClose }: AddUrlModalProps) {
  const [url, setUrl] = useState("");
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const { data: websitesData, isLoading: websitesLoading } = useQueryWithTokenRefresh(
    ["websites", workspaceId],
    () => websiteService(workspaceId).getWebsites(),
    { enabled: isOpen && !!workspaceId }
  );

  const existingUrls = websitesData?.results ?? [];

  const addWebsite = useMutationWithTokenRefresh(
    (websiteUrl: string) => websiteService(workspaceId).addWebsite(websiteUrl),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
        toast.success("Website added! Indexing in progress.");
        setUrl("");
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error) || "Failed to add website.");
      },
    }
  );

  const deleteWebsite = useMutationWithTokenRefresh(
    (id: string) => websiteService(workspaceId).deleteWebsite(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
        toast.success("Website removed.");
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error) || "Failed to remove website.");
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    addWebsite.mutate(trimmed);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Website URL" width="md">
      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Website URL</label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <LuLink className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                required
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              We&apos;ll crawl this URL to build your knowledge base.
            </p>
          </div>
          <button
            type="submit"
            disabled={addWebsite.isPending || !url.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {addWebsite.isPending ? "Adding…" : "Add Website"}
          </button>
        </form>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Indexed websites
            {websitesData?.count ? (
              <span className="ml-1.5 font-normal normal-case text-gray-400">
                ({websitesData.count})
              </span>
            ) : null}
          </label>

          {websitesLoading ? (
            <div className="flex items-center justify-center py-6">
              <LuLoader className="h-4 w-4 animate-spin text-gray-300" />
            </div>
          ) : existingUrls.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">No websites added yet.</p>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto">
              {existingUrls.map((site) => (
                <li
                  key={site.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
                >
                  <LuGlobe className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-medium text-gray-700">{site.url}</span>
                    <div className="flex items-center gap-1.5">
                      <WebsiteStatusDot status={site.status} />
                      <span className="text-xs capitalize text-gray-400">{site.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteWebsite.mutate(site.id)}
                    disabled={deleteWebsite.isPending}
                    className="ml-1 shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-40"
                    title="Remove website"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
