# LinkedIn Autopilot — Frontend Developer Handoff

> **Scope:** LinkedIn Autopilot feature only. Covers the full UI flow, state machines, API contracts, and data models needed to understand how the frontend talks to the backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Two Modes](#two-modes)
3. [Shared Setup: LinkedIn Account Connection](#shared-setup-linkedin-account-connection)
4. [Agent Mode — Full Flow](#agent-mode--full-flow)
5. [Manual Mode — Full Flow](#manual-mode--full-flow)
6. [Post Management (Both Modes)](#post-management-both-modes)
7. [Agent Conversation Mode](#agent-conversation-mode)
8. [All API Endpoints](#all-api-endpoints)
9. [Data Models](#data-models)
10. [React Query Keys & Polling Patterns](#react-query-keys--polling-patterns)

---

## Overview

The LinkedIn Autopilot feature lets users generate and schedule LinkedIn posts via two paths:

- **Agent Mode** — structured workflow: connect a LinkedIn profile → generate marketing plans → pick headlines → generate posts
- **Manual Mode** — freeform: write a prompt → generate posts directly

Both modes share the same post review, approval, and scheduling flow after posts are generated.

**URL structure:** All API calls are workspace-scoped under `/workspaces/{workspace_pk}/`.

---

## Two Modes

The mode is stored in the URL as `?mode=agent` or `?mode=manual`.

| Feature | Agent Mode | Manual Mode |
|---|---|---|
| Knowledge sources | Agent-level pool (workspace-wide docs + websites) | Workspace documents |
| Post generation path | Profile → Plans → Headlines → Posts | Prompt → Posts directly |
| Suggested publish times | Yes (based on region/timezone) | No |
| Conversation interface | Yes (separate chat-style view) | No |

---

## Shared Setup: LinkedIn Account Connection

Before anything else the user must connect their LinkedIn account via OAuth.

### Flow

1. Frontend calls `GET /workspaces/{workspace_pk}/linkedin/connect/` → receives `{ authorize_url }`.
2. User is redirected to that URL (LinkedIn OAuth).
3. LinkedIn redirects back to `GET /linkedin/callback/?code=X&state=Y`.
4. Frontend polls `GET /workspaces/{workspace_pk}/linkedin/account/` to confirm connection.

### Endpoints

```
GET  /workspaces/{workspace_pk}/linkedin/connect/
     → { authorize_url: string }

GET  /linkedin/callback/?code=X&state=Y
     → { id, member_urn, name, scope, expires_at, created_at }

GET  /workspaces/{workspace_pk}/linkedin/account/
     → { connected: boolean, id, member_urn, name, scope, expires_at, created_at }

DELETE /workspaces/{workspace_pk}/linkedin/account/
```

**Query key:** `["linkedin-account", workspaceId]`

---

## Agent Mode — Full Flow

The agent mode modal has a **3-phase flow**, tracked by a frontend-only `phase` state variable.

```
Phase A  →  Phase B  →  Phase C
Profile      Plans        Generate
             & Headlines  Posts
```

---

### Phase A: LinkedIn Profile Setup

**Purpose:** Add a LinkedIn profile URL for the AI to study. Also attach knowledge sources (websites, PDFs) that the AI will use when writing posts.

**Frontend state:** `"a-loading" | "a-submit" | "a-polling" | "a-ready" | "a-error"`

| State | What's happening |
|---|---|
| `a-loading` | Checks if workspace already has profiles on modal open |
| `a-submit` | No profile yet — shows URL input form |
| `a-polling` | Profile added; polling every 3s until `status === "ready"` |
| `a-ready` | Profile loaded — shows profile card + knowledge sources + action buttons |
| `a-error` | Profile fetch failed — shows error with retry option |

**Profile display note:** The profile's display username is extracted client-side from the `profile_url` field using the regex `/linkedin\.com\/in\/([^/?#]+)/`. There is no `name` field from the API.

#### Profile Endpoints

```
GET  /workspaces/{workspace_pk}/linkedin/profiles/
     → { count, results: LinkedInProfile[] }

POST /workspaces/{workspace_pk}/linkedin/profiles/
     body: { profile_url: string }
     → LinkedInProfile

GET  /workspaces/{workspace_pk}/linkedin/profiles/{id}/
     → LinkedInProfile

POST /workspaces/{workspace_pk}/linkedin/profiles/{id}/refetch/
     → LinkedInProfile

DELETE /workspaces/{workspace_pk}/linkedin/profiles/{id}/
```

**Polling:** `GET /linkedin/profiles/` every 3s until all profiles have status `ready | error | failed`.

**Query key:** `["linkedin-profiles", workspaceId]`

#### Knowledge Sources (Agent-Level)

Knowledge sources are **workspace-level** (not per-profile). They come in three purpose types:

| Purpose | Used for |
|---|---|
| `knowledge` | General facts, company info, product details |
| `tone` | Writing tone reference |
| `style` | Writing style reference |

Each item has `is_default: boolean` (only `knowledge` items can be default; at most one default doc and one default website per workspace).

**Document endpoints:**
```
GET    /workspaces/{workspace_pk}/linkedin/agent/documents/
       → { results: ProfileDocument[] }

POST   /workspaces/{workspace_pk}/linkedin/agent/documents/
       body: FormData { file: File, purpose: string, is_default: boolean }
       → ProfileDocument

DELETE /workspaces/{workspace_pk}/linkedin/agent/documents/{id}/

POST   /workspaces/{workspace_pk}/linkedin/agent/documents/{id}/reextract/
       → ProfileDocument
```

**Website endpoints:**
```
GET    /workspaces/{workspace_pk}/linkedin/agent/websites/
       → { results: ProfileWebsite[] }

POST   /workspaces/{workspace_pk}/linkedin/agent/websites/
       body: { url: string, purpose: string, is_default: boolean }
       → ProfileWebsite

GET    /workspaces/{workspace_pk}/linkedin/agent/websites/{id}/
       → ProfileWebsite

DELETE /workspaces/{workspace_pk}/linkedin/agent/websites/{id}/

POST   /workspaces/{workspace_pk}/linkedin/agent/websites/{id}/recrawl/
       → ProfileWebsite
```

**Polling:** Both documents and websites are polled every 3s until all items reach terminal status (`ready | error | failed`).

**Query keys:** `["agent-documents", workspaceId]`, `["agent-websites", workspaceId]`

#### Proceeding to Phase B

The "Generate Marketing Plans" button collects:
- `agent_documents: string[]` — IDs of checked documents
- `agent_websites: string[]` — IDs of checked websites
- `include_profile: boolean` — whether to include the LinkedIn profile (default `true`)
- `instruction: string` — optional custom prompt

These are passed directly to the plans generation call in Phase B.

---

### Phase B: Marketing Plans + Headlines

**Purpose:** Generate structured marketing plans, let user pick one, then generate headlines for individual posts.

**Frontend state:** `"b-generating" | "b-select" | "b-headlines"`

#### Step 1 — Generate Plans (`b-generating`)

```
POST /workspaces/{workspace_pk}/content/plans/
body: {
  instruction?: string,
  agent_documents?: string[],   // UUIDs from Phase A
  agent_websites?: string[],    // UUIDs from Phase A
  include_profile?: boolean,    // default true
  plan_count?: number,          // number of plans to generate (default 3)
  writer_model?: string         // AI model ID
}
→ MarketingPlan[]
```

- **Timing:** Synchronous (~5–15s). Frontend shows a spinner and waits.
- Returns an array of typically 3 plans.

#### Step 2 — Select a Plan (`b-select`)

The UI renders a 3-column card grid. Each card shows: title, angle, target_audience, pillars, and first sample hook.

- **Edit plan:** Pencil icon → PATCH endpoint → updates card in place.
- **Back:** Returns to `a-ready` (no API call).
- **Follow-up:** "Regenerate" button → returns to `a-ready`.
- **Select:** Clicking a card advances to `b-headlines`.

```
PATCH /workspaces/{workspace_pk}/content/plans/{id}/
      body: Partial<MarketingPlan>
      → MarketingPlan

POST /workspaces/{workspace_pk}/content/plans/{id}/follow-up/
     body: {}
     → MarketingPlan[]   // 3 new plans
```

**Plan badge logic:**
- `post_count > 0 && !has_follow_up` → amber "Used" badge
- `post_count > 0 && has_follow_up` → teal "Continued ✓" badge

#### Step 3 — Generate Headlines (`b-headlines`)

```
POST /workspaces/{workspace_pk}/content/plans/{id}/headlines/
body: {
  count?: number,      // defaults to brief.days
  exclude?: string[]   // list of headlines to exclude (used for "Generate more")
}
→ { headlines: string[] }
```

- **Timing:** Synchronous (~5–10s).
- The UI renders each headline as an editable text field with a checkbox.
- "Generate more" calls the same endpoint with `exclude` = all currently shown headlines.
- "Add custom" pushes an empty editable row (no API call).

The selected/edited headlines are what get passed to post generation in Phase C.

---

### Phase C: Post Generation & Polling

**Frontend state:** `"c-generating" | "c-polling" | "c-done"`

```
POST /workspaces/{workspace_pk}/content/plans/{id}/generate/
body: {
  headlines?: string[],       // selected headlines from Phase B
  tone?: string,
  length?: string,            // "short" | "medium" | "long"
  use_emoji?: boolean,
  use_ai_image?: boolean,
  writer_model?: string,
  tone_document?: string,     // UUID
  style_document?: string     // UUID
}
→ { status: "queued" }       // 202 immediately
```

- **Timing:** Returns 202 immediately. Posts are written in the background.
- Frontend sets a `["posts-generating"]` flag in the React Query cache.
- `ReviewApprovalSection` picks up this flag and starts polling for new drafts.

**Polling for generated posts:**
```
GET /workspaces/{workspace_pk}/content/posts/?plan={planId}&state=agent
→ PaginatedPosts
```
Poll every 3s. Stop when `results.length === count(selected headlines)`.

After posts are ready the modal auto-closes and drafts appear in the Review section.

---

## Manual Mode — Full Flow

### Setup Stepper (5 Steps)

The stepper shows setup progress. Steps auto-complete as the user connects accounts and uploads resources:

| Step | Condition for completion |
|---|---|
| 1. LinkedIn Connect | `account.connected === true` |
| 2. Profile URL | Any profile with `status === "ready"` |
| 3. Knowledge Sources | Any doc/website with `purpose === "knowledge"` |
| 4. Tone Reference | Any doc/website with `purpose === "tone"` |
| 5. Style Reference | Any doc/website with `purpose === "style"` |

Steps 3–5 in manual mode use the standard workspace documents endpoint (`["documents", workspaceId]`), not the agent-level endpoints.

### Post Generation

```
POST /workspaces/{workspace_pk}/content/posts/generate/
body: {
  prompt: string,
  tone: string,
  length: string,           // "short" | "medium" | "long"
  content_style: string,
  use_emoji: boolean,
  count: number,
  tone_document?: string,   // UUID
  style_document?: string,  // UUID
  writer_model?: string
}
→ GeneratePostsResponse
```

- **Timing:** Synchronous for text. Images are async (`image_status: "pending"`).
- After response: poll every 5s until `image_status !== "pending"` for each post.

**Suggested prompts:**
```
POST /workspaces/{workspace_pk}/content/posts/suggest_prompts/
body: { website_profile: string }
→ { prompts: string[] }
```

---

## Post Management (Both Modes)

After posts are generated they go through: **Draft → Approved → Scheduled → Published**.

All post list endpoints accept `?state=agent|manual` to filter by mode.

### Review & Approval (Drafts)

```
GET /workspaces/{workspace_pk}/content/posts/?status=draft[&state=agent|manual]
→ PaginatedPosts

POST /workspaces/{workspace_pk}/content/posts/{id}/approve/
     → PostType

DELETE /workspaces/{workspace_pk}/content/posts/{id}/

PATCH /workspaces/{workspace_pk}/content/posts/{id}/
      body: { body?, body_blocks?, hashtags?, image_url?, suggested_publish_at? }
      → PostType
```

**Query key:** `["posts", "draft", workspaceId, mode]`

### Post Stats (Header Counts)

```
GET /workspaces/{workspace_pk}/content/posts/stats/?state=agent|manual
→ {
    drafts: number,
    approved: number,
    scheduled: number,
    published: number,
    failed: number,
    published_this_week: number,
    next_scheduled_at: string | null,
    avg_engagement: number
  }
```

**Query key:** `["post-stats", workspaceId, mode]`

### Post Table (Non-Drafts)

```
GET /workspaces/{workspace_pk}/content/posts/?exclude_status=draft&page=N&page_size=N[&state=X]
→ PaginatedPosts
```

**Query key:** `["posts", "all", workspaceId, mode, activeFilter, page, pageSize]`

Table columns: Checkbox · Post content · Created · Scheduled · Published · Status · Engagement · Actions

- **Scheduled column:** Shows `scheduled_at` if set, otherwise shows `suggested_publish_at` greyed out with "Suggested" label.
- **Bulk delete:** Available when 2+ rows are checked.

### Per-Post Actions

```
POST /workspaces/{workspace_pk}/content/posts/{id}/approve/
POST /workspaces/{workspace_pk}/content/posts/{id}/schedule/
     body: {} | { scheduled_at: ISO8601 }

POST /workspaces/{workspace_pk}/content/posts/{id}/regenerate/
     body: { instruction?: string, mode: "rewrite" | "extend" }

POST /workspaces/{workspace_pk}/content/posts/{id}/generate_image/
     body: { image_prompt: string }

POST /workspaces/{workspace_pk}/content/posts/{id}/upload_image/
     body: FormData { image: File }

POST /workspaces/{workspace_pk}/content/posts/{id}/upload_video/
     body: FormData { video: File }

DELETE /workspaces/{workspace_pk}/content/posts/{id}/
```

---

## Agent Conversation Mode

A separate conversational interface where the user chats with an AI agent to create posts. This is distinct from the marketing plans flow above.

### Conversation Lifecycle

```
POST /workspaces/{workspace_pk}/agent/conversations/
     → Conversation   // status: "draft"

GET  /workspaces/{workspace_pk}/agent/conversations/
     → PaginatedConversations

GET  /workspaces/{workspace_pk}/agent/conversations/{id}/
     → Conversation   // includes messages, pending_interrupt

POST /workspaces/{workspace_pk}/agent/conversations/{id}/messages/
     body: { text: string }   // max 4000 chars
     → { run_id: string }     // 202 async

POST /workspaces/{workspace_pk}/agent/conversations/{id}/answer/
     body: { interrupt_id: string, answers: Record<string, string | string[]> }
     → { run_id: string }     // 202 async

POST /workspaces/{workspace_pk}/agent/conversations/{id}/cancel/
     → Conversation

DELETE /workspaces/{workspace_pk}/agent/conversations/{id}/
```

**Polling:** After sending a message, poll `GET /agent/conversations/{id}/` every 2s while `status === "running"`. Stop polling on any other status.

### Conversation Statuses

| Status | Meaning |
|---|---|
| `draft` | Conversation created, not yet started |
| `running` | AI is processing — poll |
| `awaiting_input` | AI has a question (`pending_interrupt` is set) |
| `completed` | AI finished, posts in `artifacts.post_ids` |
| `failed` / `cancelled` / `archived` | Terminal states |

### Pending Interrupt (AI asking a question)

When `status === "awaiting_input"`, the conversation has a `pending_interrupt` object. The UI renders a form and posts the user's answers back:

```typescript
// pending_interrupt.kind === "questions" → render each question
// pending_interrupt.kind === "headlines" → render headline multi-select

pending_interrupt: {
  id: string,
  kind: "questions" | "headlines",
  questions?: {
    id: string,
    text: string,
    kind: "choice" | "number" | "text",
    options?: string[]
  }[]
}
```

### Agent Settings

```
GET   /workspaces/{workspace_pk}/agent/settings/
      → AgentSettings

PATCH /workspaces/{workspace_pk}/agent/settings/
      body: Partial<AgentSettings>
      → AgentSettings
```

```typescript
AgentSettings: {
  post_count: number,
  use_hashtags: boolean,
  use_emoji: boolean,
  use_knowledge: boolean,
  use_ai_image: boolean,
  ignore_headline: boolean,
  ignore_grilling: boolean
}
```

### Attachments (Conversation-level)

```
POST   /workspaces/{workspace_pk}/agent/conversations/{id}/attachments/
       body: FormData { file: File } | { url: string }
       → Attachment

GET    /workspaces/{workspace_pk}/agent/conversations/{id}/attachments/
       → Attachment[]

DELETE /workspaces/{workspace_pk}/agent/conversations/{id}/attachments/{aid}/
```

---

## All API Endpoints

Quick reference table of every endpoint used by the LinkedIn feature.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/workspaces/{wpk}/linkedin/connect/` | Start OAuth, get redirect URL |
| `GET` | `/linkedin/callback/?code=X&state=Y` | OAuth callback |
| `GET` | `/workspaces/{wpk}/linkedin/account/` | Check account connection status |
| `DELETE` | `/workspaces/{wpk}/linkedin/account/` | Disconnect account |
| `GET` | `/workspaces/{wpk}/linkedin/profiles/` | List profiles |
| `POST` | `/workspaces/{wpk}/linkedin/profiles/` | Add profile URL |
| `GET` | `/workspaces/{wpk}/linkedin/profiles/{id}/` | Get single profile |
| `POST` | `/workspaces/{wpk}/linkedin/profiles/{id}/refetch/` | Re-fetch profile data |
| `DELETE` | `/workspaces/{wpk}/linkedin/profiles/{id}/` | Remove profile |
| `GET` | `/workspaces/{wpk}/linkedin/agent/documents/` | List agent documents |
| `POST` | `/workspaces/{wpk}/linkedin/agent/documents/` | Upload document (FormData) |
| `DELETE` | `/workspaces/{wpk}/linkedin/agent/documents/{id}/` | Delete document |
| `POST` | `/workspaces/{wpk}/linkedin/agent/documents/{id}/reextract/` | Re-process document |
| `GET` | `/workspaces/{wpk}/linkedin/agent/websites/` | List agent websites |
| `POST` | `/workspaces/{wpk}/linkedin/agent/websites/` | Add website URL |
| `GET` | `/workspaces/{wpk}/linkedin/agent/websites/{id}/` | Get single website |
| `DELETE` | `/workspaces/{wpk}/linkedin/agent/websites/{id}/` | Remove website |
| `POST` | `/workspaces/{wpk}/linkedin/agent/websites/{id}/recrawl/` | Re-crawl website |
| `POST` | `/workspaces/{wpk}/content/plans/` | Generate marketing plans |
| `GET` | `/workspaces/{wpk}/content/plans/` | List all plans |
| `PATCH` | `/workspaces/{wpk}/content/plans/{id}/` | Edit a plan |
| `POST` | `/workspaces/{wpk}/content/plans/{id}/follow-up/` | Generate 3 new follow-up plans |
| `POST` | `/workspaces/{wpk}/content/plans/{id}/headlines/` | Generate headlines for a plan |
| `POST` | `/workspaces/{wpk}/content/plans/{id}/generate/` | Trigger post generation (async 202) |
| `GET` | `/workspaces/{wpk}/content/posts/stats/` | Post counts by status |
| `GET` | `/workspaces/{wpk}/content/posts/` | List posts (filter by status, state, plan) |
| `GET` | `/workspaces/{wpk}/content/posts/{id}/` | Get single post |
| `PATCH` | `/workspaces/{wpk}/content/posts/{id}/` | Edit post |
| `POST` | `/workspaces/{wpk}/content/posts/{id}/approve/` | Approve draft |
| `POST` | `/workspaces/{wpk}/content/posts/{id}/schedule/` | Schedule post |
| `POST` | `/workspaces/{wpk}/content/posts/{id}/regenerate/` | Regenerate post content |
| `POST` | `/workspaces/{wpk}/content/posts/{id}/generate_image/` | Generate AI image for post |
| `POST` | `/workspaces/{wpk}/content/posts/{id}/upload_image/` | Upload custom image |
| `POST` | `/workspaces/{wpk}/content/posts/{id}/upload_video/` | Upload video |
| `DELETE` | `/workspaces/{wpk}/content/posts/{id}/` | Delete post |
| `POST` | `/workspaces/{wpk}/content/posts/generate/` | Manual mode: generate posts directly |
| `POST` | `/workspaces/{wpk}/content/posts/suggest_prompts/` | Get AI-suggested prompts |
| `GET` | `/ai-models/` | List available AI models |
| `POST` | `/workspaces/{wpk}/agent/conversations/` | Create conversation |
| `GET` | `/workspaces/{wpk}/agent/conversations/` | List conversations |
| `GET` | `/workspaces/{wpk}/agent/conversations/{id}/` | Get conversation + messages |
| `POST` | `/workspaces/{wpk}/agent/conversations/{id}/messages/` | Send message (async) |
| `POST` | `/workspaces/{wpk}/agent/conversations/{id}/answer/` | Answer AI question (async) |
| `POST` | `/workspaces/{wpk}/agent/conversations/{id}/cancel/` | Cancel running conversation |
| `DELETE` | `/workspaces/{wpk}/agent/conversations/{id}/` | Delete conversation |
| `POST` | `/workspaces/{wpk}/agent/conversations/{id}/attachments/` | Add attachment |
| `GET` | `/workspaces/{wpk}/agent/conversations/{id}/attachments/` | List attachments |
| `DELETE` | `/workspaces/{wpk}/agent/conversations/{id}/attachments/{aid}/` | Remove attachment |
| `GET` | `/workspaces/{wpk}/agent/settings/` | Get agent settings |
| `PATCH` | `/workspaces/{wpk}/agent/settings/` | Update agent settings |

---

## Data Models

### LinkedInProfile

```typescript
{
  id: string;
  profile_url: string;          // e.g. "https://linkedin.com/in/username"
  status: "pending" | "fetching" | "ready" | "error" | "failed";
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
}
```

### ProfileDocument

```typescript
{
  id: string;
  file: string;                 // URL
  filename: string;
  purpose: "knowledge" | "tone" | "style";
  is_default: boolean;
  status: "pending" | "ready" | "error" | "failed";
  num_pages: number;
  summary: string | null;
  guide: string | null;
  facets: object | null;
  error: string;
  created_at: string;
}
```

### ProfileWebsite

```typescript
{
  id: string;
  url: string;
  kind: string;
  purpose: "knowledge" | "tone" | "style";
  is_default: boolean;
  status: "pending" | "ready" | "error" | "failed";
  summary: string | null;
  facets: object | null;
  error: string;
  created_at: string;
}
```

### MarketingPlan

```typescript
{
  id: string;
  batch: string;                // equals the PlanningBrief ID
  brief: PlanningBrief | null;
  linkedin_profile: string | null;  // UUID
  title: string;
  angle: string;
  target_audience: string;
  rationale: string;
  pillars: string[];
  sample_hooks: string[];
  cadence: string;
  post_count: number;           // how many posts already generated from this plan
  has_follow_up: boolean;
  created_at: string;
}
```

### PlanningBrief

```typescript
{
  id: string;
  target_audience: string | null;
  region: string | null;        // IANA timezone string
  days: number;
  plan_count: number;
  instruction: string | null;
  agent_documents: string[];    // UUIDs
  agent_websites: string[];     // UUIDs
  include_profile: boolean;
  parent_plan: string | null;
}
```

### PostType

```typescript
{
  id: string;
  state: "agent" | "manual";
  plan: string | null;          // UUID of MarketingPlan
  headline: string | null;
  body: string;
  body_blocks: object | null;   // Tiptap doc JSON
  hashtags: string[];
  cta: string | null;
  tone: string;
  length: string;
  content_style: string;
  use_emoji: boolean;
  use_knowledge: boolean;
  writer_model: string;
  tone_document: string | null;
  style_document: string | null;
  tone_text: string | null;
  style_text: string | null;
  reference_link: string | null;
  image_url: string | null;
  image_status: "pending" | "ready" | "error";
  image_file: string | null;
  status: "draft" | "approved" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;  // ISO8601
  suggested_publish_at: string | null;
  published_at: string | null;
  engagement: {
    impressions: number;
    likes: number;
    comments: number;
    rate: number;
    synced_at: string;
  } | null;
  created_at: string;
}
```

### Conversation

```typescript
{
  id: string;
  status: "draft" | "running" | "awaiting_input" | "completed" | "failed" | "cancelled" | "archived";
  intent: string | null;
  grounding: string | null;
  title: string | null;
  messages: {
    id: string;
    role: "user" | "agent";
    kind: "text" | "posts" | "edit" | "error";
    text: string;
    payload: unknown;
    created_at: string;
  }[];
  pending_interrupt: {
    id: string;
    kind: "questions" | "headlines";
    questions?: {
      id: string;
      text: string;
      kind: "choice" | "number" | "text";
      options?: string[];
    }[];
  } | null;
  artifacts: { post_ids: string[] };
  attachments: {
    id: string;
    kind: "pdf" | "url";
    url: string;
    url_kind: string;
    label: string;
    status: string;
    error: string | null;
    created_at: string;
  }[];
  created_at: string;
  updated_at: string;
}
```

---

## React Query Keys & Polling Patterns

### Query Keys

```typescript
["linkedin-account", workspaceId]
["linkedin-profiles", workspaceId]
["documents", workspaceId]              // manual mode workspace docs
["agent-documents", workspaceId]        // agent mode knowledge pool
["agent-websites", workspaceId]         // agent mode knowledge pool
["ai-models"]                           // global, no workspaceId
["selected-model"]                      // global, persists AI model choice
["posts-generating"]                    // flag: agent set it, review section reads it
["posts", "draft", workspaceId, mode]   // mode = "agent" | "manual"
["posts", "all", workspaceId, mode, filter, page, pageSize]
["post-stats", workspaceId, mode]
["plans", "all", workspaceId]
```

### Polling Intervals

| What | Interval | Stop condition |
|---|---|---|
| LinkedIn profile fetching | 3s | `status` is `ready | error | failed` |
| Agent documents/websites | 3s | All items are terminal |
| Post generation (agent) | 3s | `results.length === selected headlines count` |
| Image generation (manual) | 5s | `image_status !== "pending"` |
| Conversation status | 2s | `status !== "running"` |

### Sibling Communication via React Query Cache

The `["posts-generating"]` flag is used to coordinate between two unrelated components:

- **AgentModeSection (producer):** After `POST /plans/{id}/generate/`, sets `queryClient.setQueryData(["posts-generating"], Date.now())`.
- **ReviewApprovalSection (consumer):** Subscribes with `enabled: false` — activates when the flag is non-null, starts polling for new drafts, then clears the flag when done.

This avoids prop drilling / shared state between sibling components.

### Error Handling by HTTP Status

| Status | Meaning |
|---|---|
| `400` | Validation error — DRF field-level errors in response body |
| `404` | Unknown workspace, conversation, or resource |
| `409` | Lifecycle conflict (e.g. conversation already running, source still pending) |
| vendor failures | Not HTTP errors — `status` field on the resource becomes `"failed"` |
