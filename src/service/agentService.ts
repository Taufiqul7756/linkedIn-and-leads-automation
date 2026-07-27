import { get, postRaw, del } from "@/lib/api";
import { LinkedInProfile, MarketingPlan } from "@/types/Agent";

export const agentService = (workspaceId: string) => ({
  // Phase A — LinkedIn Profile
  getProfiles: () =>
    get<{ results: LinkedInProfile[] }>(`/workspaces/${workspaceId}/linkedin/profiles/`),
  createProfile: (url: string) =>
    postRaw<LinkedInProfile>(`/workspaces/${workspaceId}/linkedin/profiles/`, {
      profile_url: url,
    }),
  getProfile: (id: string) =>
    get<LinkedInProfile>(`/workspaces/${workspaceId}/linkedin/profiles/${id}/`),
  refetchProfile: (id: string) =>
    postRaw<LinkedInProfile>(`/workspaces/${workspaceId}/linkedin/profiles/${id}/refetch/`),
  deleteProfile: (id: string) => del<void>(`/workspaces/${workspaceId}/linkedin/profiles/${id}/`),

  // Phase B — Marketing Plans
  generatePlans: () =>
    postRaw<MarketingPlan[] | { results: MarketingPlan[] }>(
      `/workspaces/${workspaceId}/content/plans/`
    ),

  // Phase C — Generate from plan (all params optional — backend uses its own defaults)
  generateFromPlan: (planId: string) =>
    postRaw(`/workspaces/${workspaceId}/content/plans/${planId}/generate/`),
});
