export type PlanningBrief = {
  id: string;
  target_audience: string | null;
  region: string | null; // IANA timezone e.g. "Europe/Berlin"
  days: number;
};

export type LinkedInProfile = {
  id: string;
  profile_url: string;
  status: string;
  facets: {
    topics?: string[];
    summary?: string;
    brand_tone?: string;
    value_props?: string[];
  } | null;
  knowledge_items?: { text: string; topic: string; source: string }[];
  posts_count?: number;
  error: string;
  created_at: string;
};

export type ProfileDocument = {
  id: string;
  file: string;
  filename: string;
  purpose: string;
  status: string;
  num_pages: number;
  summary: string;
  guide: string;
  facets: string;
  error: string;
  created_at: string;
};

export type ProfileWebsite = {
  id: string;
  url: string;
  kind: string;
  purpose: string;
  status: string;
  summary: string;
  facets: string;
  error: string;
  created_at: string;
};

export type MarketingPlan = {
  id: string;
  batch: string;
  brief: PlanningBrief | null;
  linkedin_profile: string | null;
  title: string;
  angle: string;
  target_audience: string;
  rationale: string;
  pillars: string[];
  sample_hooks: string[];
  cadence: string;
  created_at: string;
};

export type PaginatedPlans = {
  count: number;
  next: string | null;
  previous: string | null;
  results: MarketingPlan[];
};

export type HeadlinesRequest = {
  count?: number;
  exclude?: string[];
};

export type HeadlinesResponse = {
  headlines: string[];
};

export type GenerateFromPlanRequest = {
  count?: number;
  headlines?: string[];
  tone?: string;
  length?: string;
  use_emoji?: boolean;
  use_ai_image?: boolean;
  writer_model?: string;
  tone_document?: string;
  style_document?: string;
  tone_text?: string;
  style_text?: string;
};
