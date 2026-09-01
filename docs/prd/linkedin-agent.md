# LinkedIn Agent — Integration Reference

## Overview

One prompt box, one conversation. User types what they want, agent asks clarifying questions if needed, then writes LinkedIn post drafts. Nothing publishes without the same approve → schedule gate as every other post.

A finished conversation stays open — sending another message edits the drafts already written instead of starting a new batch.

---

## Base URL

```
/api/v1/workspaces/{workspaceId}/agent/
```

All requests require `Authorization: Token <key>`. A workspace the user does not own returns `404` (never `403`).

---

## All Endpoints

### Conversation endpoints

| Method | Path | Returns | Notes |
|---|---|---|---|
| `POST` | `conversations/` | `201` + conversation | No body |
| `GET` | `conversations/` | `200` + paginated list | No transcripts in list |
| `GET` | `conversations/{id}/` | `200` + full conversation | Polling endpoint |
| `POST` | `conversations/{id}/messages/` | `202` + `run_id` | Async |
| `POST` | `conversations/{id}/answer/` | `202` + `run_id` | Async |
| `POST` | `conversations/{id}/cancel/` | `200` + conversation | Idempotent |
| `DELETE` | `conversations/{id}/` | `204` | Deletes transcript too |

### Settings

| Method | Path | Notes |
|---|---|---|
| `GET` | `settings/` | Returns composer toggles |
| `PATCH` | `settings/` | Partial — send only changed fields |

### Posts

| Method | Path | Notes |
|---|---|---|
| `GET` | `/workspaces/{id}/content/posts/` | Use `?state=agent` to get agent drafts |

---

## Request / Response Shapes

### `POST conversations/` — Create
**Body:** none

**Response `201`:**
```json
{
  "id": "f4d60d20-7daa-47d1-b715-31d1b1a1856c",
  "status": "draft",
  "intent": "unknown",
  "grounding": "unknown",
  "title": "",
  "messages": [],
  "pending_interrupt": {},
  "artifacts": { "post_ids": [] },
  "created_at": "2026-09-01T09:33:44.583173Z",
  "updated_at": "2026-09-01T09:33:44.583173Z"
}
```

---

### `GET conversations/` — List (History)
**Query params:** `page` (int), `page_size` (int, default 25)

**Response `200`:**
```json
{
  "count": 123,
  "next": "http://.../?page=4",
  "previous": "http://.../?page=2",
  "results": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "status": "completed",
      "intent": "post",
      "grounding": "knowledge",
      "title": "my technical skills",
      "created_at": "2026-09-01T12:36:41.814Z",
      "updated_at": "2026-09-01T12:36:41.814Z"
    }
  ]
}
```
> No `messages` or `pending_interrupt` in list items.

---

### `GET conversations/{id}/` — Poll
**Body:** none

**Response `200`:**
```json
{
  "id": "f4d60d20-7daa-47d1-b715-31d1b1a1856c",
  "status": "awaiting_input",
  "intent": "post",
  "grounding": "unknown",
  "title": "my technical skills",
  "messages": [
    {
      "id": "36321d90-a954-4348-aebb-2e503eeb519a",
      "role": "user",
      "kind": "text",
      "text": "write a few posts about my technical skills…",
      "payload": {},
      "created_at": "2026-09-01T09:34:52.480287Z"
    }
  ],
  "pending_interrupt": {
    "id": "45fb6c398cd543e1aebdf2fed9d30e57",
    "kind": "questions",
    "questions": [ /* see Questions shape below */ ]
  },
  "artifacts": { "post_ids": ["a1…", "b2…"] },
  "created_at": "2026-09-01T09:33:44.583173Z",
  "updated_at": "2026-09-01T09:34:52.480287Z"
}
```

---

### `POST conversations/{id}/messages/` — Send Message
**Body:**
```json
{ "text": "write a few posts about my technical skills, make them longer and use emoji" }
```
- `text` required, non-blank, max **4000** characters

**Response `202`:**
```json
{ "run_id": "0f1c0f4e-6a2e-4b31-9f0a-2b0a5f2e5c11" }
```
> `run_id` is for correlation only — no endpoint accepts it.

**409 errors:**
```json
{ "detail": "This conversation is already working on something. Wait for it to finish, or cancel it." }
{ "detail": "This conversation is waiting on an answer. Reply to the pending question, or cancel it." }
{ "detail": "This conversation has been archived. Start a new one." }
```

---

### `POST conversations/{id}/answer/` — Answer Questions
**Body:**
```json
{
  "interrupt_id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "answers": {
    "clarifier_0": "Generative AI development — LLM integrations and RAG",
    "grounding_gap": "write it from my message alone"
  }
}
```
- `interrupt_id` = `pending_interrupt.id` verbatim
- `answers` keyed by each question's `id`
- Answer all questions in one request (max 40 keys)

**Response `202`:**
```json
{ "run_id": "..." }
```

**409 errors:**
```json
{ "detail": "That answer is for a question this conversation has moved on from. Reload it to see what it is waiting on." }
{ "detail": "This conversation is not waiting on an answer." }
```

---

### `POST conversations/{id}/cancel/` — Cancel
**Body:** none

**Response `200`** — full conversation object (same shape as GET `conversations/{id}/`)

---

### `GET / PATCH settings/` — Composer Toggles
**Response `200` / PATCH body (partial):**
```json
{
  "use_emoji": false,
  "use_knowledge": true,
  "use_ai_image": false,
  "make_longer": false
}
```
- PATCH is partial — send only what changed
- These are defaults; the prompt outranks them for a specific generation

---

### `GET content/posts/?state=agent` — Agent Drafts
**Query params:**
- `state=agent` — required to get agent posts
- `status` — filter by lifecycle: `draft`, `approved`, `scheduled`, `published`, `failed` (comma-separable)
- `exclude_status` — exclude statuses (comma-separable)
- `page`, `page_size`

**Response `200`** (paginated):
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "state": "agent",
      "website_profile": null,
      "plan": null,
      "reference_link": null,
      "tone": "professional",
      "length": "short",
      "use_emoji": true,
      "use_knowledge": true,
      "length_hint": "",
      "writer_model": "gemini-2.5-pro",
      "headline": "",
      "body": "Most GenAI demos hide a dirty secret. 🤫",
      "body_blocks": "[{\"type\":\"paragraph\",\"spans\":[{\"text\":\"Most GenAI demos hide a \"},{\"text\":\"dirty secret\",\"bold\":true},{\"text\":\". 🤫\"}]}]",
      "hashtags": "",
      "cta": "",
      "image_url": "",
      "image_file": null,
      "image_status": "none",
      "video_url": "",
      "video_file": null,
      "media_type": "",
      "status": "draft",
      "scheduled_at": null,
      "suggested_publish_at": "2026-09-03T09:00:00Z",
      "published_at": null,
      "linkedin_urn": "",
      "engagement": {
        "impressions": 0,
        "likes": 0,
        "comments": 0,
        "rate": 0,
        "synced_at": null
      },
      "created_at": "2026-09-01T09:36:00Z"
    }
  ]
}
```

---

## Types

### Conversation Status

| Value | Meaning | UI action |
|---|---|---|
| `draft` | Created, no message yet | Empty composer |
| `running` | Turn executing | Spinner, send disabled, show Cancel |
| `awaiting_input` | Suspended on questions | Render `pending_interrupt` |
| `completed` | Turn finished — resting, not terminal | Show drafts; box stays open for edits |
| `failed` | Turn died (vendor error / timeout) | Show last agent message; user can resend |
| `cancelled` | User pressed stop | Terminal |
| `archived` | Swept after 7 days awaiting answer | Terminal; offer new conversation |

### Message Kinds

| `kind` | `role` | `payload` |
|---|---|---|
| `text` | user / agent | `{}` or `{ interrupt_id, answers }` on an answer message |
| `posts` | agent | `{ post_ids: string[] }` |
| `edit` | agent | `{ post_ids: string[], field: "text" \| "image" }` |
| `error` | agent | `{}` |

> A user's answer is a `user/text` message with **empty `text`** — render from `payload.answers`, not from `text`.

### Question Shape (inside `pending_interrupt.questions[]`)

| Field | Notes |
|---|---|
| `id` | Key used in `answers` object |
| `question` | Text to display |
| `kind` | `choice`, `number`, or `text` |
| `options` | Array of option strings — present on `choice` |
| `default` | Pre-select this value — may be absent |
| `allow_free_text` | `true` → also show a text input alongside options |
| `min` / `max` | Present on `kind: "number"` only |
| `suggested_topics` | On `grounding_gap` only — options minus the first entry |
| `url` | On `link_role_*` only |

**Question IDs you will actually see:**

| `id` | Triggered when |
|---|---|
| `count` | Message didn't specify how many posts |
| `tone` | Tone not stated |
| `length` | Length not stated and make_longer off |
| `intent` | Agent couldn't determine this was a post request |
| `grounding` | Agent couldn't tell whether to use KB or message alone |
| `grounding_gap` | KB cannot ground this topic |
| `link_role_0…` | URL in message could be subject or voice sample |
| `clarifier_0…2` | Agent-written: audience, launch, angle, etc. |
| `edit_target` | Edit turn couldn't tell which draft to edit |

> `emoji`, `knowledge`, `AI image`, `make_longer` are **never asked** — always resolved from settings.

> Max **2 rounds** of questions per conversation. After the cap, agent uses each question's `default` and writes.

### body_blocks (JSON string — must `JSON.parse`)

```ts
type SpanNode = { text: string; bold?: boolean };

type BlockNode =
  | { type: "paragraph"; spans: SpanNode[] }
  | {
      type: "list";
      marker: "-" | "*" | "•" | "→";
      tight: boolean;           // true = no blank line above this block
      items: { spans: SpanNode[] }[];
    };
```

**Rendering rules:**
- Render from parsed `body_blocks`; fall back to `body` if array is empty
- Blocks separated by a blank line unless `tight: true`
- Bold spans → render as `<strong>` (published as Unicode math-bold)
- Span `text` may contain `\n` — soft line break

---

## The Polling Loop

```
1. POST conversations/                    → id
2. POST conversations/{id}/messages/      → 202
3. GET  conversations/{id}/  every ~2s
      "running"        → keep polling
      "awaiting_input" → show question form (pending_interrupt)
      "completed"      → fetch posts from GET content/posts/?state=agent
      "failed"         → show last agent message, allow resend
      "cancelled"      → terminal, offer new conversation
      "archived"       → terminal, offer new conversation
4. If awaiting_input:
   POST conversations/{id}/answer/        → 202, back to step 3
```

---

## Error Handling

| Status | Shape | Trigger |
|---|---|---|
| `400` | DRF field errors | Blank text, >4000 chars, missing interrupt_id |
| `404` | `{ "detail": "Not found." }` | Unknown workspace or conversation |
| `409` | `{ "detail": "…" }` | Lifecycle conflict (see sentences above) |
| Vendor failure | No HTTP error — `status` becomes `failed`, agent message in transcript | Mid-turn model error |

> No `503` in agent mode — every model call happens after `202` was already sent.
> A stuck worker is swept within ~5 min (stuck = >20 min). Show Cancel whenever `status == "running"`.

---

## UI Checklist (from backend dev)

- [ ] Poll `GET {id}/` every ~2s while `running`; stop on any other status
- [ ] Send disabled unless `status` is `draft` or `completed`
- [ ] Cancel button visible while `running` and `awaiting_input`
- [ ] Question form rendered generically from `kind` / `options` / `allow_free_text`, with `default` pre-selected
- [ ] `interrupt_id` echoed verbatim; on a `409` re-`GET` and re-render instead of retrying
- [ ] `artifacts.post_ids` order preserved — it is the numbering the user and agent mean by "post 2"
- [ ] Drafts rendered from `body_blocks` (JSON.parse), falling back to `body`
- [ ] `409` and `404` handled distinctly from `400`
- [ ] Settings (`GET/PATCH settings/`) wired to Composer Settings toggles
- [ ] History button wired to `GET conversations/` paginated list

---

## Worked Example

```
POST   conversations/                                         201  id=f4d6…
POST   conversations/f4d6…/messages/                         202
       { "text": "write posts about my technical skills, longer, with emoji" }

GET    conversations/f4d6…/                                  200  status=running
GET    conversations/f4d6…/                                  200  status=awaiting_input
       pending_interrupt: 3 clarifier questions (id=6032…)

POST   conversations/f4d6…/answer/                           202
       { "interrupt_id": "6032…",
         "answers": { "clarifier_0": "Generative AI",
                      "clarifier_1": "Recruiters",
                      "clarifier_2": "Cutting inference cost with RAG" } }

GET    conversations/f4d6…/                                  200  status=awaiting_input
       pending_interrupt: grounding_gap question (id=45fb…)

POST   conversations/f4d6…/answer/                           202
       { "interrupt_id": "45fb…",
         "answers": { "grounding_gap": "write it from my message alone" } }

GET    conversations/f4d6…/                                  200  status=completed
       artifacts.post_ids = ["a1…","b2…","c3…"]

GET    content/posts/?state=agent                            200  3 drafts with body_blocks

POST   conversations/f4d6…/messages/                         202
       { "text": "make post 2 longer" }                           ← edits, not a new batch
```
