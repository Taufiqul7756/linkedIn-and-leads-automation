import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { AgentSettings, KnowledgeSwitch } from "@/types/LinkedInAgent";

// Shown until GET agent/settings/ resolves
export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  post_count: 5,
  use_hashtags: true,
  use_emoji: false,
  use_ai_image: true,
  ignore_headline: false,
  ask_questions: true,
  use_post_length: false,
  post_length: "",
  use_target_audience: false,
  target_audience: "",
};

export const agentSettingsQueryKey = (workspaceId: string) => ["agent-settings", workspaceId];

/**
 * Agent composer settings, shared by the composer and the Knowledge base modal.
 * Save = optimistic cache write → PATCH → invalidate (GET stays the source of truth).
 */
export function useAgentSettings(workspaceId: string, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = agentSettingsQueryKey(workspaceId);
  const [saving, setSaving] = useState(false);

  const { data, isFetched } = useQueryWithTokenRefresh(
    queryKey,
    () => linkedinAgentService(workspaceId).getSettings(),
    {
      enabled: !!workspaceId && enabled,
      // Keep knowledge switch statuses fresh while a source is still extracting / crawling
      refetchInterval: (q) =>
        q.state.data?.knowledge?.some((k) => k.status !== "ready" && k.status !== "failed")
          ? 3000
          : false,
    }
  );
  const settings = data ?? DEFAULT_AGENT_SETTINGS;

  const saveSettings = useCallback(
    // `optimisticExtra` — cache-only fields that follow from the patch (e.g. ai_models.selected)
    async (patch: Partial<AgentSettings>, optimisticExtra: Partial<AgentSettings> = {}) => {
      const key = agentSettingsQueryKey(workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AgentSettings>(key);
      queryClient.setQueryData<AgentSettings>(key, (old) => ({
        ...(old ?? DEFAULT_AGENT_SETTINGS),
        ...patch,
        ...optimisticExtra,
      }));
      setSaving(true);
      try {
        await linkedinAgentService(workspaceId).patchSettings(patch);
        return true;
      } catch {
        // Roll back only the fields this save touched — a concurrent save keeps its value
        if (previous) {
          const touched = Object.keys({ ...patch, ...optimisticExtra }) as (keyof AgentSettings)[];
          const restore = Object.fromEntries(touched.map((k) => [k, previous[k]]));
          queryClient.setQueryData<AgentSettings>(key, (old) => ({
            ...(old ?? previous),
            ...restore,
          }));
        }
        toast.error("Failed to save settings.");
        return false;
      } finally {
        setSaving(false);
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient, workspaceId]
  );

  // Flip one knowledge source's switch — the PATCH carries only that switch; the cache
  // updates only that item (so concurrent flips on other sources are never overwritten)
  const setKnowledgeEnabled = useCallback(
    async (item: KnowledgeSwitch, enabled: boolean) => {
      const key = agentSettingsQueryKey(workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const setItem = (value: boolean) =>
        queryClient.setQueryData<AgentSettings>(key, (old) =>
          old
            ? {
                ...old,
                knowledge: (old.knowledge ?? []).map((k) =>
                  k.id === item.id && k.kind === item.kind ? { ...k, enabled: value } : k
                ),
              }
            : old
        );
      setItem(enabled);
      setSaving(true);
      try {
        await linkedinAgentService(workspaceId).patchSettings({
          knowledge: [{ kind: item.kind, id: item.id, enabled }],
        });
        return true;
      } catch (err) {
        setItem(!enabled);
        // 400 { knowledge: ["No pdf knowledge source … in this workspace."] }
        const first = axios.isAxiosError(err)
          ? (err.response?.data as { knowledge?: unknown[] } | undefined)?.knowledge?.[0]
          : undefined;
        toast.error(
          typeof first === "string"
            ? first
            : extractErrorMessage(err) || "Failed to update knowledge source."
        );
        return false;
      } finally {
        setSaving(false);
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient, workspaceId]
  );

  return {
    settings,
    settingsLoaded: isFetched,
    saving,
    saveSettings,
    setKnowledgeEnabled,
    queryKey,
  };
}
