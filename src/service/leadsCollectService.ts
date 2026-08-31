import { leadsGet, leadsPost, leadsPostForm } from "@/lib/leadsApi";
import type {
  LeadsSearchResponse,
  CreditsResponse,
  LeadsListResponse,
  ImportCsvResponse,
  EnrichResponse,
} from "@/types/LeadsCollect";

export const leadsCollectService = () => ({
  searchLeads: (params: Record<string, string>) =>
    leadsGet<LeadsSearchResponse>("/search/", params),

  enrichLead: (externalId: string) => leadsPost<EnrichResponse>(`/${externalId}/enrich/`),

  getCredits: () => leadsGet<CreditsResponse>("/credits/"),

  getLists: () => leadsGet<LeadsListResponse>("/lists/"),

  addToList: (listId: string, leadIds: string[]) =>
    leadsPost<void>(`/lists/${listId}/add/`, { lead_ids: leadIds }),

  createList: (name: string) => leadsPost<{ id: string; name: string }>("/lists/", { name }),

  importCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return leadsPostForm<ImportCsvResponse>("/import-csv/", form);
  },
});
