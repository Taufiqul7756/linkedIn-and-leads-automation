export type ConversationStatus =
  "draft" | "running" | "awaiting_input" | "completed" | "failed" | "cancelled" | "archived";

export type MessageKind = "text" | "posts" | "edit" | "error" | "findings";
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
  can_generate_more?: boolean; // headlines round: show "Suggest more headlines"
  can_skip?: boolean;
}

// answers payload for POST conversations/{id}/answer/
export type InterruptAnswers = Record<string, string | string[] | boolean>;

export interface Finding {
  title: string;
  summary: string;
  url: string;
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
  has_multiple_post: boolean;
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
  use_ai_image: boolean;
  ignore_headline: boolean;
  // No longer returned by GET settings/ — kept optional for older payloads
  ignore_grilling?: boolean;
  // Per-source knowledge switches (replaces the removed use_knowledge) — oldest first
  knowledge?: KnowledgeSwitch[];
  // Tone / style switches (story #4025) — never overlaps with `knowledge`
  tone_and_style?: VoiceSwitch[];
  ask_questions: boolean;
  use_post_length: boolean;
  // "100 words" | "200 words" | "300 words" | "" (let the agent decide)
  post_length: string;
  use_target_audience: boolean;
  target_audience: string;
  // Selected writer model — PATCH { writer_model: "<model_id>" } to change it
  writer_model?: string;
  // Read-only: available writer models grouped by provider (anthropic, deepseek, gemini, …)
  ai_models?: Record<string, AgentModelOption[]>;
}

export type KnowledgeKind = "pdf" | "website" | "linkedin";

// One knowledge source in GET settings/ → knowledge[]. Tone/style references are never listed.
export interface KnowledgeSwitch {
  id: string;
  kind: KnowledgeKind;
  label: string; // note for the agent ("Use this for article making"); "" = none
  name: string; // file name, URL or profile URL
  // "ready" | "failed" | in progress: "pending" | "extracting" | "crawling" | "fetching"
  status: string;
  enabled: boolean;
}

// PATCH settings/ body — knowledge carries only the switches that changed
// One tone / style source in GET settings/ → tone_and_style[]. Several can be on at once.
export interface VoiceSwitch {
  id: string;
  kind: "pdf" | "website";
  purpose?: "tone" | "style"; // in the spec, not sent by the backend yet
  label: string; // note for the agent; "" = none
  name: string; // file name or URL
  // "ready" | "failed" | in progress: "pending" | "extracting" | "crawling"
  status: string;
  enabled: boolean;
}

export type AgentSettingsPatch = Omit<Partial<AgentSettings>, "knowledge" | "tone_and_style"> & {
  knowledge?: Pick<KnowledgeSwitch, "kind" | "id" | "enabled">[];
  tone_and_style?: Pick<VoiceSwitch, "kind" | "id" | "enabled">[];
};

export interface AgentModelOption {
  model_id: string;
  label: string;
  selected: boolean;
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
  conversation_id: string | null;
  single_post_conversation_id: string | null;
  // Version number the post's content matches right now — see PostVersion
  current_version?: number;
  created_at: string;
}

// One saved snapshot of a post's CONTENT (no status / schedule time — read those from the live post).
// GET posts/{postId}/versions/{n}/ — immutable except image_status filling in while "pending".
export interface PostVersion {
  id: string;
  post: string;
  number: number;
  source: string;
  note: string;
  restored_from: number | null;
  conversation_id: string | null;
  headline: string;
  body: string;
  body_blocks: object | string;
  hashtags: string[];
  cta: string;
  image_url: string;
  image_status: string;
  image_origin: string;
  video_url: string;
  media: string;
  media_type: string;
  is_current: boolean;
  created_at: string;
}

// GET posts/{postId}/versions/ — newest first
export interface PaginatedPostVersions {
  count: number;
  next: string | null;
  previous: string | null;
  results: PostVersion[];
}

// POST agent/conversations/{id}/restore/ — message is null when that version was already current
export interface RestoreVersionResponse {
  version: PostVersion;
  message: Message | null;
}

export interface PaginatedAgentPosts {
  count: number;
  next: string | null;
  previous: string | null;
  results: AgentPost[];
}
