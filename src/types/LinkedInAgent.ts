export type ConversationStatus =
  "draft" | "running" | "awaiting_input" | "completed" | "failed" | "cancelled" | "archived";

export type MessageKind = "text" | "posts" | "edit" | "error";
export type MessageRole = "user" | "agent";
export type QuestionKind = "choice" | "number" | "text";

export interface Question {
  id: string;
  question: string;
  kind: QuestionKind;
  options?: string[];
  default?: string | number;
  allow_free_text?: boolean;
  min?: number;
  max?: number;
  suggested_topics?: string[];
  url?: string;
}

export interface PendingInterrupt {
  id: string;
  kind: "questions" | "headlines" | string;
  questions?: Question[];
  headlines?: string[];
}

export interface Message {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Attachment {
  id: string;
  kind: "pdf" | "url";
  url: string;
  url_kind: "site" | "page" | "profile" | "";
  label: string;
  status: "pending" | "ready" | "failed";
  error: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  status: ConversationStatus;
  intent: string;
  grounding: string;
  title: string;
  messages: Message[];
  pending_interrupt: PendingInterrupt | Record<string, never>;
  artifacts: { post_ids: string[] };
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface ConversationListItem {
  id: string;
  status: ConversationStatus;
  intent: string;
  grounding: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedConversations {
  count: number;
  next: string | null;
  previous: string | null;
  results: ConversationListItem[];
}

export interface AgentSettings {
  post_count: number;
  use_hashtags: boolean;
  use_emoji: boolean;
  use_knowledge: boolean;
  use_ai_image: boolean;
  ignore_headline: boolean;
  ignore_grilling: boolean;
}

export interface SpanNode {
  text: string;
  bold?: boolean;
}

export interface ParagraphBlock {
  type: "paragraph";
  spans: SpanNode[];
}

export interface ListBlock {
  type: "list";
  marker: "-" | "*" | "•" | "→";
  tight: boolean;
  items: { spans: SpanNode[] }[];
}

export type BlockNode = ParagraphBlock | ListBlock;

export interface AgentPost {
  id: string;
  state: "agent" | "manual";
  plan: string | null;
  reference_link: string | null;
  tone: string;
  length: string;
  use_emoji: boolean;
  use_knowledge: boolean;
  length_hint: string;
  writer_model: string;
  headline: string;
  body: string;
  body_blocks: object | string;
  hashtags: string;
  cta: string | null;
  image_url: string;
  image_file: string | null;
  image_status: string;
  video_url: string;
  video_file: string | null;
  media_type: string;
  status: string;
  scheduled_at: string | null;
  suggested_publish_at: string | null;
  published_at: string | null;
  linkedin_urn: string;
  created_at: string;
}

export interface PaginatedAgentPosts {
  count: number;
  next: string | null;
  previous: string | null;
  results: AgentPost[];
}
