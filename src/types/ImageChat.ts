export type GeneratedImage = {
  id: string;
  status: "pending" | "ready" | "failed";
  url: string;
  prompt: string;
  is_base: boolean;
  is_added_on_post: boolean;
  kind: "edit" | "new" | "stock"; // unknown kinds render as a normal picture card
  source: string | null;
  error: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  image: GeneratedImage | null;
  created_at: string;
};

export type ImageChat = {
  id: string;
  post: string;
  post_image_url: string;
  post_media_type: "image" | "video" | "none";
  status: "running" | "ready";
  messages: ChatMessage[];
  images: GeneratedImage[];
  created_at: string;
  updated_at: string;
};

export type ImageRatioOption = {
  is_active: boolean;
  title: string;
  size: string;
  ratio: string;
  image: string;
};

export type ImageModelOption = {
  is_active: boolean;
  title: string;
  model_name: string;
  image: string;
};

export type ImageStyleOption = {
  is_active: boolean;
  title: string; // "None" = no style applied
  description: string;
  image: string; // may be ""
};

// GET image-chats/settings/{chatId}/
export type ImageChatSettings = {
  use_post_body: boolean;
  image_ratio: ImageRatioOption[];
  ai_model: ImageModelOption[];
  image_style: ImageStyleOption[];
};

// Stock photos (Pexels) — every photo is landscape
export type StockPhoto = {
  id: number;
  alt: string; // may be ""
  photographer: string;
  width: number;
  height: number;
  thumbnail_url: string; // grid only
  url: string; // send this in PATCH posts/{id}/ { image_url }
  pexels_url: string;
};

// GET image-chats/{chatId}/stock/recommended/ — query "" + photos [] when the post has nothing to search for
export type StockRecommendedResponse = {
  query: string;
  photos: StockPhoto[];
};

// GET image-chats/{chatId}/stock/search/?q=&page=
export type StockSearchResponse = {
  query: string;
  page: number;
  has_more: boolean;
  photos: StockPhoto[];
};

// PATCH image-chats/settings/{chatId}/ — send only the changed field
export type ImageChatSettingsPatch = Partial<{
  use_post_body: boolean;
  image_ratio: string; // ImageRatioOption.ratio
  ai_model: string; // ImageModelOption.model_name
  image_style: string; // ImageStyleOption.title
}>;

// ─── Image Knowledge (brand guide for pictures) — workspace-wide ─────────────

export type ImageKnowledgeKind = "pdf" | "url" | "text";
export type ImageKnowledgeStatus = "pending" | "ready" | "failed";

// One row of image_knowledge in GET/PATCH image-chats/settings/ (workspace route, no chat id)
export type ImageKnowledgeSwitch = {
  id: string;
  kind: ImageKnowledgeKind;
  label: string; // the user's note, or ""
  name: string; // label, or else filename / URL
  status: ImageKnowledgeStatus;
  enabled: boolean;
};

// Full source — image-chats/knowledge/ routes
export type ImageKnowledgeSource = {
  id: string;
  kind: ImageKnowledgeKind;
  label: string; // the user's note (max 200 chars)
  name: string;
  filename: string; // PDF only, else ""
  url: string; // normalised (https://…), URL only, else ""
  text: string; // text only, else ""
  status: ImageKnowledgeStatus;
  enabled: boolean;
  error: string; // shown as is when status === "failed"
  created_at: string;
};

// GET image-chats/knowledge/?page= — 25 per page, oldest first
export type ImageKnowledgePage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ImageKnowledgeSource[];
};

// GET/PATCH image-chats/settings/ — workspace composer settings
export type WorkspaceImageSettings = {
  image_knowledge: ImageKnowledgeSwitch[];
};

// POST image-chats/knowledge/ (JSON) — exactly one of text / url; PDFs go multipart. Text has no note
export type ImageKnowledgeCreate = { text: string } | { url: string; label?: string };
