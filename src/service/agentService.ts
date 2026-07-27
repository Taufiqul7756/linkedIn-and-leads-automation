import { get, postRaw } from "@/lib/api";
import { LinkedInProfile, MarketingPlan, GenerateFromPlanBody } from "@/types/Agent";

export const agentService = (workspaceId: string) => ({
  // Phase A — LinkedIn Profile
  getProfiles: () =>
    get<{ results: LinkedInProfile[] }>(`/workspaces/${workspaceId}/linkedin/profiles/`),
  createProfile: (url: string) =>
    postRaw<LinkedInProfile>(`/workspaces/${workspaceId}/linkedin/profiles/`, { url }),
  getProfile: (id: string) =>
    get<LinkedInProfile>(`/workspaces/${workspaceId}/linkedin/profiles/${id}/`),
  refetchProfile: (id: string) =>
    postRaw<LinkedInProfile>(`/workspaces/${workspaceId}/linkedin/profiles/${id}/refetch/`),

  // Phase B — Marketing Plans
  generatePlans: () =>
    postRaw<MarketingPlan[] | { results: MarketingPlan[] }>(
      `/workspaces/${workspaceId}/content/plans/`
    ),

  // Phase C — Generate from plan
  generateFromPlan: (planId: string, body: GenerateFromPlanBody) =>
    postRaw(`/workspaces/${workspaceId}/content/plans/${planId}/generate/`, body),
});
