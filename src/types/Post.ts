export type PostStatsType = {
  drafts: number | null;
  approved: number | null;
  scheduled: number | null;
  published: number | null;
  failed: number | null;
  published_this_week: number | null;
  next_scheduled_at: string | null;
  avg_engagement: number | null;
};

export type PostEngagement = {
  impressions: number;
  likes: number;
  comments: number;
  rate: number;
  synced_at: string;
};

export type PostType = {
  id: string;
  website_profile: string;
  prompt: string;
  tone: string;
  length: string;
  content_style: string;
  body: string;
  hashtags: string | string[];
  cta: string;
  image_query: string;
  image_url: string;
  image_file: null | string;
  image_status: string;
  scope: "corporate" | "personal";
  status: "draft" | "approved" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  published_at: string | null;
  linkedin_urn: string;
  engagement: PostEngagement;
  created_at: string;
};

export type PaginatedPosts = {
  count: number;
  next: string | null;
  previous: string | null;
  results: PostType[];
};

export type GeneratePostsBody = {
  url?: string;
  prompt: string;
  tone: string;
  length: string;
  content_style: string;
  use_emoji: boolean;
  use_ai_image: boolean;
  count: number;
  writer_model?: string;
};

export type GeneratePostsResponse = {
  id: string;
  url: string;
  status: string;
  title: string;
  summary: string;
  knowledge_items: string;
  error: string;
  created_at: string;
};

export type RegeneratePostBody = {
  instruction: string;
  tone: string;
  length: string;
  content_style: string;
  use_emoji: boolean;
};

export type SuggestPromptsBody = {
  website_profile: string;
};

export type SuggestPromptsResponse = {
  prompts: string[];
};
