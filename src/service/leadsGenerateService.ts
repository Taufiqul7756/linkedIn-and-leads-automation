import leadsApi, { leadsGet, leadsPost } from "@/lib/leadsApi";
import type {
  GenerateRequest,
  GenerateResponse,
  GenerateLead,
  PreviewResponse,
  OrganizationDetail,
  OrganizationListResponse,
  EnrichLeadResponse,
} from "@/types/LeadsGenerate";

export const leadsGenerateService = () => ({
  // 120 s timeout — upstream chains company search → person search → bulk email reveal.
  // Response is wrapped: { data: { leads, credits_spent, ... } }
  // Credit values come back as strings ("1.5") — normalised to float here.
  // companies_only is NOT sent — the backend 500s when it receives that field.
  generate: (body: GenerateRequest) =>
    leadsApi.post("/generate/", body, { timeout: 120_000 }).then((res) => {
      const raw = ((res.data as { data?: unknown }).data ?? res.data) as Record<string, unknown>;
      return {
        ...raw,
        credits_spent: parseFloat(String(raw.credits_spent ?? "0")),
        credits_remaining: parseFloat(String(raw.credits_remaining ?? "0")),
        shortfall: parseFloat(String(raw.shortfall ?? "0")),
      } as GenerateResponse;
    }),

  preview: (body: GenerateRequest) => leadsPost<PreviewResponse>("/generate/preview/", body),

  listOrganizations: (params?: { search?: string; country?: string; industry?: string }) => {
    const p: Record<string, string> = {};
    if (params?.search) p.search = params.search;
    if (params?.country) p.country = params.country;
    if (params?.industry) p.industry = params.industry;
    return leadsGet<OrganizationListResponse>("/organizations/", p);
  },

  getOrganization: (id: string) => leadsGet<OrganizationDetail>(`/organizations/${id}/`),

  // POST /api/leads/{external_id}/enrich/ — enriches a single lead via the provider (Apollo)
  enrichLead: (externalId: string) =>
    leadsApi.post<EnrichLeadResponse>(`/${externalId}/enrich/`).then((res) => res.data),

  // POST /api/leads/mock-enrich/ — enriches partial leads via Claude/Gemini (no Apollo needed)
  mockEnrichLeads: (leads: GenerateLead[], model?: string) =>
    leadsPost<{ leads: GenerateLead[] }>("/mock-enrich/", { leads, model }),

  getCredits: () =>
    leadsGet<{ data: { used: number; budget: number; remaining: number } }>("/credits/"),
});
