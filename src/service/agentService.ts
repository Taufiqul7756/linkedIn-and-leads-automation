import { get, patch, postRaw, del } from "@/lib/api";
import { LinkedInProfile, MarketingPlan, ProfileDocument, ProfileWebsite } from "@/types/Agent";

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

  // Agent — Documents
  getAgentDocuments: () =>
    get<{ results: ProfileDocument[] }>(`/workspaces/${workspaceId}/linkedin/agent/documents/`),
  uploadAgentDocument: (file: File, purpose = "knowledge") => {
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    return postRaw<ProfileDocument>(`/workspaces/${workspaceId}/linkedin/agent/documents/`, form);
  },
  deleteAgentDocument: (docId: string) =>
    del<void>(`/workspaces/${workspaceId}/linkedin/agent/documents/${docId}/`),
  reextractAgentDocument: (docId: string) =>
    postRaw<ProfileDocument>(
      `/workspaces/${workspaceId}/linkedin/agent/documents/${docId}/reextract/`
    ),

  // Agent — Websites
  getAgentWebsites: () =>
    get<{ results: ProfileWebsite[] }>(`/workspaces/${workspaceId}/linkedin/agent/websites/`),
  addAgentWebsite: (url: string, purpose = "knowledge") =>
    postRaw<ProfileWebsite>(`/workspaces/${workspaceId}/linkedin/agent/websites/`, {
      url,
      purpose,
    }),
  getAgentWebsite: (id: string) =>
    get<ProfileWebsite>(`/workspaces/${workspaceId}/linkedin/agent/websites/${id}/`),
  deleteAgentWebsite: (id: string) =>
    del<void>(`/workspaces/${workspaceId}/linkedin/agent/websites/${id}/`),
  recrawlAgentWebsite: (id: string) =>
    postRaw<ProfileWebsite>(`/workspaces/${workspaceId}/linkedin/agent/websites/${id}/recrawl/`),

  // Phase B — Marketing Plans
  generatePlans: (body: {
    target_audience?: string;
    region?: string;
    days?: number;
    writer_model?: string;
  }) =>
    postRaw<MarketingPlan[] | { results: MarketingPlan[] } | MarketingPlan>(
      `/workspaces/${workspaceId}/content/plans/`,
      body
    ),

  updatePlan: (planId: string, data: Partial<MarketingPlan>) =>
    patch<MarketingPlan>(`/workspaces/${workspaceId}/content/plans/${planId}/`, data),

  // Phase B2 — Headlines
  getHeadlines: (planId: string, req: { count?: number; exclude?: string[] }) =>
    postRaw<{ headlines: string[] }>(
      `/workspaces/${workspaceId}/content/plans/${planId}/headlines/`,
      req
    ),

  // Follow-up — continue an existing plan into a new chapter
  followUpPlan: (planId: string) =>
    postRaw<MarketingPlan[]>(`/workspaces/${workspaceId}/content/plans/${planId}/follow-up/`, {}),

  // Phase C — Generate from plan with selected headlines
  generateFromPlan: (
    planId: string,
    req: {
      headlines?: string[];
      writer_model?: string;
      tone?: string;
      length?: string;
      use_emoji?: boolean;
      use_ai_image?: boolean;
      tone_document?: string;
      style_document?: string;
    }
  ) => postRaw(`/workspaces/${workspaceId}/content/plans/${planId}/generate/`, req),
});
