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
  state: "agent" | "manual";
  plan: string | null;
  website_profile: string | null;
  reference_link: string | null;
  tone_document: string | null;
  style_document: string | null;
  tone_text: string;
  style_text: string;
  prompt?: string;
  tone: string;
  length: string;
  content_style: string;
  use_emoji: boolean;
  writer_model: string;
  headline: string | null;
  body: string;
  hashtags: string | string[];
  cta: string | null;
  image_query: string;
  image_url: string;
  image_file: null | string;
  image_status: string;
  video_url: string;
  video_file: null | string;
  media_type: string;
  scope?: "corporate" | "personal";
  status: "draft" | "approved" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  suggested_publish_at: string | null;
  published_at: string | null;
  linkedin_urn: string;
  engagement: PostEngagement | null;
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
  documents?: string[];
  tone_document?: string;
  style_document?: string;
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
  instruction?: string;
  mode?: "rewrite" | "extend";
};

export type SuggestPromptsBody = {
  website_profile: string;
};

export type SuggestPromptsResponse = {
  prompts: string[];
};
