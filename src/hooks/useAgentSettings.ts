import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { linkedinAgentService } from "@/service/linkedinAgentService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { AgentSettings, KnowledgeSwitch, VoiceSwitch } from "@/types/LinkedInAgent";

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
      // Keep knowledge / voice switch statuses fresh while a source is still extracting / crawling
      refetchInterval: (q) =>
        [...(q.state.data?.knowledge ?? []), ...(q.state.data?.tone_and_style ?? [])].some(
          (s) => s.status !== "ready" && s.status !== "failed"
        )
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

  // Flip one source's switch in `knowledge` or `tone_and_style` — the PATCH carries only that switch;
  // the cache updates only that item (so concurrent flips on other sources are never overwritten)
  const flipSwitch = useCallback(
    async (
      list: "knowledge" | "tone_and_style",
      item: { id: string; kind: string },
      enabled: boolean
    ): Promise<boolean> => {
      const key = agentSettingsQueryKey(workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const setItem = (value: boolean) =>
        queryClient.setQueryData<AgentSettings>(key, (old) => {
          if (!old) return old;
          const match = (s: { id: string; kind: string }) =>
            s.id === item.id && s.kind === item.kind;
          return list === "knowledge"
            ? {
                ...old,
                knowledge: (old.knowledge ?? []).map((s) =>
                  match(s) ? { ...s, enabled: value } : s
                ),
              }
            : {
                ...old,
                tone_and_style: (old.tone_and_style ?? []).map((s) =>
                  match(s) ? { ...s, enabled: value } : s
                ),
              };
        });
      setItem(enabled);
      setSaving(true);
      try {
        await linkedinAgentService(workspaceId).patchSettings(
          list === "knowledge"
            ? { knowledge: [{ kind: item.kind as KnowledgeSwitch["kind"], id: item.id, enabled }] }
            : { tone_and_style: [{ kind: item.kind as VoiceSwitch["kind"], id: item.id, enabled }] }
        );
        return true;
      } catch (err) {
        setItem(!enabled);
        // 400 { knowledge | tone_and_style: ["No pdf … source … in this workspace."] }
        const first = axios.isAxiosError(err)
          ? (err.response?.data as Record<string, unknown[] | undefined> | undefined)?.[list]?.[0]
          : undefined;
        toast.error(
          typeof first === "string"
            ? first
            : extractErrorMessage(err) ||
                (list === "knowledge"
                  ? "Failed to update knowledge source."
                  : "Failed to update tone / style source.")
        );
        return false;
      } finally {
        setSaving(false);
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient, workspaceId]
  );

  const setKnowledgeEnabled = useCallback(
    (item: KnowledgeSwitch, enabled: boolean) => flipSwitch("knowledge", item, enabled),
    [flipSwitch]
  );
  // Tone / style — several can be on at once
  const setVoiceEnabled = useCallback(
    (item: VoiceSwitch, enabled: boolean) => flipSwitch("tone_and_style", item, enabled),
    [flipSwitch]
  );

  return {
    settings,
    settingsLoaded: isFetched,
    saving,
    saveSettings,
    setKnowledgeEnabled,
    setVoiceEnabled,
    queryKey,
  };
}
