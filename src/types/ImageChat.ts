export type GeneratedImage = {
  id: string;
  status: "pending" | "ready" | "failed";
  url: string;
  prompt: string;
  is_base: boolean;
  kind: "edit" | "new";
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
