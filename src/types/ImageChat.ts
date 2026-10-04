export type GeneratedImage = {
  id: string;
  status: "pending" | "ready" | "failed";
  url: string;
  prompt: string;
  is_base: boolean;
  is_added_on_post: boolean;
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

// GET image-chats/settings/{chatId}/
export type ImageChatSettings = {
  use_post_body: boolean;
  image_ratio: ImageRatioOption[];
  ai_model: ImageModelOption[];
};

// PATCH image-chats/settings/{chatId}/ — send only the changed field
export type ImageChatSettingsPatch = Partial<{
  use_post_body: boolean;
  image_ratio: string; // ImageRatioOption.ratio
  ai_model: string; // ImageModelOption.model_name
}>;
