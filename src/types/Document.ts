export type DocumentType = {
  id: string;
  file: string;
  scope: "corporate" | "personal";
  filename: string;
  purpose: "knowledge" | "tone" | "style";
  status: "pending" | "processing" | "extracting" | "ready" | "error";
  num_pages: number | null;
  summary: string;
  facets: Record<string, unknown> | string;
  error: string;
  created_at: string;
};

export type PaginatedDocuments = {
  count: number;
  next: string | null;
  previous: string | null;
  results: DocumentType[];
};
