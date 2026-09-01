export interface Lead {
  id?: number;
  external_id: string;
  source?: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  seniority: string | null;
  title: string | null;
  company_name: string | null;
  company_domain: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  linkedin_url: string | null;
  is_enriched: boolean;
  email: string | null;
  phone: string | null;
  enriched_at?: string | null;
  created_at?: string;
}

export interface LeadsSearchResponse {
  data: Lead[];
  count: number;
  page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

export interface CreditsResponse {
  data: {
    used: number;
    budget: number;
    remaining: number;
  };
}

export interface LeadList {
  id: string;
  name: string;
  lead_count: number;
}

export interface LeadsListResponse {
  results: LeadList[];
}

export interface ImportCsvResponse {
  imported: number;
}

export interface EnrichResponse {
  external_id: string;
  email: string | null;
  phone: string | null;
  is_enriched: boolean;
}

export interface SearchParams {
  titles: string[];
  locations: string[];
  industries: string[];
  seniorities: string[];
  companySizes: CompanySizeOption[];
  page: number;
  perPage: number;
}

export interface CompanySizeOption {
  label: string;
  min: number;
  max: number | null;
}

export const SENIORITY_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
  { value: "intern", label: "Intern" },
];

export const COMPANY_SIZE_OPTIONS: CompanySizeOption[] = [
  { label: "1-10", min: 1, max: 10 },
  { label: "11-50", min: 11, max: 50 },
  { label: "51-200", min: 51, max: 200 },
  { label: "201-500", min: 201, max: 500 },
  { label: "501-1000", min: 501, max: 1000 },
  { label: "1001-5000", min: 1001, max: 5000 },
  { label: "5001-10000", min: 5001, max: 10000 },
  { label: "10000+", min: 10001, max: null },
];
