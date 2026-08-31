import type { CompanySizeOption } from "@/types/LeadsCollect";

export type { CompanySizeOption };

export type EmailQuality = "verified" | "guessed";

// Kept for future use — not sent in the current simplified flow.
export { SENIORITY_OPTIONS } from "@/types/LeadsCollect";

export interface GenerateRequest {
  keywords: string[];
  locations: string[];
  employee_ranges: string[];
  target_count: number;
  min_email_status: EmailQuality;
  companies_only: boolean;
}

export interface GenerateLead {
  external_id: string;
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
  email: string | null;
  email_status: string;
  phone: string | null;
}

// Credit fields are guaranteed numbers here — the service normalises string values
// from the API ("1.5" → 1.5) before returning this type.
export interface GenerateResponse {
  leads: GenerateLead[];
  organizations?: Organization[];
  organizations_searched: number;
  people_found: number;
  enriched: number;
  credits_spent: number;
  shortfall: number;
  credits_remaining: number;
  companies_only?: boolean;
}

export interface PreviewCompany {
  name: string;
  domain: string | null;
  location: string | null;
  employee_count: number | null;
}

export interface PreviewResponse {
  companies: PreviewCompany[];
  organizations_found: number;
  people_found: number;
  estimated_credits: number;
}

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  location: string | null;
  phone: string | null;
  leads_count: number;
}

export interface OrganizationDetail extends Organization {
  leads: GenerateLead[];
}

export interface OrganizationListResponse {
  results: Organization[];
  count: number;
}

// Open-ended email status badge helper — never throws on unknown values.
export const EMAIL_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-green-100 text-green-700" },
  guessed: { label: "Guessed", className: "bg-amber-100 text-amber-700" },
};

export function getEmailStatusStyle(status: string): { label: string; className: string } {
  if (EMAIL_STATUS_STYLES[status]) return EMAIL_STATUS_STYLES[status];
  const label = status
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
  return { label: label || status, className: "bg-gray-100 text-gray-500" };
}

export function buildEmployeeRanges(sizes: CompanySizeOption[]): string[] {
  return sizes.map((s) => (s.max != null ? `${s.min},${s.max}` : `${s.min},`));
}
