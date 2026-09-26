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
| `GET` | `/workspaces/{id}/content/posts/{postId}/` | Single post — used to check `conversation_id` before edit-with-agent |

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
  "has_multiple_post": true,
  "created_at": "2026-09-01T09:33:44.583173Z",
  "updated_at": "2026-09-01T09:34:52.480287Z"
}
```

---

### `POST conversations/{id}/messages/` — Send Message
**Body:**
```json
{ "text": "make this post very long" }
```
Optional — include `post` to target a specific draft:
```json
{ "text": "make this post very long", "post": "640658b0-8bfa-4962-86b4-29c16d770015" }
```
- `text` required, non-blank, max **4000** characters
- `post` optional — UUID of the specific draft to edit; omit to let the agent decide

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
      "conversation_id": "f4d60d20-7daa-47d1-b715-31d1b1a1856c",
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

## V2 — Agent Mode Integration (see also: `docs/agent-mode-integration.md`)

> Full spec in `docs/agent-mode-integration.md`. Summary of what changed from V1:

### New: Attachments (per-conversation sources)

- Up to **5** attachments per conversation (PDF or URL, one kind per request)
- `POST conversations/{id}/attachments/` — multipart for PDF, JSON `{ url }` for URL
- `GET conversations/{id}/attachments/` — unpaginated list
- `DELETE conversations/{id}/attachments/{aid}/` — 204
- `attachments[]` inlined in `GET conversations/{id}/` response
- Status: `pending` → `ready` | `failed`; `error` message on failed rows
- **Do not send message while any attachment is `pending`** (returns 409)
- Attachments are conversation-scoped only — not added to workspace knowledge base

### New: `kind: "headlines"` interrupt

- `pending_interrupt.kind` is now `"questions"` OR `"headlines"` — branch on `kind`
- Headlines interrupt: `{ id, kind: "headlines", headlines: string[] }` — editable list
- Answer with `{ interrupt_id, answers: { headlines: ["…", "…"] } }`
- Each string in the approved list = one post's first line; `len(answers.headlines)` = post count
- Max 10 headlines offered per round; skipped if `ignore_headline: true`

### Updated Settings Shape

Old `make_longer` boolean is **gone**. New shape:

```ts
interface AgentSettings {
  post_count: number;       // 1–20, default 5
  use_hashtags: boolean;    // default true — tags in body AND hashtags array
  use_emoji: boolean;       // default false
  use_knowledge: boolean;   // default true
  use_ai_image: boolean;    // default true — false = NO image, not even stock photo
  ignore_headline: boolean; // default false — true = skip headline round
  ignore_grilling: boolean; // default false — true = skip clarifying questions
}
```

- `use_ai_image: false` → `image_url: ""`, `image_status: "none"` — do not show image placeholder
- `use_hashtags: true` → hashtags in BOTH `hashtags` array AND last line of `body`/`body_blocks` — do NOT append array under body again

### Updated `body_blocks` Format (Tiptap ProseMirror)

`body_blocks` is now a **Tiptap ProseMirror document** (not the old custom array):

```json
{ "type": "doc", "content": [ { "type": "paragraph", "content": [...] } ] }
```

- Fall back to `body` if `body_blocks` is `{}` or empty
- Load into Tiptap editor; `PATCH` back as `body_blocks` — `body` is re-derived server-side
- Custom attrs: `bulletList.attrs.marker` (the glyph: `-`, `*`, `•`, `→`), `attrs.tight` (no blank line above)
- Pre-Tiptap array format is **rejected** with `400` on `body_blocks`

### DraftCard Hover Actions & Time Edit

`DraftCard` in `AutomationView.tsx` — shows agent-generated drafts in the composer:

- Size: `h-72 w-96`; outer wrapper has `group` class for CSS `group-hover`
- **Hover buttons** (bottom-right, `opacity-0 group-hover:opacity-100`): **Edit text** · **Edit image** — both open `EditDraftModal`
- **No "Edit with agent" button** on agent composer cards (only on Review & Approval cards)
- Time row: `LuPencil` icon → opens a **dedicated time-edit modal** (`<Modal width="sm">`) with a `datetime-local` input; saves via `PATCH posts/{id}/` `{ suggested_publish_at }`, then invalidates posts cache
- Delete (reject) flow: clicking the `LuX` floating button sets `rejectConfirmPost` state → `RejectConfirmModal` confirmation before calling `onReject`
- `LuCheck` floating button (top-right, `-translate-y-1/2`): approves post; no confirmation required

### Edit with Agent Flow (Review & Approval → Agent Page)

When the user clicks **Edit with agent** on a Review & Approval card:

1. `window.location.href = /linkedin/automation?editPostId=<id>` — hard navigation (full remount)
2. Agent page restore effect detects `?editPostId=` param → skips last-conv restore; fetches the post; stores in `editDraftPost` state; keeps `editPostId` in URL
3. Blank chat area renders the fetched `DraftCard` above the message input
4. User types a prompt and sends → conversation is created → `?conv=<id>` replaces `?editPostId=` in URL
5. `handleNewChat()` clears `editDraftPost` state

### AllDraftsModal Card Design

`AllDraftsModal` (`src/components/linkedin/AllDraftsModal.tsx`) — shows all drafts across conversations:

- `MiniCard` now matches `DraftCard` design exactly: `h-72 w-full`, `group` class, same media/body/time rendering
- Floating **approve** (`LuCheck`) and **reject** (`LuX`) buttons top-right, `-translate-y-1/2` — only shown for `status === "draft"`
- Reject → `onReject` is intercepted at `AutomationView` level → sets `rejectConfirmPost` → `RejectConfirmModal` shown
- Hover buttons bottom-right: **Edit text** · **Edit image** — both call `onEdit(post)`

### Draft Card Selection for Targeted Prompting

Users can select a specific draft in the agent composer to direct the next prompt at that post only.

**Controlled by `conversation.has_multiple_post: boolean`** (from `GET conversations/{id}/`):
- `true` → checkboxes shown on all non-published cards across every message in this conversation
- `false` → no checkboxes (single-post edit-with-agent conversation — targeting is implicit)

**Checkbox behaviour:**
- Appears top-left on hover on any card where `status !== "published"`
- Applies to both `kind="posts"` DraftsSection cards AND `kind="edit"` inline cards (single-card responses after a targeted prompt)
- Single selection only — selecting a new card deselects the previous
- When selected, a "Prompting for: [headline]" pill appears above the textarea with an ✕ to deselect
- On send: `post` field included in message payload → agent edits only that post
- Selection cleared automatically after send and on `handleNewChat`

**API:** `POST conversations/{id}/messages/ { "text": "...", "post": "<postId>" }`

---

### Edit-with-Agent: Conversation Resume via `conversation_id`

`AgentPost` now carries a `conversation_id: string | null` field set by the backend once a post is linked to a conversation.

**Flow when user clicks Edit with agent:**

1. Hard navigate: `window.location.href = /linkedin/automation?editPostId=<id>`
2. Restore effect fetches the post via `GET /content/posts/{id}/`
3. **If `conversation_id` is set** → load that existing conversation (`GET conversations/{id}/`) — no new conversation created
4. **If `conversation_id` is null** → create a new conversation linked to the post (`POST conversations/ + linked_post body`)
5. In both cases: set conversation, refresh history, start polling if running

This prevents a new conversation from being created every time the user clicks Edit with agent on the same post.

**Fix: Strict Mode double-invocation guard** — `restoredForWorkspaceRef = useRef<string|null>(null)` prevents the restore effect from firing twice in React Strict Mode (dev), which previously created two conversations simultaneously.

---

### KnowledgeBaseModal Accordion Redesign

`src/components/linkedin/KnowledgeBaseModal.tsx` — used on the `/linkedin/` Agent page (not the autopilot page).

- Uses `agentService` (workspace-scoped agent endpoints, not profileService)
- Accordion sections: **Profile** (LinkedIn profiles), **Knowledge** (`purpose=knowledge` + `purpose=style`), **Tone** (`purpose=tone`)
- `DisplayPurpose = "knowledge" | "tone"` — `isTone()` maps both `"tone"` and `"style"` to the Tone section
- Type badges: www=slate, PDF=purple, DOCX=blue, TXT=gray; status badges: Ready=green, Error=red, Processing=amber
- `timeAgo()` helper for `created_at` display
- Polling: `refetchInterval` while any item non-terminal (same 3s pattern)

---

## Image Chat — Edit Image Page (`/linkedin/edit-image/[postId]`)

Full spec: `docs/image-chat-integration.md`

### Key files
- Page: `src/app/linkedin/edit-image/[postId]/page.tsx`
- Service: `src/service/imageChatService.ts`
- Types: `src/types/ImageChat.ts`

### API base
```
/workspaces/{workspaceId}/image-chats/
```

### Endpoints

| Method | Path | Returns | Notes |
|---|---|---|---|
| `POST` | `image-chats/` | `201` new / `200` existing | `{ post: id }` — one chat per post |
| `GET` | `image-chats/{id}/` | `200` full chat | Poll while `status === "running"` |
| `POST` | `image-chats/{id}/messages/` | `202` generating / `200` text-only | `{ prompt }` |
| `POST` | `image-chats/{id}/add_to_post/` | `200` full chat | `{ image: imageId }` |

### Polling rule
Poll `GET image-chats/{id}/` every 2s while `chat.status === "running"`. Stop on `"ready"`. Send button disabled while running.

### Image card states
- `image.status === "pending"` → show `ImageThinkingSteps` spinner
- `image.status === "ready"` → show `<img>` (16:9) + Add to post button
- `image.status === "failed"` → show text only (backend rewrites the message text)

### Add to post
- Calls `add_to_post` → returns updated chat with new `post_image_url`
- Preview and media section both read `chat.post_image_url` — update automatically
- Delete image: `PATCH /content/posts/{id}/ { image_url: "" }` then clear local chat state

### Reload persistence
- Preview persists after reload: `chat.post_image_url` is always returned by API
- Media section persists after reload: reads `chat.post_image_url` directly (not local `addedImageId`)
- "Added" button state on individual image cards: **pending backend fix** — needs `is_img_added: boolean` on `GeneratedImage`

### Pending backend items
1. `is_img_added: boolean` on `GeneratedImage` — true if that image is currently on the post; needed to restore "Added" button state after reload
2. `DELETE attachment/{id}/` — not yet available

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
