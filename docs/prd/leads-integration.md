# PRD — Leads Real Integration (v2)

> **Status report for CTO review**
> LinkedIn Autopilot — fully implemented (all phases complete, API-integrated).
> Leads page — UI and mock data complete. Real API integration is the scope of this document.

---

## Project Status Summary

| Feature | Status | Notes |
|---|---|---|
| LinkedIn Autopilot | **Done** | Full agent mode (profile → plans → headlines → posts), manual mode, model switcher, workspace-scoped, API-integrated |
| Leads Page UI | **Done** | All sections rendered with mock data: Account Connection, Source Leads, Pipeline, Leads Table, Agentic Swarm, RunAgentModal |
| Leads API Integration | **Not started** | This document specifies the full real integration |
| Inbox Route | **Not started** | New route — specified in this document |

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
