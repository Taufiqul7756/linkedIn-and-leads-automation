import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { imageChatService } from "@/service/imageChatService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type {
  ImageKnowledgeSource,
  ImageKnowledgeSwitch,
  WorkspaceImageSettings,
} from "@/types/ImageChat";

// GET image-chats/settings/ (workspace) — the switch list for the Image agent settings popover
export const imageKnowledgeSettingsKey = (workspaceId: string) => [
  "image-knowledge-settings",
  workspaceId,
];
// GET image-chats/knowledge/ — full sources (filename, url, text, error) for the modal + popover rows
export const imageKnowledgeListKey = (workspaceId: string) => ["image-knowledge", workspaceId];

const hasPending = (items: { status: string }[] | undefined) =>
  (items ?? []).some((s) => s.status === "pending");

/** Full image knowledge sources, oldest first. Polls every 3s while any source is `pending`. */
export function useImageKnowledgeList(workspaceId: string, enabled = true) {
  const { data, isLoading } = useQueryWithTokenRefresh(
    imageKnowledgeListKey(workspaceId),
    () => imageChatService(workspaceId).listImageKnowledge(),
    {
      enabled: !!workspaceId && enabled,
      refetchInterval: (q) => (hasPending(q.state.data) ? 3000 : false),
    }
  );
  return { sources: (data ?? []) as ImageKnowledgeSource[], isLoading };
}

/**
 * Image knowledge switches (workspace-wide). Toggle = flip only that row in the cache →
 * PATCH → replace the list with the response (the backend decides which others stay on).
 */
export function useImageKnowledgeSwitches(workspaceId: string, enabled = true) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQueryWithTokenRefresh(
    imageKnowledgeSettingsKey(workspaceId),
    () => imageChatService(workspaceId).getWorkspaceSettings(),
    {
      enabled: !!workspaceId && enabled,
      refetchInterval: (q) => (hasPending(q.state.data?.image_knowledge) ? 3000 : false),
    }
  );
  const switches: ImageKnowledgeSwitch[] = data?.image_knowledge ?? [];

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      const key = imageKnowledgeSettingsKey(workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WorkspaceImageSettings>(key);
      queryClient.setQueryData<WorkspaceImageSettings>(key, (old) =>
        old
          ? {
              ...old,
              image_knowledge: old.image_knowledge.map((s) =>
                s.id === id ? { ...s, enabled } : s
              ),
            }
          : old
      );
      try {
        const res = await imageChatService(workspaceId).toggleImageKnowledge(id, enabled);
        queryClient.setQueryData<WorkspaceImageSettings>(key, res);
        // Keep the modal list's `enabled` flags in step
        queryClient.invalidateQueries({ queryKey: imageKnowledgeListKey(workspaceId) });
      } catch (err) {
        if (previous) queryClient.setQueryData(key, previous);
        toast.error(extractErrorMessage(err));
      }
    },
    [queryClient, workspaceId]
  );

  return { switches, isLoading, toggle };
}

/** After add / rename / delete — refresh both the modal list and the popover switches. */
export function refreshImageKnowledge(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string
) {
  queryClient.invalidateQueries({ queryKey: imageKnowledgeListKey(workspaceId) });
  queryClient.invalidateQueries({ queryKey: imageKnowledgeSettingsKey(workspaceId) });
}
