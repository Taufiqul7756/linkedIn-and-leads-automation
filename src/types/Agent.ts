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
  title: string;
  description: string;
  themes: string[];
  created_at: string;
};

export type GenerateFromPlanBody = {
  count: number;
  tone: string;
  length: string;
  use_emoji: boolean;
  use_ai_image: boolean;
};
