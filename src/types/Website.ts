export type WebsiteStatus = "pending" | "crawling" | "ready" | "error" | "failed";

export type WebsiteType = {
  id: string;
  url: string;
  kind: string;
  is_default: boolean;
  status: WebsiteStatus;
  summary: string;
  facets: string;
  error: string;
  created_at: string;
};

export type PaginatedWebsites = {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebsiteType[];
};
