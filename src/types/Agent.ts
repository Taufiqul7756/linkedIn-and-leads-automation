export type LinkedInProfile = {
  id: string;
  url: string;
  status: "pending" | "fetching" | "ready" | "error";
  name: string | null;
  headline: string | null;
  summary: string | null;
  error_message: string | null;
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
