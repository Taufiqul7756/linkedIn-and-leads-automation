# PRD — Leads Real Integration (v2)

> **Status report for CTO review**
> LinkedIn Autopilot — fully implemented (all phases complete, API-integrated).
> LinkedIn Agent (Conversation API) — fully implemented (new route `/linkedin/automation`).
> Leads page — UI and mock data complete. Real API integration is the scope of this document.

---

## Project Status Summary

| Feature | Status | Notes |
|---|---|---|
| LinkedIn Autopilot | **Done** | Full agent mode (profile → plans → headlines → posts), manual mode, model switcher, workspace-scoped, API-integrated |
| LinkedIn Agent (Conversation API) | **Done** | Chat interface at `/linkedin/automation` — conversations, interrupt/grill form, headlines multi-select, draft cards, knowledge base modal, settings, history sidebar, TiptapEditor for editing |
| LinkedIn Post Management | **Done** | `/linkedin/post-management` — `PostManagementView` |
| LinkedIn Accounts | **Done** | `/linkedin/accounts` — `AccountsView` |
| Leads Page UI | **Done** | All sections rendered with mock data: Account Connection, Source Leads, Pipeline, Leads Table, Agentic Swarm, RunAgentModal |
| Leads API Integration | **Not started** | This document specifies the full real integration |
| Inbox Route | **Not started** | New route — specified in this document |

---

## LinkedIn Agent — Conversation API (Implemented)

### Route
`/linkedin/automation` → `AutomationView` (`src/components/linkedin/AutomationView.tsx`)

### API Base
All under `/api/v1/workspaces/{workspace_pk}/`

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `agent/conversations/` | Create new conversation |
| `GET` | `agent/conversations/` | List conversations (paginated, page/page_size) |
| `GET` | `agent/conversations/{id}/` | Get single conversation (full messages + interrupt + attachments) |
| `POST` | `agent/conversations/{id}/messages/` | Send user message → returns `{ run_id }` |
| `POST` | `agent/conversations/{id}/answer/` | Answer interrupt questions → returns `{ run_id }` |
| `POST` | `agent/conversations/{id}/cancel/` | Cancel running conversation |
| `DELETE` | `agent/conversations/{id}/` | Delete conversation |
| `POST` | `agent/conversations/{id}/attachments/` | Upload PDF (multipart) or URL (JSON `{ url }`) — max 5 per conv |
| `GET` | `agent/conversations/{id}/attachments/` | List attachments (unpaginated) |
| `DELETE` | `agent/conversations/{id}/attachments/{aid}/` | Remove attachment |
| `GET` | `agent/settings/` | Get workspace agent settings |
| `PATCH` | `agent/settings/` | Update agent settings (partial) |
| `GET` | `content/posts/?state=agent` | Fetch agent-generated posts |

> **Note**: Service uses `axios` directly (not `api` helpers) so errors propagate properly.

### Types (`src/types/LinkedInAgent.ts`)

**ConversationStatus**: `"draft" | "running" | "awaiting_input" | "completed" | "failed" | "cancelled" | "archived"`

**MessageKind**: `"text" | "posts" | "edit" | "error"` — **MessageRole**: `"user" | "agent"`

**QuestionKind**: `"choice" | "number" | "text"`

```ts
interface Question {
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

interface Attachment {
  id: string;
  kind: "pdf" | "url";
  url: string;
  url_kind: "site" | "page" | "profile" | "";
  label: string;
  status: "pending" | "ready" | "failed";
  error: string;
  created_at: string;
}

interface PendingInterrupt {
  id: string;
  kind: "questions" | "headlines" | string;  // branch on kind — unknown kinds fall back gracefully
  questions?: Question[];    // present when kind === "questions"
  headlines?: string[];      // present when kind === "headlines"
}

interface Conversation {
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

// V2 shape — make_longer removed; post_count, use_hashtags, ignore_headline, ignore_grilling added
interface AgentSettings {
  post_count: number;       // 1–20, default 5
  use_hashtags: boolean;
  use_emoji: boolean;
  use_knowledge: boolean;
  use_ai_image: boolean;
  ignore_headline: boolean; // skip headline round
  ignore_grilling: boolean; // skip clarifying questions
}
```

**AgentPost** (extends PostType for agent state):
```ts
interface AgentPost {
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
  body_blocks: BlockNode[] | string;  // structured rich content or JSON string
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
```

**Body block types** (`ParagraphBlock`, `ListBlock`) — spans with optional `bold` flag:
```ts
type BlockNode = ParagraphBlock | ListBlock;
interface ParagraphBlock { type: "paragraph"; spans: SpanNode[] }
interface ListBlock { type: "list"; marker: "-"|"*"|"•"|"→"; tight: boolean; items: { spans: SpanNode[] }[] }
interface SpanNode { text: string; bold?: boolean }
```

### UI Components

#### AutomationView (`src/components/linkedin/AutomationView.tsx`)
- **History sidebar** — grouped (Today / Yesterday / Last 7 days / Older), delete per conversation; auto-loads when panel opens (effect keyed on `[historyOpen, workspaceId]`)
- **Conversation restore** — on mount: reads `?conv=` URL param → fallback to latest from API → writes back to URL
- **Polling** — `setInterval` every 2s; keeps polling while `status === "running"` OR any attachment is `pending`; stops on other statuses; triggers `refreshHistory()` + `fetchPosts()` on `completed`
- **GrillForm** — renders `pending_interrupt.kind === "questions"`; 2-col grid for `choice/number`, full-width for `text` and `allow_free_text`; `allow_free_text` questions show select + text input stacked (free text overrides select); submits via `answerQuestion()` with `Record<string, string | string[]>`
- **HeadlinesForm** — triggered when `pending_interrupt.kind === "headlines"`; editable list (keep/reword/delete/add); answer payload: `{ headlines: string[] }`
- **DraftCard** — horizontal scroll row; approve/reject buttons (UI only, not yet wired); pencil → `EditDraftModal`; body rendering: rich text (`renderBlocks`) when no image fills card height, plain truncated (`line-clamp-3`) when image present; no image placeholder when `image_url` is empty
- **DraftsSection** — shows after `completed` with `post_ids`; "View all drafts" → `AllDraftsModal`; link to `/linkedin/post-management`
- **Settings panel** — `post_count` (number input, 1–20), `use_hashtags`, `use_emoji`, `use_knowledge`, `use_ai_image` toggles; auto-loaded on mount; saved via `PATCH agent/settings/`
- **Filter dropdown** — `ignore_grilling` ("Skip clarifying questions") and `ignore_headline` ("Skip headline round") checkboxes; active filters shown as blue-50/blue-600 chips with X to remove; chevron rotates on open
- **Attachments** — `+` menu: PDF upload (multipart) + URL input (JSON); chips show `pending`/`ready`/`failed` status; cap 5 enforced client-side; `ensureConversation()` creates conv on-demand before first upload; send blocked while any attachment is `pending`; delete via `DELETE attachments/{aid}/`
- **Prompt suggestions** — 4 quickstart chips

#### EditDraftModal (`src/components/linkedin/EditDraftModal.tsx`)
- Converts `body_blocks` → Tiptap JSON (handles array, JSON string, or existing `type:"doc"`)
- Falls back to plain `body` text split by `\n` into paragraphs
- **Title field** — only shown when `post.headline` is non-empty
- **TiptapEditor** — bold, italic, strikethrough, bullet/ordered list, H1/H2/H3, blockquote, code, HR, undo/redo, clear marks
- Image toggle — shows `image_url` or placeholder; "Change image" button (file input, not yet wired)
- Schedule date + time inputs (pre-populated from `suggested_publish_at`)
- Mini composer for AI-requested changes (textarea + Send — not yet wired)
- Save changes button (not yet wired to PATCH API)

#### AllDraftsModal (`src/components/linkedin/AllDraftsModal.tsx`)
- Paginated grid of draft cards (6 per page, 3-col on large)
- Each card: image, headline, suggested time, body preview (rich blocks), approve/reject buttons (not wired), pencil → edit

#### KnowledgeBaseModal (`src/components/linkedin/KnowledgeBaseModal.tsx`)
- Manage agent knowledge sources (workspace-scoped, via `agentService`)
- Grouped display: **Knowledge** / **Tone-Style**
- Add website URL with purpose dropdown (Knowledge / Tone style) → `addAgentWebsite()`
- Add LinkedIn profile URL → `addAgentWebsite()` with `knowledge` purpose
- Upload document (PDF/DOCX/TXT) with purpose → `uploadAgentDocument()`
- Recrawl website → `recrawlAgentWebsite()`
- Delete site/doc with confirm modal → `deleteAgentWebsite()` / `deleteAgentDocument()`
- Auto-polls every 3s while any item is non-terminal (`ready|error|failed`)
- Query keys: `["agent-documents", workspaceId]`, `["agent-websites", workspaceId]`

#### TiptapEditor (`src/components/ui/TiptapEditor.tsx`)
- Props: `content: object | string`, `onChange: (json: object) => void`, `minHeight?: string`, `placeholder?: string`
- Toolbar: Bold · Italic · Strikethrough · BulletList · OrderedList · H1 · H2 · H3 · Blockquote · Code · HR · Undo · Redo · Clear
- Uses `@tiptap/react` + `@tiptap/starter-kit`; outputs Tiptap JSON via `editor.getJSON()`

### Not Yet Wired (UI exists, API calls pending)
- Approve/reject buttons on `DraftCard` and `MiniCard`
- "Generate more drafts" button in `DraftsSection`
- Mini composer "Send" in `EditDraftModal`
- "Save changes" in `EditDraftModal` (no PATCH call)
- "Change image" in `EditDraftModal` (file input exists, upload not wired)

---

## Overview

The Leads feature is an end-to-end AI-powered lead generation and outreach pipeline. The user describes who they want to reach in plain language. The system converts that into a structured query, sources leads from external tools (Apollo.io etc.), validates emails, enriches the data, loads it into the table, and then runs outreach via three configurable automation modes.

The Inbox is a companion route — a messenger-style interface where users read and reply to all outreach conversations (email + WhatsApp) in one place.

---

## Full Pipeline Flow

```
[1] User Prompt
    │
    ▼
[2] AI Prompt Restructure (Claude)
    │  Converts natural language → structured query for Apollo.io / Hunter.io / etc.
    ▼
[3] Lead Collection (Apollo.io / external tool)
    │  Returns raw lead records: name, company, email, phone, LinkedIn URL, title
    ▼
[4] Email Validation (ZeroBounce / NeverBounce)
    │  Each email scored: valid (green) · risky (amber) · invalid (red)
    │  Red-flagged emails → automatically removed from batch
    ▼
[5] AI Enrichment & Cleanup (Claude)
    │  Deduplication, normalization, missing field inference, structured for leads table
    ▼
[6] Leads Table (loaded, displayed)
    │
    ▼
[7] Outreach (Run Agent)
    Mode A: Fully Automated  — agent sends without human approval
    Mode B: Partial Automated — agent drafts, human approves each message
    Mode C: Fully Manual      — agent stops here; human sends manually
```

---

## Step-by-Step Specification

### Step 1 — User Prompt

**UI**: `SourceLeadsSection` — already built.

The user types a natural language prompt:
> "Top 5 dental clinics in Austin TX with owner emails and phone numbers"

A suggestion chips row provides quick examples. User clicks **Find Leads**.

---

### Step 2 — AI Prompt Restructure

**Trigger**: `POST /workspaces/{workspace_pk}/leads/source/`

Claude receives the raw user prompt and restructures it into a precise, tool-compatible query.

**Request body:**
```json
{
  "prompt": "Top 5 dental clinics in Austin TX with owner emails and phone numbers"
}
```

**Claude's job**: Identify intent (industry, location, role, contact fields, result count), then produce a structured query object compatible with the selected sourcing tool (Apollo.io by default).

**Response** (from backend, after Claude processes):
```json
{
  "job_id": "uuid",
  "structured_query": {
    "industry": "dental",
    "location": "Austin, TX",
    "titles": ["owner", "practice manager"],
    "fields": ["email", "phone"],
    "limit": 5
  },
  "source_tool": "apollo",
  "status": "queued"
}
```

- Response is **async** — backend queues the job and returns `job_id`
- Frontend polls `GET /workspaces/{workspace_pk}/leads/source/{job_id}/` every 3s

---

### Step 3 — Lead Collection (Apollo.io / external)

**Handled by backend** — no frontend API call needed beyond polling.

Backend calls Apollo.io (or Hunter.io / Snov.io / etc.) using the structured query. Returns raw lead records.

**Sourcing tools supported** (configurable per workspace):
- Apollo.io (default)
- Hunter.io
- Snov.io
- ZoomInfo (future)

**Raw lead shape** (internal, from sourcing tool):
```ts
{
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;           // unvalidated
  phone: string | null;
  linkedin_url: string | null;
  source_tool: string;     // "apollo" | "hunter" | etc.
}
```

---

### Step 4 — Email Validation

**Handled by backend** automatically after Step 3.

Each email is sent to **ZeroBounce** or **NeverBounce** for validation.

**Result per email:**

| Score | Flag | Action |
|---|---|---|
| `valid` | Green | Kept in batch |
| `catch_all` / `unknown` | Amber (Risky) | Kept, flagged as Risky |
| `invalid` / `do_not_mail` / `spamtrap` / `abuse` | Red | **Automatically removed** |

- Red-flagged leads are **deleted from the batch before enrichment** — they never appear in the leads table
- Risky emails are kept but shown with amber STATUS pill in the table
- Validation provider is configurable per workspace (ZeroBounce default)

---

### Step 5 — AI Enrichment & Cleanup

**Handled by backend** after validation.

Claude receives the validated lead batch and:
1. Deduplicates records (same email / same name+company)
2. Normalizes company names, phone formats, titles
3. Infers missing fields where confident (e.g. LinkedIn URL from name+company)
4. Adds `outreach_status: "not_contacted"` to all leads
5. Structures final records for the leads table schema

**Final lead shape (API response):**
```ts
{
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  email_type: "corporate" | "personal" | "generic";
  phone: string | null;
  linkedin_url: string | null;
  status: "valid" | "risky";        // red leads already removed
  outreach: "not_contacted" | "email_sent" | "whatsapp_sent" | "linkedin_sent" | "replied";
  last_activity: string | null;     // ISO datetime
  source_tool: string;
  created_at: string;
}
```

---

### Step 6 — Leads Table Load

**Polling endpoint**: `GET /workspaces/{workspace_pk}/leads/source/{job_id}/`

```json
{
  "job_id": "uuid",
  "status": "complete",        // "queued" | "sourcing" | "validating" | "enriching" | "complete" | "failed"
  "progress": {
    "stage": "enriching",
    "sourced": 5,
    "validated": 5,
    "removed": 1,
    "enriched": 4
  },
  "leads": [ /* final lead array */ ]
}
```

Frontend shows a live progress indicator during polling:
```
Sourcing... → Validating emails... → Enriching... → Done (4 leads loaded)
```

On `status: "complete"`, leads are added to the table via `POST /workspaces/{workspace_pk}/leads/` (backend handles this) and the table query is invalidated.

---

## Run Agent — 3 Automation Modes

Triggered from **RunAgentModal** on selected leads.

**API**: `POST /workspaces/{workspace_pk}/leads/run-agent/`

```json
{
  "lead_ids": ["uuid1", "uuid2"],
  "mode": "fully-automated" | "partial-automated" | "fully-manual",
  "channels": ["email", "whatsapp", "linkedin"]
}
```

### Mode A — Fully Automated

- Agent drafts and **sends** outreach across all selected channels without human approval
- Email → SMTP / SendGrid
- WhatsApp → Twilio / WhatsApp Business API
- LinkedIn → LinkedIn Messaging API (if connected)
- Updates `outreach` field on each lead after sending
- Shows sent status in leads table immediately

### Mode B — Partial Automated

- Agent drafts outreach messages for all selected leads and channels
- Each draft appears in the **Inbox** route for human review
- User reads the draft → clicks **Send** → message dispatched
- Lead `outreach` status updates only after human confirms send

### Mode C — Fully Manual

- Agent does nothing after enrichment
- User opens Inbox manually and composes messages themselves
- Lead `outreach` status updates when user sends from Inbox

---

## Inbox Route

**New route**: `/inbox`

A messenger-style interface for all outreach conversations.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Navbar                                                      │
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│  Conversation│  Message Thread                               │
│  List        │                                               │
│              │  [Lead name · Company]                        │
│  Filter:     │  ─────────────────────                        │
│  [Email][WA] │  AI draft (if partial mode):                  │
│              │  "Hi John, I noticed..."  [Edit] [Send]       │
│  ─────────── │                                               │
│  John Smith  │  ─────────────────────                        │
│  jane@acme   │  Compose:                                     │
│  Email       │  [textarea]              [Send]               │
│              │                                               │
│  Jane Doe    │                                               │
│  +1-555-...  │                                               │
│  WhatsApp    │                                               │
│              │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

### Conversation List (left panel)

- Each row: lead avatar initials + name + company + channel badge (Email / WhatsApp) + last message preview + timestamp
- **Channel filter tabs**: All · Email · WhatsApp
- Search by name or email/phone
- Unread count badge per conversation
- Active conversation highlighted

### Message Thread (right panel)

- Chronological message bubbles (sent = right, received = left)
- Sender label on each bubble: "You" or lead name
- **For Partial Automated mode**: AI draft appears pinned at top with edit textarea + Send button
- **Compose box** (bottom): textarea + Send button + channel indicator (email or WhatsApp)
- WhatsApp messages: character limit indicator (1600 chars)
- Email messages: subject line field visible when composing

### Send API

**Email**: `POST /workspaces/{workspace_pk}/leads/{lead_id}/outreach/email/`
```json
{
  "subject": "string",
  "body": "string"
}
```

**WhatsApp**: `POST /workspaces/{workspace_pk}/leads/{lead_id}/outreach/whatsapp/`
```json
{
  "message": "string"
}
```

Both update `outreach` status on the lead and append to the conversation thread.

---

## Leads Table — Real API

Replace mock data with real API calls.

**List leads**: `GET /workspaces/{workspace_pk}/leads/?page=1&page_size=25&status=&outreach=&search=`

**Stats**: `GET /workspaces/{workspace_pk}/leads/stats/`
```json
{
  "total": 2481,
  "validated": 2100,
  "contacted": 890,
  "replies": 143,
  "bounce_rate": "15.3%"
}
```

**Delete (bulk)**: `DELETE /workspaces/{workspace_pk}/leads/` with body `{ "ids": ["uuid1"] }`

**Import CSV**: `POST /workspaces/{workspace_pk}/leads/import/` (multipart/form-data, file field `"file"`)

**Export CSV**: `GET /workspaces/{workspace_pk}/leads/export/`

---

## Email & WhatsApp Provider Config

Workspace-level settings (stored in backend):

| Setting | Options |
|---|---|
| Lead sourcing tool | Apollo.io · Hunter.io · Snov.io |
| Email validation | ZeroBounce (default) · NeverBounce |
| Email sending | SendGrid · SMTP (custom) |
| WhatsApp | Twilio · WhatsApp Business API |

---

## Data Model (real API)

### Lead
```ts
{
  id: string;
  workspace: string;
  name: string;
  company: string;
  title: string;
  email: string;
  email_type: "corporate" | "personal" | "generic";
  phone: string | null;
  linkedin_url: string | null;
  status: "valid" | "risky";
  outreach: "not_contacted" | "email_sent" | "whatsapp_sent" | "linkedin_sent" | "replied";
  last_activity: string | null;
  source_tool: string;
  created_at: string;
}
```

### SourceJob
```ts
{
  id: string;
  workspace: string;
  prompt: string;
  structured_query: object;
  source_tool: string;
  status: "queued" | "sourcing" | "validating" | "enriching" | "complete" | "failed";
  progress: { stage: string; sourced: number; validated: number; removed: number; enriched: number };
  created_at: string;
}
```

### Message
```ts
{
  id: string;
  lead: string;
  channel: "email" | "whatsapp";
  direction: "outbound" | "inbound";
  subject: string | null;       // email only
  body: string;
  sent_at: string;
  is_ai_draft: boolean;
}
```

---

## Pipeline Section — Real API

The Pipeline section currently shows a single hardcoded batch. Real integration:

- `GET /workspaces/{workspace_pk}/leads/pipeline/` — returns current active batch with stages
- Stage statuses update in real time (poll every 5s while batch is active)
- Salesforce sync status from `GET /workspaces/{workspace_pk}/leads/pipeline/salesforce/`

---

## Query Keys (React Query)

```ts
["leads", workspaceId]                          // leads list
["leads", workspaceId, { page, filters }]       // paginated + filtered
["lead-stats", workspaceId]                     // stats row
["leads-source-job", workspaceId, jobId]        // polling source job status
["inbox", workspaceId]                          // conversation list
["inbox-thread", workspaceId, leadId, channel]  // message thread
["leads-pipeline", workspaceId]                 // pipeline stages
```

---

## API Endpoints Summary

All under `/api/v1/workspaces/{workspace_pk}/`

| Method | Endpoint | Notes |
|---|---|---|
| `POST` | `leads/source/` | Start source job — body: `{ prompt }` |
| `GET` | `leads/source/{job_id}/` | Poll job status (every 3s) |
| `GET` | `leads/` | List leads (paginated, filterable) |
| `DELETE` | `leads/` | Bulk delete — body: `{ ids }` |
| `POST` | `leads/import/` | CSV import |
| `GET` | `leads/export/` | CSV export |
| `GET` | `leads/stats/` | Stats row counts |
| `POST` | `leads/run-agent/` | Run agent on selected leads — body: `{ lead_ids, mode, channels }` |
| `GET` | `leads/pipeline/` | Pipeline batch + stage status |
| `GET` | `inbox/` | All conversations |
| `GET` | `inbox/{lead_id}/{channel}/` | Single conversation thread |
| `POST` | `leads/{lead_id}/outreach/email/` | Send email |
| `POST` | `leads/{lead_id}/outreach/whatsapp/` | Send WhatsApp |

---

## Implementation Phases

### Phase 1 — Lead Sourcing Pipeline (backend + frontend polling)
- `SourceLeadsSection` wired to `POST leads/source/`
- Progress polling with live stage indicator
- Leads table auto-refreshes on job complete

### Phase 2 — Leads Table Real API
- Replace mock with `GET leads/` + `GET leads/stats/`
- Search, filter, pagination
- Import CSV, Export CSV
- Bulk delete

### Phase 3 — Run Agent
- `RunAgentModal` posts to `POST leads/run-agent/`
- Fully Automated: leads table updates outreach status
- Partial Automated: drafts appear in Inbox for approval

### Phase 4 — Inbox Route
- New route `/inbox`
- Conversation list with channel filter
- Message thread per lead/channel
- Send email + WhatsApp
- AI draft display + edit + send (partial automated mode)

### Phase 5 — Pipeline Real Data
- Live pipeline batch from API
- Salesforce sync status
