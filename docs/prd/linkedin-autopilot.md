# PRD — LinkedIn Autopilot Page

## Overview

A single-page dashboard that lets users generate on-brand LinkedIn posts from their workspace knowledge base, review and approve drafts, schedule, and auto-publish — all orchestrated by a multi-agent AI workflow.

Every API call is scoped to the **active workspace** via `/workspaces/{workspace_pk}/` prefix.

## Problem

Marketing and GTM teams struggle to maintain a consistent LinkedIn presence. Writing posts manually is time-consuming, tone is inconsistent, and scheduling is ad-hoc.

## Goal

Give users a fully automated LinkedIn content pipeline with a single human approval gate — so they stay in control without doing the manual work.

---

## Sections

### 0. Mode Tabs

Two tabs at the top of the page: **Agent** (default) and **Manual**. Mode persists in URL as `?mode=agent|manual`.

- **Agent** (default): shows `AgentModeSection` banner, hides `GeneratePostsSection`. Stepper shows all 5 steps including Profile URL.
- **Manual**: shows `GeneratePostsSection`, hides `AgentModeSection`. Stepper shows 4 steps (Profile URL step hidden).
- Tab state: `useSearchParams()` read from URL; `router.replace()` to update, preserving other params. Wrapped in `<Suspense>`.
- **URL sync rules**: Two effects in page.tsx. Effect 1 (`[searchParams, workspaces]`) syncs URL→context. Effect 2 (`[activeWorkspace?.id, pathname]`) injects `?workspace=` when absent — reads `window.location.search` directly (not the stale `searchParams` closure) to avoid spurious mode resets when workspace changes.

### 1. Setup Stepper

Horizontal progress bar at the top of the page. Accepts `mode: "agentic" | "manual"` prop — in manual mode, the Profile URL step is filtered out.

| # | Label | Agentic | Manual | Completion | Modal |
|---|-------|---------|--------|-----------|-------|
| 1 | LinkedIn Connect | ✓ | ✓ | `account.connected === true` | `LinkedInManageModal` |
| 2 | Profile URL | ✓ (agent) | — | any profile `status === "ready"` via `GET /linkedin/profiles/` | `ProfileUrlModal` |
| 3 | Knowledge | ✓ | ✓ | any doc `purpose === "knowledge"` via `GET /documents/` | `KnowledgeUploadModal` |
| 4 | Tone | ✓ | ✓ | any doc `purpose === "tone"` | `KnowledgeUploadModal` |
| 5 | Style Upload | ✓ | ✓ | any doc `purpose === "style"` | `KnowledgeUploadModal` |

- Done → teal filled circle with checkmark + teal connector line
- Active (first incomplete) → blue outlined circle
- Pending → gray circle + gray connector line
- Component: `src/components/linkedin-autopilot/SetupStepper.tsx`

**Modals:**
- `ProfileUrlModal` — lists existing profiles (teal=ready, blue+spinner=pending/fetching, red=error+Retry button), modal delete confirm per profile (username extracted from `profile_url` via regex `/linkedin\.com\/in\/([^/?#]+)/`), add URL input, per-profile polling via list endpoint. On `ready`, invalidates `["linkedin-profiles", workspaceId]`.
- `KnowledgeUploadModal` — type selector (Knowledge/Tone/Style), PDF upload, URL input, existing docs list (filename + purpose badge + delete), items-to-upload list; wires `POST /documents/` with `purpose` field; `DELETE /documents/{id}/` per existing doc.

### 2. Account & Knowledge Base

- **LinkedIn account card**: Shows connection status, authorized user, OAuth scope. **Manage** → `LinkedInManageModal`.
- **Knowledge base card**: Shows website crawl status and domain when indexed; shows uploaded document count when docs exist. **Add sources** → `KnowledgeUploadModal`. **Re-crawl** → triggers re-index.
- **Stats grid** (2 rows × 4 cards): Row 1 — Drafts · Approved · Scheduled · Published; Row 2 — Failed · Published This Week · Next Scheduled · Avg. Engagement
  - API: `GET /workspaces/{workspace_pk}/content/posts/stats/`

### 3. Generate Posts (Manual mode only)

- Controls: Number of posts, Use Emoji (Yes/No), Length (Short/Medium/Long)
- **Tone reference PDF** dropdown — from `GET /documents/?purpose=tone`; sends `tone_document` in body
- **Style reference PDF** dropdown — from `GET /documents/?purpose=style`; sends `style_document` in body
- **Source URL** (optional) + Custom prompt textarea
- Tone/content style hardcoded (`"professional"` / `"thought_leadership"`) — no user dropdowns
- Generate → `POST /workspaces/{id}/content/posts/generate/` with `{ prompt, tone, length, content_style, use_emoji, count, tone_document?, style_document?, writer_model? }`
- Generate is **synchronous**: posts created immediately; images generated async (`image_status: "pending"`)
- On success: invalidates `["posts","draft"]`; sets `["posts-generating"]` flag for image polling

### 4. Review & Approval

- Shows drafts awaiting review (badge count)
- **Filtered by mode**: reads `?mode=` from URL and passes `state=agent|manual` to `GET /content/posts/?status=draft&state=agent|manual` — each tab shows only its own posts
- Query key includes mode: `["posts","draft",workspaceId,mode]` — switching tabs auto-refetches
- Polls every 5s after Generate fires (via `["posts-generating"]` flag); stops when all drafts have `image_status !== "pending"`
- Two-column card grid: author avatar, Draft badge, post body, image area, hashtags
- Actions per card: Edit → `EditPostModal` · Regenerate Post · Regenerate Image · Delete → `RejectConfirmModal` · Approve → `POST .../approve/`
- Approve invalidates `["posts","draft",workspaceId]` (partial match, `exact: false`) + `["posts","all"]`

### 5. Post Management

- Accepts `mode` prop (`"agent" | "manual"`); passes `state` to `getAllPosts` to filter posts by origin
- Query key includes mode: `["posts","all",workspaceId,mode,activeFilter,page,pageSize]`
- Excludes draft posts server-side via `exclude_status=draft`
- Table with checkbox selection + select-all (indeterminate state)
- Bulk delete when ≥ 2 rows selected
- Page size selector (2 / 5 / 10 / 15 / 20), filter dropdown (All / Approved / Scheduled / Published / Failed)
- Columns: ☐ · POST · CREATED · SCHEDULED · PUBLISHED · STATUS · ENGAGEMENT · ACTIONS
- SCHEDULED column: shows `scheduled_at` if set; otherwise shows `suggested_publish_at` (greyed out, labelled "suggested") when post is approved
- `ScheduleModal` pre-fills from `suggestedAt` prop (uses `suggested_publish_at` when scheduling, not rescheduling)
- Per-row actions: Schedule / Reschedule / Retry / External link; three-dot: View → `ViewPostModal` · Delete → `RejectConfirmModal`

### 6. Agent Mode (Agentic mode only)

Blue banner above `AccountSection`. **Run Agent** opens a 3-phase modal (`width="3xl"`, `disableBackdropClose`, `bodyClassName="flex flex-col"`, `minHeight="480px"`).

**Phase A — LinkedIn Profile**

Phase states: `a-loading | a-submit | a-polling | a-ready | a-error`

- **a-loading**: checks existing profiles on open.
- **a-submit**: shown when no profile exists yet. Three sections stacked:
  1. LinkedIn Profile URL — inline input + Analyze Profile button
  2. Websites — add URL with purpose selector (knowledge/tone/style); items call `POST /linkedin/agent/websites/` immediately; show shimmer while crawling, stop shimmer on ready/error/failed
  3. Documents — upload PDF with purpose selector; calls `POST /linkedin/agent/documents/` immediately; same shimmer/polling behavior
  - Generate Marketing Plans enabled if any profile URL, website, or doc exists
- **a-polling**: spinner while profile fetches (polls `GET /linkedin/profiles/` every 3s)
- **a-ready**: content pinned to bottom via `flex-1` spacer. Layout: profile cards (username from regex, modal delete confirm) → Knowledge Sources card (websites + docs with shimmer, purpose badges, status badges, modal delete confirms) → add-another URL input → action row (Generate Marketing Plans + ModelSwitcher dropUp)
- **a-error**: error banner + Change URL + Retry

**Phase B — Planning Brief + Marketing Plans**

Phase states: `b-brief | b-generating | b-select | b-headlines`

- `b-brief`: form with three optional fields — **Target Audience** (text), **Region** (IANA timezone picker from `COMMON_TIMEZONES` list, not country dropdown), **Days** (integer 1–90, default 7). "Generate Plans" submits.
- `b-generating`: spinner while `POST /content/plans/` runs (~5-15s). Body: `{ target_audience?, region?, days?, writer_model? }`.
- `b-select`: 3-column grid of plan cards. Each card: title, angle, target_audience, content pillars, sample_hooks[0]. Pencil icon → edit modal (`Modal width="lg"`) → `PATCH /content/plans/{id}/`. Back button returns to `a-ready`. User picks one plan card → advances to `b-headlines`.
- `b-headlines`: shows headlines list from `POST /content/plans/{id}/headlines/` (~5-10s). Each headline is an editable text field + checkbox. "Generate more" calls same endpoint with `exclude` = all current headlines. "Add custom" pushes empty editable row. User selects desired headlines → "Generate Posts".

**Phase C — Generate Posts**

Phase states: `c-generating | c-polling | c-done`

- Calls `POST /content/plans/{id}/generate/` with `{ headlines[], tone?, length?, use_emoji?, use_ai_image?, writer_model?, tone_document?, style_document? }`; polls `GET posts/?plan={id}&state=agent` every 3s; on posts found sets `["posts-generating"]` flag; auto-closes after 2s.
- Drafts appear one by one. Each has `suggested_publish_at` (label as "Suggested", not "Scheduled") and `headline` field.

**Terminal statuses for polling**: `ready`, `error`, `failed` — polling stops on any of these. `failed` shows red badge (same as `error`).

**suggested_publish_at**: AI-suggested publish slot (UTC). Label as "Suggested" in UI, never "Scheduled". Editable from `ReviewApprovalSection` via `PATCH posts/{id}/` with `{ suggested_publish_at }`. Preserved across post regeneration.

**Knowledge Sources (agent-level endpoints — workspace-scoped, no profile required):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `.../linkedin/agent/documents/` | List agent docs |
| POST | `.../linkedin/agent/documents/` | Upload doc (FormData: `file` + `purpose`) |
| DELETE | `.../linkedin/agent/documents/{id}/` | Delete doc |
| GET | `.../linkedin/agent/websites/` | List agent websites |
| POST | `.../linkedin/agent/websites/` | Add website (`{ url, purpose }`) |
| GET | `.../linkedin/agent/websites/{id}/` | Get single website |
| DELETE | `.../linkedin/agent/websites/{id}/` | Delete website |
| POST | `.../linkedin/agent/websites/{id}/recrawl/` | Recrawl website |

**Purpose values**: `knowledge` (default) · `tone` · `style`

### 7. Model Switcher

`ModelSwitcher` component — fetches `GET /ai-models/`, stores selection in `["selected-model"]` cache.

- `useSelectedModel()` hook exported from `ModelSwitcher.tsx`
- Appears in: GeneratePostsSection bottom bar, AgentModeSection a-ready phase, AgentModeSection b-select action row
- `writer_model` sent to: `POST /content/posts/generate/`, `POST /content/plans/`, `POST /content/plans/{id}/generate/`
- `dropUp` prop opens dropdown upward (used inside modal to avoid clipping)

### 8. Autopilot Agent Workflow (UI-only)

- Live status indicator, orchestrator banner, 7 agent cards in 4+3 grid

---

## Data Model

| Type | Key Fields |
|------|-----------|
| `LinkedInProfile` | id, profile_url, status (string), facets `{ topics, summary, brand_tone, value_props }`, knowledge_items, posts_count, error, created_at |
| `ProfileDocument` | id, file, filename, purpose, status (string), num_pages, summary, guide, facets, error, created_at |
| `ProfileWebsite` | id, url, kind, purpose, status (string), summary, facets, error, created_at |
| `PlanningBrief` | id, target_audience (nullable), region (nullable, IANA tz), days |
| `MarketingPlan` | id, batch, brief: PlanningBrief\|null, linkedin_profile: string\|null, title, angle, target_audience, rationale, pillars, sample_hooks, cadence, created_at |
| `PostType` | id, state ("agent"\|"manual"), plan (nullable uuid), headline (nullable), body, hashtags, image_url, image_status, tone, length, use_emoji, writer_model, status, scheduled_at, suggested_publish_at (nullable), published_at, engagement (nullable), cta (nullable), created_at |

**Note**: `LinkedInProfile` has `profile_url` (not `url`) and `facets` object (not `name`/`headline`). Username displayed by extracting from `profile_url` via regex `/linkedin\.com\/in\/([^/?#]+)/`.

## Status Flow

```
[Draft] → [Approved] → [Scheduled] → [Published]
                                    ↘ [Failed → retry]
```

## API Endpoints (workspace-scoped)

All endpoints prefixed with `/api/v1/workspaces/{workspace_pk}/`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `.../content/posts/stats/` | Stats grid |
| GET | `.../content/posts/?status=draft` | Draft posts list |
| GET | `.../content/posts/?exclude_status=draft&page=N&page_size=N` | Post management table |
| POST | `.../content/posts/generate/` | Generate posts |
| POST | `.../content/posts/suggest_prompts/` | Prompt suggestions |
| POST | `.../content/posts/{id}/approve/` | Approve draft |
| POST | `.../content/posts/{id}/schedule/` | Schedule post |
| PATCH | `.../content/posts/{id}/` | Edit body / hashtags |
| DELETE | `.../content/posts/{id}/` | Delete post |
| POST | `.../content/posts/{id}/generate_image/` | Generate image |
| POST | `.../content/posts/{id}/upload_image/` | Upload image (FormData) |
| POST | `.../content/posts/{id}/regenerate/` | Regenerate post |
| GET | `.../websites/` | List indexed websites |
| POST | `.../websites/` | Add website URL |
| DELETE | `.../websites/{id}/` | Remove website |
| POST | `.../websites/{id}/recrawl/` | Re-crawl website |
| GET | `.../documents/` | List all documents |
| GET | `.../documents/?purpose=tone\|style\|knowledge` | Filtered docs |
| POST | `.../documents/` | Upload document |
| DELETE | `.../documents/{id}/` | Delete document |
| GET/DEL | `.../linkedin/account/` | Status / disconnect |
| GET | `.../linkedin/connect/` | Returns `{ authorize_url }` |
| GET | `.../linkedin/profiles/` | List LinkedIn profiles |
| POST | `.../linkedin/profiles/` | Create profile (`{ profile_url }`) |
| GET | `.../linkedin/profiles/{id}/` | Get single profile |
| POST | `.../linkedin/profiles/{id}/refetch/` | Retry failed profile |
| DELETE | `.../linkedin/profiles/{id}/` | Delete profile |
| GET | `.../linkedin/agent/documents/` | List agent docs |
| POST | `.../linkedin/agent/documents/` | Upload agent doc |
| DELETE | `.../linkedin/agent/documents/{id}/` | Delete agent doc |
| GET | `.../linkedin/agent/websites/` | List agent websites |
| POST | `.../linkedin/agent/websites/` | Add agent website |
| DELETE | `.../linkedin/agent/websites/{id}/` | Delete agent website |
| POST | `.../linkedin/agent/websites/{id}/recrawl/` | Recrawl agent website |
| GET | `.../content/plans/` | List plans (paginated, brief inlined) |
| POST | `.../content/plans/` | Generate marketing plans (body: target_audience?, region?, days?, writer_model?) |
| PATCH | `.../content/plans/{id}/` | Edit marketing plan |
| POST | `.../content/plans/{id}/headlines/` | Get headlines (body: count?, exclude?) |
| POST | `.../content/plans/{id}/generate/` | Generate posts from plan (body: headlines[], tone?, etc.) |
| GET | `.../content/posts/?plan={id}&state=agent` | Poll plan's draft posts |
| POST | `.../linkedin/agent/documents/{id}/reextract/` | Re-extract agent document |

Top-level:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/logout/` | Sign out |
| GET | `/api/v1/ai-models/` | List available AI models |
| GET | `/api/v1/linkedin/callback/` | OAuth callback |

## Out of Scope (remaining)

- Real-time agent status polling (WebSocket)
- Calendar view
- Bulk delete confirmation modal
- Image removal via PATCH
- Hashtag PATCH (backend fixing)
