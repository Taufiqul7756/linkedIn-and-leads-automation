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

## V2 — Agent Mode Integration (see also: `docs/api-reference.md`)

> Full spec in `docs/api-reference.md` (Part 1 — LinkedIn Agent). Summary of what changed from V1:

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
- **Suggest more headlines** (button label: "Suggest more concepts/ideas"): next to "+ Add concept/idea" (`LuSparkles`), separated by a thin vertical divider, shown only when `pending_interrupt.can_generate_more === true`. Click → `answerQuestion` with `{ more_headlines: true, headlines: <current list on screen> }` (edits/deletions/custom lines included, blanks dropped) → conversation runs → new headlines interrupt arrives. `HeadlinesForm` is keyed by `pending_interrupt.id` so it remounts with the fresh list
- **Seamless "suggest more"**: the card never disappears. On click, a snapshot `{ convId, interruptId, headlines, canGenerateMore }` keeps the card rendered while the conversation is `running`; the generic `ThinkingIndicator` (agent ping) is hidden for that run. Inside the card: button shows spinner + "Suggesting…", 3 pulsing skeleton rows appear under the list, inputs / remove / Add concept/idea / Generate drafts are disabled. When the new headlines interrupt arrives, the card remounts with the new list and lines not in the sent list fade in (`animate-fade-in-up`). Snapshot is cleared when status leaves `running` (new headlines, failure, cancel) or if the answer request fails. Reloading mid-run shows the normal running indicator once

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

### Writer Model Picker

Pill next to the settings gear in the composer bottom bar — same design as the image-chat model picker (`LuCpu` fallback avatar, violet active state; the API sends no model images).

- Source: `GET agent/settings/` → `ai_models` (grouped by provider: `anthropic`, `deepseek`, `gemini`, …) + `writer_model`. Active model = `writer_model`, falling back to the item with `selected: true`
- Menu opens upward: "AI model" header + ✕, then **provider tabs** (`MODEL_PROVIDER_LABELS`, unknown keys capitalized) — one tab per `ai_models` key; a violet dot marks the tab holding the selected model. Opens on that tab each time. Tab body lists that provider's models: label + `model_id` + round check; scrolls past `max-h-80`
- Select → optimistic cache write → `PATCH agent/settings/ { writer_model }` → `invalidateQueries(["agent-settings", workspaceId])`. Error → cache reverted + toast
- Disabled while the conversation is `running` / `awaiting_input` / generating more drafts. Hidden when `ai_models` is empty
- Settings are a React Query (`["agent-settings", workspaceId]`) via `useAgentSettings` — the composer toggles use the same optimistic write + invalidate

### Audience & Post Length

**Composer settings popover** — two toggles, same row style as "Use hashtags":
- **Use target audience** → `PATCH { use_target_audience }`
- **Use post length** → `PATCH { use_post_length }`

**Knowledge base modal** — third card "Audience & Length" under Tone / Style (`AudienceLengthSection.tsx`):
- **Target audience** — text input, auto-saves `PATCH { target_audience }` 600ms after typing stops, on blur, on Enter, and on modal close (pending value flushed). Shows "Saving…" → "Saved". Value is trimmed; unchanged values are not re-sent
- **Post length** — pills: Short → `"100 words"` · Medium → `"200 words"` · Long → `"300 words"` · Let agent decide → `""`. Click saves immediately and clears the custom box
- **Custom post length** — free-text input under the pills (e.g. "150 words"); sent as-is in `post_length` with the same autosave as target audience. Clearing it saves `""` (Let agent decide)
- **Length tip** — blue info line under the custom box: LinkedIn allows up to 3,000 characters per post (about 450–550 words)
- Selected state is derived on the frontend from the saved `post_length` string (no option field in the API): a preset value highlights its pill with the box empty; any other value shows in the custom box with no pill highlighted. While typing a custom value, no pill is highlighted
- Fields stay editable when the matching toggle is off — a hint says to turn it on in composer settings

**State** — composer and modal share `useAgentSettings(workspaceId)` (`src/hooks/useAgentSettings.ts`): React Query `["agent-settings", workspaceId]`, save = optimistic cache write → PATCH → invalidate; on error only the touched fields roll back + toast. Selections therefore survive closing the modal and page reload

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
- Time row: `LuPencil` icon → opens a **dedicated time-edit modal** (`<Modal width="sm">`) with a `datetime-local` input; saves via `patchPostRaw` (`PATCH posts/{id}/ { suggested_publish_at }`)
  - **Past date validation**: if backend returns `400 { suggested_publish_at: [...] }`, modal stays open and shows an inline red error under the input — no toast. Error clears when the user edits the input.
- Delete (reject) flow: clicking the `LuX` floating button sets `rejectConfirmPost` state → `RejectConfirmModal` confirmation before calling `onReject`
- `LuCheck` floating button (top-right, `-translate-y-1/2`): approves post via `approvePost` (uses `postRaw` — throws on error); no confirmation required
  - **Past date on approve**: if backend returns `400 { suggested_publish_at: [...] }` → toast shows the error + Edit Suggested Publish Time modal auto-opens for that post pre-filled with its current `suggested_publish_at`

### Edit with Agent Flow (Review & Approval → Agent Page)

When the user clicks **Edit with agent** on a Review & Approval card:

1. `window.location.href = /linkedin/automation?editPostId=<id>` — hard navigation (full remount)
2. Agent page restore effect detects `?editPostId=` param → skips last-conv restore; fetches the post; stores in `editDraftPost` state; keeps `editPostId` in URL
3. Blank chat area renders the fetched `DraftCard` above the message input
4. User types a prompt and sends → conversation is created → `?conv=<id>` replaces `?editPostId=` in URL
5. `handleNewChat()` clears `editDraftPost` state

### Review & Approval Section (`ReviewApprovalSection.tsx`)

Renders a paginated grid of draft post cards for human review. Used in both agent mode and manual mode (controlled by `mode` prop).

- **Approve button** (`LuCheck`, top-right floating, `-translate-y-1/2`): calls `approvePost` (uses `postRaw` — throws on error)
  - **Past date on approve**: `400 { suggested_publish_at: [...] }` → toast with the error message + Edit Suggested Publish Time modal auto-opens pre-filled with the post's current `suggested_publish_at`
- **Edit Suggested Publish Time modal**: `datetime-local` input; saves via `patchPostRaw`
  - **Past date validation**: `400 { suggested_publish_at: [...] }` → modal stays open, inline red error under the input, no toast. Clears on input change or modal close.
- Conversation filter dropdown: filters drafts by `?conversation=<id>` query param; "All conversations" = no filter
- Paginated with `PAGE_SIZE_OPTIONS = [4, 8, 12, 16, 20]`
- Hover buttons (bottom-right): **Edit text** → `EditPostModal` · **Edit image** → `/linkedin/edit-image/[postId]?from=review` · **Edit with agent** → `/linkedin/automation?editPostId=<id>` or `?conv=<id>` if the post has a `single_post_conversation_id`

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

### Generate More Drafts

"Generate more drafts" link under every `kind="posts"` DraftsSection — adds drafts to that same message without restarting the flow.

**API:** `POST conversations/{id}/messages/ { "more_drafts": true, "message_id": "<posts message id>" }` → `202`, then the normal poll. Backend appends the new post ids to the **same** message's `payload.post_ids`.

**UI (mirrors "Suggest more concepts/ideas"):**
- Blue text link with `LuSparkles`; while running → `LuLoader` spinner + "Generating…"
- Shown only when `conversation.has_multiple_post` (hidden in single-post edit-with-agent conversations)
- Enabled only when the conversation is idle (`completed` / `failed` / `cancelled`), no send in flight, no pending attachments
- On click: existing cards stay in place, locked (`pointer-events-none`); `settings.post_count` skeleton cards append to the end of the carousel, which smooth-scrolls to show them
- No `ThinkingIndicator` / agent ping during this run — the skeletons are the only loading signal
- Composer (textarea, Send) disabled for the whole run; Cancel still available
- Selected draft (targeted prompting) is cleared on click

**State (`AutomationView`):**
- `moreDrafts: { convId, messageId } | null` — set on click; cleared only after `fetchPosts` resolves on completion, so skeletons swap straight to real cards (no blink). Also cleared on failure/cancel, on request error (toast), and when switching conversations
- `moreDraftsBaseline: { messageId, postIds }` — post ids before the click; cards not in it get `animate-fade-in-up`

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

Full spec: `docs/api-reference.md` (Part 2 — Image Chat)

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
- `image.status === "ready"` → show `<img>` + Add to post button
- `image.status === "failed"` → show text only (backend rewrites the message text)

### Image sizing (natural aspect ratio)
Images are never forced into a fixed box or cropped — landscape, portrait and square all render at their real ratio.
- **Chat card**: card shrinks to the image (`w-fit`, max width 26rem, max height `--chat-image-max-h`). Until the `<img>` fires `onLoad`, a 16:9 spinner placeholder holds the space; Add/Download buttons appear only after load.
- **LinkedIn post preview**: full width, natural height.
- **Lightbox**: natural ratio, capped at `max-w-2xl` and `--lightbox-image-max-h`.
- Media list thumbnails stay fixed squares (`object-cover`).
- Size tokens live in `globals.css`.

### Add to post
- Calls `add_to_post` → returns updated chat with new `post_image_url`
- Preview and media section both read `chat.post_image_url` — update automatically
- Delete image: `PATCH /content/posts/{id}/ { image_url: "" }` then clear local chat state

### Chat auto-scroll
- On page load the chat opens already at the latest message (instant jump, no visible scroll through history)
- The view stays pinned to the bottom while images finish loading and grow the list
- New messages smooth-scroll into view while pinned; scrolling up unpins (polling updates won't yank the user down)
- Sending a message or clicking "Scroll to newest" re-pins

### Reload persistence
- Preview persists after reload: `chat.post_image_url` is always returned by API
- Media section persists after reload: reads `chat.post_image_url` directly (not local `addedImageId`)
- "Added" button state persists after reload: on `openChat` response, find `c.images.find(img => img.is_added_on_post)` and set `addedImageId` to its id

### Optimistic send
User's typed message is appended to `chat.messages` immediately (before API response). On success, server response replaces state wholesale. On error, optimistic message is removed and input is restored.

### ImageThinkingSteps (shown while `image.status === "pending"`)
- No card wrapper — steps render inline, no border/shadow/background
- 4 steps with a label + detail subtitle each, appearing one by one with fade+slide-up animation
- Timing: 0 ms → 1500 ms → 3200 ms → 5000 ms
- Steps: "Thought process" / "Image plan ready" / "Rendering image" / "Image ready"

### Scroll to newest button
- Floats at top of chat scroll area (absolute positioned)
- Visible only when user has scrolled up >120px from bottom
- Clicking scrolls `messagesEndRef` into view (smooth)

### Chat input toolbar
- **Auto-growing textarea** (same behaviour as the LinkedIn Agent composer): starts at 2 rows; an effect on `input` sets `height = min(scrollHeight, lineHeight × CHAT_INPUT_MAX_ROWS)` (8 rows ≈ 160px, same cap as the LinkedIn Agent; `lineHeight` read from the textarea via `getComputedStyle`, no CSS token dependency), so it grows upward line by line until the cap, after which it stops growing and the text scrolls inside (`overflow-y-auto`). Shrinks back to 2 rows when the input is cleared on send
- Emoji button (`LuSmile`) and file/attachment button (`LuPaperclip`) are **disabled** — `cursor-not-allowed`, greyed out, show a "Soon" tooltip on hover
- Send button: `bg-violet-600`, disabled while `!input.trim() || isSending || isChatRunning`
- **"AI generated image" suggestion** (`AiImageSuggestion`): plain text line (no bubble, no shadow, no avatar; indented to align with agent content, `pb-6` bottom space) rendered after the last message — _"Next, I could generate another image for you. Just click on this: **AI generated image**"_ — with the link text clickable (blue, underlined). UI-only (not persisted, not part of `chat.messages`). Shown only when the last message is from the agent, chat is idle (`!isSending && !isChatRunning`) and the post is not published. Click sends the fixed prompt `"Make Ai generated image"` through the same `POST image-chats/{id}/messages/` call as a typed prompt — same optimistic append + polling flow; does not touch the textarea
- **Image settings are per chat**: loaded via `GET image-chats/settings/{chatId}/` once the chat is open (`chat.id`); all changes go through `saveImgSettings(next, patch)` — optimistic local update, `PATCH` with only the changed field, rollback + toast on failure. Applies to the "Use post body" toggle, model, and ratio
- **AI model button** (active model's image via `ModelAvatar` + title + chevron that rotates when open, left of Settings; violet border/tint while open): opens a popover styled like "Image agent settings" with an "AI model" header + subtitle (click-outside closes). Lists `ai_model[]` — `ModelAvatar` (`image`, fallback `LuCpu` icon) + title + `model_name` subtext + radio-style indicator (filled violet circle with check when active); active row gets a violet border + tint. Clicking a model PATCHes `{ ai_model: model_name }` and closes the popover
- **Image style button** (`LuPalette` + active style title, or "Style" when None; chevron; between AI model and Image ratio): same popover pattern as AI model, "Image style" header + subtitle (click-outside closes). Lists `image_style[]` in a scrollable list (`max-h-80`), with "None" always pinned first and followed by a divider labelled "Styles" so the no-style option stands apart — thumbnail (`image`, or `LuX` for None / `LuPalette` fallback when empty) + title + description + radio indicator. No active item (fresh chat) is treated as "None". Clicking a style PATCHes `{ image_style: title }` (`"None"` = no style) and closes the popover. "Custom" is selectable like any other style — no custom text input yet
- **Image ratio button** (`LuRatio` + active ratio, e.g. "16:9"): opens `ImageRatioModal` (`src/components/linkedin/ImageRatioModal.tsx`) — "Select Media Size" with a card per `image_ratio[]` option (preview, title, size, ratio). Preview (`RatioPreview`) shows `image` whole (`object-contain`, so a 16:9 image isn't cropped by the square tile); if `image` is empty or fails to load (`onError`), it falls back to a frame drawn in that ratio on the dark tile. Active card has a violet border + tint. No confirm button — clicking a card PATCHes `{ image_ratio: ratio }` and closes the modal. Footer: "Selected: <title>" + Cancel
- Model and ratio buttons are hidden until settings load (empty lists)
- **Image style selector — pending**: waiting on backend API returning `{ title, description, img_url, default }[]` (user can set a default). Once shipped, the selected style's title + description will be appended to every prompt (typed or AI Generated Image button)

### Workspace-switch 404 error state
- When user switches workspace while on this page, `fetchPost` re-runs with the old `postId` against the new `workspaceId`
- If the API returns 404, `postNotFound` state is set to `true`
- A full-page error UI is shown (not a toast): icon + "Post not found in this workspace" heading + explanation + two action buttons:
  - **"Go to Agent"** → `/linkedin/automation` (brand purple, primary)
  - **"Post Management"** → `/linkedin/post-management` (outlined, secondary)
- Any other error status falls through to `toast.error` as before
- `postNotFound` resets to `false` on each `workspaceId`/`postId` change

### Reaction icons (preview panel)
- Three overlapping circles (18×18px) showing Like / Support / Celebrate
- PNG assets: `public/icons/Linkedin-Like-Icon-Thumbup.png`, `Linkedin-Support-Icon-HeartinHand.png`, `Linkedin-Celebrate-Icon-ClappingHands.png`
- Background colors from CSS vars: `--reaction-like` / `--reaction-support` / `--reaction-celebrate`

### Pending backend items
1. `DELETE attachment/{id}/` — not yet available

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
