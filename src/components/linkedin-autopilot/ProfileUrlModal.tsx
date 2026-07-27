"use client";
import { useState, useEffect, useRef } from "react";
import {
  LuLink,
  LuLoader,
  LuCheck,
  LuUser,
  LuTrash2,
  LuArrowRight,
  LuRefreshCw,
} from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { agentService } from "@/service/agentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { LinkedInProfile } from "@/types/Agent";

interface ProfileUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileUrlModal({ isOpen, onClose }: ProfileUrlModalProps) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LinkedInProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stopAllPolls = () => {
    Object.values(pollRefs.current).forEach(clearInterval);
    pollRefs.current = {};
  };

  const startPolling = (id: string) => {
    if (pollRefs.current[id]) return;
    pollRefs.current[id] = setInterval(async () => {
      const p = await agentService(workspaceId).getProfile(id);
      if (!p) return;
      setProfiles((prev) => prev.map((x) => (x.id === id ? p : x)));
      if (p.status === "ready" || p.status === "error") {
        clearInterval(pollRefs.current[id]);
        delete pollRefs.current[id];
      }
    }, 3000);
  };

  // Load profiles when modal opens
  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingList(true);
    agentService(workspaceId)
      .getProfiles()
      .then((data) => {
        const all = data?.results ?? [];
        setProfiles(all);
        all.forEach((p) => {
          if (p.status === "pending" || p.status === "fetching") startPolling(p.id);
        });
      })
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workspaceId]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopAllPolls();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl("");

      setDeleteTarget(null);

      setProfiles([]);
    }
  }, [isOpen]);

  useEffect(() => () => stopAllPolls(), []);

  const handleAdd = async () => {
    if (!url.trim() || adding) return;
    setAdding(true);
    try {
      const p = await agentService(workspaceId).createProfile(url.trim());
      setProfiles((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
      setUrl("");
      if (p.status !== "ready" && p.status !== "error") startPolling(p.id);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await agentService(workspaceId).deleteProfile(deleteTarget.id);
      clearInterval(pollRefs.current[deleteTarget.id]);
      delete pollRefs.current[deleteTarget.id];
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async (p: LinkedInProfile) => {
    try {
      const updated = await agentService(workspaceId).refetchProfile(p.id);
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      if (updated.status !== "ready" && updated.status !== "error") startPolling(updated.id);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Profile URL" width="md">
      <p className="mb-4 text-sm text-gray-500">
        Add your LinkedIn profile URL so Relay can personalise content to your voice and audience.
      </p>

      {/* Loading skeleton */}
      {loadingList && (
        <div className="mb-4 flex items-center gap-2 py-3 text-sm text-gray-400">
          <LuLoader className="h-4 w-4 animate-spin" />
          Loading profiles…
        </div>
      )}

      {/* Profile list */}
      {!loadingList && profiles.length > 0 && (
        <div className="mb-4 space-y-2">
          {profiles.map((p) => {
            const isPending = p.status === "pending" || p.status === "fetching";
            const isError = p.status === "error";
            const isReady = p.status === "ready";

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border px-4 py-3",
                  isReady
                    ? "border-teal-200 bg-teal-50"
                    : isError
                      ? "border-red-200 bg-red-50"
                      : "border-blue-200 bg-blue-50"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isReady ? "bg-teal-100" : isError ? "bg-red-100" : "bg-blue-100"
                    )}
                  >
                    {isPending ? (
                      <LuLoader className="h-4 w-4 animate-spin text-blue-500" />
                    ) : (
                      <LuUser
                        className={cn("h-4 w-4", isReady ? "text-teal-600" : "text-red-500")}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-blue-600">{p.url}</p>
                    {isReady && p.name && (
                      <p className="text-xs font-medium text-gray-700">{p.name}</p>
                    )}
                    {isReady && p.headline && (
                      <p className="truncate text-xs text-gray-400">{p.headline}</p>
                    )}
                    {isPending && (
                      <p className="text-xs text-blue-500">
                        {p.status === "fetching" ? "Fetching profile…" : "Processing…"}
                      </p>
                    )}
                    {isError && (
                      <p className="text-xs text-red-500">{p.error_message ?? "Fetch failed."}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isReady && <LuCheck className="h-4 w-4 text-teal-500" strokeWidth={2.5} />}
                    {isError && (
                      <button
                        onClick={() => handleRetry(p)}
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LuRefreshCw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                    {!deleteTarget && (
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LuTrash2 className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline delete confirm */}
                {deleteTarget?.id === p.id && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                    <p className="text-xs font-medium text-red-700">
                      Remove <span className="font-semibold">{p.name || p.url}</span>?
                    </p>
                    <p className="mt-0.5 text-[11px] text-red-400">This action cannot be undone.</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => setDeleteTarget(null)}
                        disabled={isDeleting}
                        className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <LuLoader className="h-3 w-3 animate-spin" />
                        ) : (
                          <LuTrash2 className="h-3 w-3" />
                        )}
                        {isDeleting ? "Removing…" : "Yes, remove"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loadingList && profiles.length === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-gray-200 py-8 text-center">
          <LuUser className="mx-auto mb-2 h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-400">No profiles added yet.</p>
        </div>
      )}

      {/* Add URL */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          {profiles.length > 0 ? "Add another profile URL" : "LinkedIn Profile URL"}
        </label>
        <div className="relative">
          <LuLink className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="url"
            placeholder="https://www.linkedin.com/in/yourname"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Close
        </button>
        <button
          onClick={handleAdd}
          disabled={!url.trim() || adding}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? (
            <LuLoader className="h-4 w-4 animate-spin" />
          ) : (
            <LuArrowRight className="h-4 w-4" />
          )}
          {adding ? "Adding…" : "Add Profile"}
        </button>
      </div>
    </Modal>
  );
}
