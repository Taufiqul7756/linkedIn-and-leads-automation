# PRD — Agentic Mode V2 (Brief → Headlines → Posts)

> Source: Relay · Agent Mode · API Integration Guide + confirmed swagger spec
> Base URL: `/api/v1/workspaces/{workspace_pk}/content/`
> Auth: `Authorization: Token <key>`
> Backwards compatible — nothing removed from existing API

---

## Overview

The old agentic flow went straight from "generate plans" to seven finished posts.

**New flow**: the user answers three planning questions up front, then hand-picks the exact first line of every post (headline). Four API calls total.

```
Step 1 (sync)     Step 2 (sync)       Step 3 (async)      Step 4 (poll)
─────────────     ─────────────       ──────────────       ─────────────
Brief the         Offer headlines     Write the posts      Poll → approve
planner           User picks lines    One post per         → schedule
                  "Generate more"     headline sent
POST plans/       POST plans/{id}/    POST plans/{id}/     GET posts/
                  headlines/          generate/            ?plan={id}
~5-15s · 201      ~5-10s · 200        202 immediately      every ~3s
```

Steps 1 and 2 are **synchronous** — show a spinner.
Step 3 returns **immediately** (202) and writes in the background — step 4 polls.

---

## Step 1 — Ask Three Questions (Planning Brief)

The user answers: **Target audience**, **Region (timezone)**, **Days**.
These three answers form a **Planning Brief**. The brief's `id` becomes the `batch` field on every returned plan.

### Request

```
POST .../content/plans/
```

```json
{
  "target_audience": "B2B SaaS founders",
  "region": "Europe/Berlin",
  "days": 7
}
```

All three fields are **optional** — send `{}` to get the old behaviour (no suggested times, empty brief).

### Response — 201, one plan object per call (backend creates 3 in one request)

The swagger schema shows a **single plan** as the 201 response. The integration guide says the backend generates 3 plans from one POST. In practice: the response may be an array of 3, or you fetch them via `GET plans/` immediately after — confirm with backend.

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "batch": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "brief": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "target_audience": "B2B SaaS founders",
    "region": "Europe/Berlin",
    "days": 7
  },
  "linkedin_profile": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "Build in public",
  "angle": "Lessons from shipping",
  "target_audience": "Seed-stage SaaS founders",
  "rationale": "…",
  "pillars": ["onboarding", "pricing"],
  "sample_hooks": ["…"],
  "cadence": "3× / week",
  "created_at": "2026-08-03T…"
}
```

> `batch` = brief's id. Each plan's own `target_audience` is a narrower segment — not the same string the user typed, and that's intentional.
> `linkedin_profile` is a UUID (profile id) or `null` — not a URL string.

### Field rules

| Field | Type | Rules | Effect |
|---|---|---|---|
| `target_audience` | string ≤255 | Optional | Constrains all 3 plans. Each plan then narrows to its own segment. |
| `region` | string ≤64 | Optional · must be valid IANA timezone | Sets `suggested_publish_at` on every draft. Omit → posts carry `null`. |
| `days` | integer 1–90 | Optional · default 7 | Controls how many headlines are offered in step 2, and the scheduling window width in step 3. |

### Region is a timezone, not a place

Use a **timezone picker** with IANA names — NOT a country dropdown.
`"Europe"` and `"Germany"` both return `400`.
It is the **audience's** geography, not the user's (someone in Dhaka selling to US buyers picks a US zone).

```
400 → { "region": ["Unknown timezone: Europe. Use an IANA name like 'Europe/Berlin'"] }
```

### Reading it back after reload

```
GET .../content/plans/?page=1&page_size=10
```

Returns **paginated** results (`count`, `next`, `previous`, `results[]`). Each plan has `brief` inlined — no second request needed after a page reload. Always returns the latest batch first.

---

## Step 2 — Offer Headlines

A **headline** is the literal first line of a post. The user selects the ones they want, and each selected headline becomes exactly one post.

**Nothing is stored server-side** — the headline list lives in client state. This matters for "Generate more".

### Request — first load

```
POST .../content/plans/{plan_id}/headlines/
```

```json
{}
```

`count` defaults to the brief's `days` value.

### Request — "Generate more"

```json
{
  "count": 5,
  "exclude": [
    "Most founders hire sales too early.",
    "Your pricing page is losing you deals."
  ]
}
```

> **YOU OWN THE LIST**: The server keeps no history. On "Generate more" you **must** send every headline currently on screen in `exclude`, then append the response to your existing array. Skip that and the second batch repeats the first.

### Response

```json
{
  "headlines": [
    "Most founders hire sales too early.",
    "We cut onboarding from 3 weeks to 4 days.",
    "Your pricing page is losing you deals.",
    "I fired our biggest customer. Here's why.",
    "Churn isn't a retention problem.",
    "The demo script that doubled our close rate.",
    "Nobody needs another dashboard."
  ]
}
```

### Field rules

| Field | Type | Rules | Notes |
|---|---|---|---|
| `count` | integer 1–20 | Optional · defaults to brief `days` | For "Generate more" send 3 or 5, not the full days value. |
| `exclude` | string[] ≤50 | Optional | Model avoids these *ideas*, not just these exact strings. Send the most recent 50 if user goes past that. |

### Error

```
400 { "detail": "Agent mode has no ready knowledge in this workspace. …" }
```
Surface this as-is. It refers to the knowledge pool (PDFs, URLs, profile) — never specifically about a LinkedIn profile.

### UI notes for Step 2

- Headlines are **editable** — user can retype one before selecting it. Send whatever string is on screen; that exact text opens the post.
- Selection is free-form: any subset, any order. No minimum beyond one.
- Duplicate selections → `400`. De-duplicate client-side before submitting.
- Show a **"Generate more"** button that calls the same endpoint with `count` (smaller number) + all current headlines in `exclude`.
- User can also **add a custom headline** via an input field — just push it into the client-side array.

---

## Step 3 — Write the Posts

Send the selected headlines **in the order they should be published** — that order also assigns the suggested publish times.
Returns **202 immediately** — writing happens in the background.

### Request

```
POST .../content/plans/{plan_id}/generate/
```

```json
{
  "headlines": [
    "Most founders hire sales too early.",
    "Churn isn't a retention problem.",
    "Nobody needs another dashboard."
  ],
  "tone": "conversational",
  "length": "medium",
  "use_ai_image": true
}
```

### Response

```json
{ "status": "queued" }
```

### Full request body (confirmed from swagger)

```json
{
  "count": 7,
  "headlines": ["string"],
  "tone": "string",
  "length": "string",
  "use_emoji": false,
  "use_ai_image": true,
  "writer_model": "",
  "tone_document": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "style_document": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tone_text": "string",
  "style_text": "string"
}
```

### Field rules

| Field | Type | Rules | Notes |
|---|---|---|---|
| `headlines` | string[] ≤20 · each ≤300 chars | Optional | Publication order. Omit for legacy path (`count` posts, model-written openers). |
| `count` | integer 1–20 | Default 7 · **ignored when `headlines` present** | Do NOT send `count` on this path. |
| `tone` · `length` | string | Optional | Unchanged from before. |
| `use_emoji` | boolean | Default `false` | Whether to include emojis in generated posts. |
| `use_ai_image` | boolean | Default `true` | Images arrive separately — poll `image_status`. |
| `writer_model` | string | Optional | Model override. Empty string = default model. |
| `tone_document` · `style_document` | uuid | Optional · one form per kind | Sending both forms for one kind → `400`. |
| `tone_text` · `style_text` | string | Optional · one form per kind | |

### Headline is guaranteed verbatim

The selected text is written into the post by the backend — the AI cannot reword or re-punctuate it.
`post.body` starts with the headline exactly, followed by a blank line.
`post.headline` holds the same string.

---

## Step 4 — Poll, Approve, Schedule

Drafts appear **one by one** (each headline is written by its own background call). Poll until the count matches how many headlines were sent.

### Poll

```
GET .../content/posts/?plan={plan_id}&state=agent    (every ~3s)
```

### Post shape (new fields highlighted)

```json
{
  "id": "7c2a…",
  "state": "agent",
  "plan": "9f1c…",
  "headline": "Churn isn't a retention problem.",
  "body": "Churn isn't a retention problem.\n\nIt's…",
  "suggested_publish_at": "2026-08-04T06:00:00Z",
  "scheduled_at": null,
  "status": "draft",
  "image_status": "pending",
  "hashtags": ["saas"],
  "cta": "What's worked for you?"
}
```

### Approve

```
POST posts/{id}/approve/        (no body)
```

### Schedule — accept the suggested time

```
POST posts/{id}/schedule/
{}
```

`scheduled_at` is now optional. Empty body → `scheduled_at = suggested_publish_at`.

### Schedule — override the time

```
POST posts/{id}/schedule/
{ "scheduled_at": "2026-08-06T09:00:00Z" }
```

`suggested_publish_at` is preserved so you can still show both.

### Status flow

```
draft → approved → scheduled → published
                              ↘ failed → retry
```

### Scheduling errors

```
400 { "detail": "Post must be approved first." }        // schedule before approve
400 { "detail": "No publish time given, and this post has no suggested time. Send `scheduled_at`." }
```

### A suggestion is NOT a schedule

`suggested_publish_at` is advice. The post is a `draft`, `scheduled_at` is `null`, and **nothing will publish** until a person approves and then schedules it.
Label it in the UI as **"Suggested"**, never as "Scheduled".

---

## How Suggested Times Are Picked

Slots: **08:00, 12:00, 17:00 local** to the brief's region, weekdays (Mon–Fri) only, spread across the `days` window starting from when posts are generated. Times returned in UTC.

**Example — 12 headlines, 7-day brief, Europe/Berlin:**

7 days = 5 weekdays. 12 ÷ 5 = 2 each, remainder 2 → the two earliest days get a third post.

| MON | TUE | WED | THU | FRI | SAT | SUN |
|---|---|---|---|---|---|---|
| 08:00 | 08:00 | 08:00 | 08:00 | 08:00 | — | — |
| 12:00 | 12:00 | 12:00 | 12:00 | 12:00 | — | — |
| 17:00 | 17:00 | — | — | — | — | — |

- Headline order = calendar order
- Extras go to the earliest days
- Times returned in UTC

> **Known gap — Gulf workweek**: Weekend is currently hardcoded to Sat/Sun. For regions running Sun–Thu, a suggestion can land on a local weekend. Users can override when scheduling; don't present the suggestion as authoritative for those regions.

---

## Regenerating a Post

```
POST .../content/posts/{id}/regenerate/     (synchronous ~10-25s · 200)
```

| You send | Result | Use it for |
|---|---|---|
| nothing | Headline kept, body rewritten | "Didn't land but hook is right" — common case |
| `{ "headline": "New line." }` | Headline replaced, body rewritten to match | Editing the hook without restarting the flow |
| `{ "headline": "" }` | Headline dropped, model writes its own opener | Turning a headline post into an ordinary one |
| `{ "mode": "extend" }` | Headline + body preserved, new text appended | "Make Longer" — `headline` is ignored |

**The calendar survives a rewrite**: regenerating returns post to `draft` and clears `scheduled_at` — new content needs a new approval. But `suggested_publish_at` is **kept**, so the user doesn't lose their slot by fixing a typo.

---

## What Didn't Change (Backwards Compatibility)

Every change is additive. Nothing renamed, removed, or given a new type.

| Concern | Status |
|---|---|
| `batch` on plans | Still a uuid. Now it is the brief's id, but type/field name unchanged. |
| `POST plans/` with empty body | Still works. You get an empty brief, no suggested times, today's behaviour. |
| `plans/{id}/generate/` without `headlines` | Behaves exactly as before (legacy path). |
| `posts/{id}/schedule/` with explicit `scheduled_at` | Works as always. |
| Removed fields | None. No path, schema, field, or enum value was removed. |

---

## Types

### PlanningBrief

```ts
interface PlanningBrief {
  id: string;                     // uuid
  target_audience: string | null;
  region: string | null;          // IANA timezone e.g. "Europe/Berlin"
  days: number;                   // 1–90, default 7
}
```

### MarketingPlan (updated — confirmed swagger)

```ts
interface MarketingPlan {
  id: string;                     // uuid
  batch: string;                  // uuid = brief.id
  brief: PlanningBrief;           // inlined on GET plans/
  linkedin_profile: string | null;// uuid of LinkedInProfile, not a URL
  title: string;
  angle: string;
  target_audience: string;        // narrower than brief.target_audience
  rationale: string;
  pillars: string[];
  sample_hooks: string[];
  cadence: string;
  created_at: string;             // ISO datetime
}
```

### PaginatedPlans (GET plans/ response)

```ts
interface PaginatedPlans {
  count: number;
  next: string | null;
  previous: string | null;
  results: MarketingPlan[];
}
```

### HeadlinesRequest / HeadlinesResponse

```ts
interface HeadlinesRequest {
  count?: number;    // 1–20, defaults to brief.days
  exclude?: string[];// ≤50 items — send ALL current headlines on "Generate more"
}

interface HeadlinesResponse {
  headlines: string[];
}
```

### GenerateFromPlanRequest (confirmed swagger)

```ts
interface GenerateFromPlanRequest {
  count?: number;           // default 7, ignored when headlines present
  headlines?: string[];     // selected headlines in publication order
  tone?: string;
  length?: string;
  use_emoji?: boolean;      // default false
  use_ai_image?: boolean;   // default true
  writer_model?: string;    // empty = default model
  tone_document?: string;   // uuid — one form per kind
  style_document?: string;  // uuid — one form per kind
  tone_text?: string;       // one form per kind
  style_text?: string;      // one form per kind
}
```

### PostType (new fields added in V2)

```ts
// All existing fields unchanged. New additions:
interface PostType {
  headline: string | null;              // verbatim first line, guaranteed
  plan: string | null;                  // uuid of MarketingPlan
  suggested_publish_at: string | null;  // ISO UTC — label as "Suggested" in UI, NOT "Scheduled"
  cta: string | null;                   // call-to-action string
  state: "agent" | "manual";           // which mode created the post
}
```

---

## API Endpoints Summary

All under `/api/v1/workspaces/{workspace_pk}/content/`

| Method | Endpoint | Response | Timing | Notes |
|---|---|---|---|---|
| `GET` | `plans/` | 200 paginated | sync | Returns latest batch with `brief` inlined. Supports `?page=&page_size=` |
| `POST` | `plans/` | 201 plan | sync ~5-15s | Body: `{ target_audience?, region?, days? }`. Generates 3 plans. |
| `POST` | `plans/{id}/headlines/` | 200 `{ headlines[] }` | sync ~5-10s | Body: `{ count?, exclude? }`. First call: `{}`. Generate more: include `exclude`. |
| `POST` | `plans/{id}/generate/` | 202 `{ status }` | async → poll | Body: `{ headlines[], use_emoji?, use_ai_image?, writer_model?, … }` |
| `GET` | `posts/?plan={id}&state=agent` | 200 paginated | poll ~3s | Drafts appear one by one as background jobs complete |
| `POST` | `posts/{id}/approve/` | 200 | sync | No body |
| `POST` | `posts/{id}/schedule/` | 200 | sync | `{}` = use suggestion · `{ scheduled_at }` = override |
| `POST` | `posts/{id}/regenerate/` | 200 | sync ~10-25s | `{}` / `{ headline }` / `{ mode: "extend" }` |

---

## UI Implementation Checklist

- [ ] **Planning Brief form**: target audience text input, IANA timezone picker (not country dropdown), days integer input (1–90, default 7)
- [ ] Show spinner on `POST plans/` (~5-15s) — display 3 plan cards on response
- [ ] **Plan selection**: user picks one plan card
- [ ] Show spinner on `POST plans/{id}/headlines/` (~5-10s)
- [ ] **Headlines list**: render each headline as an editable text field + checkbox
- [ ] "Generate more" button → calls same endpoint with smaller `count` + all current headlines in `exclude` → appends to list
- [ ] "Add custom" button → push empty editable row into client array
- [ ] De-duplicate selected headlines client-side before sending to step 3
- [ ] Show selected count (e.g. "7 selected")
- [ ] Send selected headlines in desired **publication order** to `POST plans/{id}/generate/`
- [ ] On 202: start polling `GET posts/?plan={id}&state=agent` every ~3s
- [ ] Show posts progressively as they arrive (one by one)
- [ ] Show `suggested_publish_at` labelled as **"Suggested"** (never "Scheduled")
- [ ] Approve button → `POST posts/{id}/approve/`
- [ ] Schedule button → `POST posts/{id}/schedule/` with `{}` (uses suggestion) or with override datetime
- [ ] Stop polling when `count(posts) === count(headlines sent)`
- [ ] Gulf workweek caveat: if region is Sun–Thu zone, warn user suggestion may fall on their local weekend
