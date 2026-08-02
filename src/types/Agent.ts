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
  linkedin_profile: string;
  title: string;
  angle: string;
  target_audience: string;
  rationale: string;
  pillars: string[];
  sample_hooks: string[];
  cadence: string;
  created_at: string;
};
