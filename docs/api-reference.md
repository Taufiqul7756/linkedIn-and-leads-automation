# API Reference

Full API specification for all backend services. Covers request shapes, response shapes, status codes, error bodies, and polling rules.

`baseUrl` = `https://<host>/api/v1`. Every request requires `Authorization: Token <key>`. A workspace the caller does not own returns `404` (never `403`).

---

## Table of Contents

1. [LinkedIn Agent — Conversation API](#1-linkedin-agent--conversation-api)
2. [Image Chat API](#2-image-chat-api)

---

# 1. LinkedIn Agent — Conversation API

One prompt box, one conversation. The user types what they want, attaches what they want it written from, approves the first lines, and the agent writes **draft Posts**. Nothing publishes: a draft goes through the same approve → schedule gate as every other post.

**Base path**: `{{baseUrl}}/workspaces/{{workspaceId}}/agent/`

> **What changed in V2** — read this if you already shipped V1.
>
> * `settings/` changed shape. `make_longer` is **gone**; `post_count`,
>   `use_hashtags`, `ignore_headline` and `ignore_grilling` are new.
> * `pending_interrupt.kind` is no longer always `"questions"`. A new kind,
>   `"headlines"`, offers each post's first line before it is written. Same
>   `answer/` route, different payload.
> * The headlines interrupt carries `can_generate_more`. When `true`, answer with
>   `"more_headlines": true` + the current list to get more headlines — a new
>   headlines interrupt (new `id`) comes back. Same `answer/` route.
> * Three new routes: `POST`/`GET conversations/{id}/attachments/` and
>   `DELETE conversations/{id}/attachments/{aid}/`.
> * `GET conversations/{id}/` carries a new `attachments` array.
> * One new `409` on `messages/`: a source is still being read.
> * The `count` question is gone from the question catalogue — the panel
>   answers it. So is the `grounding` question, unless the panel's
>   `use_knowledge` is off. *(Later replaced by per-source `knowledge` switches — see Knowledge switches.)*
> * **Hashtags are in the post body now.** With `use_hashtags` on, `body` and
>   `body_blocks` end with the tag line (`#saas #pricing`) as well as carrying
>   the tags in the `hashtags` array. Stop appending the array under the body
>   when you render a draft.
> * The `tone` question is asked only when the message did not state a tone,
>   and it now offers all seven `Post.Tone` values rather than four.

---

## Endpoints

| Method | Path | Returns |
|---|---|---|
| `POST` | `conversations/` | `201` + empty conversation |
| `GET` | `conversations/{id}/` | `200` + conversation, transcript, attachments, pending question, post ids |
| `POST` | `conversations/{id}/messages/` | `202` + `{"run_id": "…"}` |
| `POST` | `conversations/{id}/answer/` | `202` + `{"run_id": "…"}` |
| `POST` | `conversations/{id}/attachments/` | `201` + the attachment row |
| `GET` | `conversations/{id}/attachments/` | `200` + the list (unpaginated) |
| `DELETE` | `conversations/{id}/attachments/{aid}/` | `204` |

Also available:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `conversations/` | Paginated list, no transcripts (`page`, `page_size`, default 25) |
| `POST` | `conversations/{id}/cancel/` | Stop button. Idempotent, returns the conversation |
| `DELETE` | `conversations/{id}/` | `204`. Gone, including transcript and attachments |
| `GET`/`PATCH` | `settings/` | The composer's panel |
| `POST` | `conversations/{id}/restore/` | "Use this version" — see [Post versions](#post-versions) |

---

## The loop, in order

```
1. POST conversations/                       → id
2. POST conversations/{id}/attachments/      → 201  (optional, repeatable, max 5)
   GET  conversations/{id}/  (poll ~2s)      → attachments[].status pending → ready
3. POST conversations/{id}/messages/         → 202
4. GET  conversations/{id}/  (poll ~2s)      → status
      running         → keep polling
      awaiting_input  → render pending_interrupt by its `kind`, go to 5
      completed       → render artifacts.post_ids, done (or send another message)
      failed          → render the last agent message
5. POST conversations/{id}/answer/           → 202, back to 4
```

A conversation is created empty and does nothing until the first message. It is fine to create it when the user opens the composer — you need its id before an attachment can be uploaded anyway.

**Do not send a message while any attachment is `pending`.** It is a `409`. Disable send until every row is `ready` or `failed`.

---

## 1. Create — `POST conversations/`

No body. `201`:

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
  "attachments": [],
  "created_at": "2026-09-01T09:33:44.583173Z",
  "updated_at": "2026-09-01T09:33:44.583173Z"
}
```

## 2. Attach a source — `POST conversations/{id}/attachments/`

The `+` in the prompt box. A PDF or a URL — **one of the two, never both**.

```
POST attachments/          multipart/form-data
  file: <a .pdf>
```

```json
POST attachments/          application/json
{ "url": "acme.com/blog/how-we-cut-inference-cost" }
```

`201`:

```json
{
  "id": "9b1f2c0e-9a0e-4a7e-8a3f-1f2b7c4e5d60",
  "kind": "url",
  "url": "https://acme.com/blog/how-we-cut-inference-cost",
  "url_kind": "page",
  "label": "https://acme.com/blog/how-we-cut-inference-cost",
  "status": "pending",
  "error": "",
  "created_at": "2026-09-01T09:35:10.101Z"
}
```

| Field | Notes |
|---|---|
| `kind` | `pdf` or `url` |
| `url_kind` | `site`, `page` or `profile` on a URL; `""` on a PDF. **Derived server-side** |
| `label` | What to render in the chip: file name or address |
| `status` | `pending` → `ready` \| `failed` |
| `error` | Only on `failed`. A sentence the user can read; show it on the chip |

Poll `GET conversations/{id}/` — the same list is inlined there, so one poll covers both the turn and the reading.

### Refusals

| Status | Body | When |
|---|---|---|
| `400` | `{"file": ["Only PDF files are supported."]}` | Not a `.pdf` |
| `400` | `{"non_field_errors": ["Attach a PDF or a URL — one of the two, not both."]}` | Both sent, or neither |
| `400` | `{"url": [...]}` | Not a usable URL |
| `400` | `{"detail": "A conversation takes at most 5 attachments. Remove one first."}` | Sixth attachment |

### Remove one — `DELETE attachments/{aid}/`

`204`. An unknown id is a `404`.

## 3. Send a message — `POST conversations/{id}/messages/`

```json
{ "text": "write a few posts about my technical skills, longer, with emoji" }
```

To target a specific draft:
```json
{ "text": "make this post very long", "post": "640658b0-8bfa-4962-86b4-29c16d770015" }
```

`text` is required, non-blank, max **4000** characters. `post` is optional — UUID of the specific `AgentPost` to edit.

To generate more drafts for an existing `kind: "posts"` message (no `text`, flow is not restarted):
```json
{ "more_drafts": true, "message_id": "b2c1e7a4-…" }
```

`message_id` is the `id` of the `posts` message the button sits under. The new post ids are appended to **that same message's** `payload.post_ids` (and to `artifacts.post_ids`) — no new message is created. Returns the same `202` + `run_id`; poll as usual.

`202`:
```json
{ "run_id": "0f1c0f4e-6a2e-4b31-9f0a-2b0a5f2e5c11" }
```

### 409s

| `detail` | Meaning | What the UI should do |
|---|---|---|
| `This conversation is already working on something. Wait for it to finish, or cancel it.` | A turn is in flight | Disable send while `status == "running"` |
| `This conversation is waiting on an answer. Reply to the pending question, or cancel it.` | `awaiting_input` | Show the question form, not the text box |
| `Still reading what you attached. Give it a moment and send that again.` | An attachment is still `pending` | Disable send until every attachment is `ready`/`failed` |
| `This conversation has been archived. Start a new one.` | Untouched for 7 days while waiting on an answer | Offer "new conversation" |

## 4. Poll — `GET conversations/{id}/`

The whole conversation, every time. Transcript included.

```json
{
  "id": "f4d60d20-7daa-47d1-b715-31d1b1a1856c",
  "status": "awaiting_input",
  "intent": "post",
  "grounding": "knowledge",
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
    "kind": "headlines",
    "headlines": ["…", "…"],
    "can_generate_more": true
  },
  "artifacts": { "post_ids": [] },
  "attachments": [ { "id": "9b1f…", "kind": "url", "status": "ready", "…": "…" } ],
  "created_at": "…",
  "updated_at": "…"
}
```

### `status`

| Value | Meaning | UI |
|---|---|---|
| `draft` | Created, no message yet | Empty composer |
| `running` | A turn is executing | Spinner, send disabled, offer Cancel |
| `awaiting_input` | Suspended on a question or headline round | Render `pending_interrupt` by its `kind` |
| `completed` | Turn finished — **resting, not terminal** | Show results; the box stays open for edits |
| `failed` | The turn died (vendor error, timeout) | Show the last agent message; the user can resend |
| `cancelled` | The user pressed stop | Terminal for this conversation |
| `archived` | Swept after 7 days awaiting an answer | Terminal; start a new one |

### `messages[]`

`role` is `user` or `agent`. `kind` is one of:

| `kind` | Written by | `payload` |
|---|---|---|
| `text` | user's message; agent's refusals and explanations | `{}` — or, on an answer the user submitted, `{"interrupt_id": "…", "answers": {…}}` |
| `posts` | the turn that wrote drafts | `{"post_ids": ["…"], "versions": {"<postId>": 1}}` |
| `edit` | an edit turn, or a change made outside the chat (`source` set) | `{"post_ids": ["…"], "versions": {"<postId>": 2}, "field": "text" \| "image", "changed": ["body"], "changes": {"<postId>": ["body"]}, "source"?: "editor" \| "regenerate" \| "restore" \| "image_chat", "restored_from"?: {"<postId>": 1}}` |
| `error` | the stale-run sweep | `{}` |

### `artifacts.post_ids`

The drafts this conversation produced, in creation order. **That order is the numbering the user sees** — "post 2" means `post_ids[1]`. An edit turn does not add ids; it updates the same posts.

Fetch posts from: `GET {{baseUrl}}/workspaces/{{workspaceId}}/content/posts/?state=agent`

## 5. Answer — `POST conversations/{id}/answer/`

One route, two payloads. Branch on `pending_interrupt.kind`.

**Questions:**
```json
{
  "interrupt_id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "answers": {
    "clarifier_0": "Generative AI development — LLM integrations and RAG",
    "grounding_gap": "write it from my message alone"
  }
}
```

**Headlines:**
```json
{
  "interrupt_id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "answers": { "headlines": ["The 3am pager taught me more than the postmortem", "…"] }
}
```

**Suggest more headlines** (only when the headlines interrupt has `can_generate_more: true`):
```json
{
  "interrupt_id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "answers": {
    "more_headlines": true,
    "headlines": ["…current list on screen (user edits, deletions, custom lines)…"]
  }
}
```
Same endpoint and `202` + `run_id` flow. The conversation runs again and comes back with a **new** `kind: "headlines"` interrupt (new `id`) holding the updated list and a fresh `can_generate_more`.

**Skip remaining questions** (second round onward, when `can_skip: true`):
```json
{
  "interrupt_id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "answers": { "skip_remaining": true }
}
```
Can be sent alone or alongside real answers. Silently ignored if `can_skip` was `false`.

`interrupt_id` is `pending_interrupt.id` **verbatim**. `202` + `{"run_id": …}`, then poll again.

### 409s

| `detail` | Meaning |
|---|---|
| `That answer is for a question this conversation has moved on from. Reload it to see what it is waiting on.` | Stale `interrupt_id` — re-`GET` and re-render |
| `This conversation is not waiting on an answer.` | Nothing pending |

---

## Rendering `pending_interrupt`

```json
{ "id": "45fb…", "kind": "questions" | "headlines", "…": "…" }
```

**Branch on `kind`.** Two shapes — treat an unknown `kind` as "reload and show raw text", not a crash.

### `kind: "headlines"`

```json
{
  "id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "kind": "headlines",
  "headlines": [
    "The 3am pager taught me more than the postmortem",
    "We cut inference cost 60% and nobody noticed",
    "Your RAG pipeline is a search problem wearing a hat"
  ],
  "can_generate_more": true
}
```

`can_generate_more: boolean` — when `true`, the UI shows a "Suggest more concepts/ideas" button that answers with `more_headlines: true` (see Answer above); when `false`, the button is hidden.

Each string is one post's first line. Render as an editable list and send back what the user settled on. Keep / reword / delete / add — what comes back is `len(headlines)` posts. Send `[]` and the batch is written with no chosen opener. At most **10** headlines offered. Offered only on a new batch turn, never on an edit turn. Normally one round per batch — it repeats only when the user asks for more (`more_headlines: true`); each repeat is a new interrupt with a new `id`, so always send the latest `pending_interrupt.id`.

### `kind: "questions"`

```json
{
  "id": "6032…",
  "kind": "questions",
  "questions": [ /* one or more — typically 2–4 */ ],
  "can_skip": false
}
```

| Field | Notes |
|---|---|
| `can_skip` | `false` on the **first** round — do not show a skip control. `true` from the **second** round onward — show "skip the rest". To skip, send `"skip_remaining": true` in answers. |
| `id` | The key to answer under. Always present |
| `question` | The text to show |
| `kind` | `choice`, `number`, or `text` |
| `options` | Buttons/radios. Present on `choice` |
| `default` | Pre-select this. May be absent |
| `allow_free_text` | `true` → also show a text input |
| `min` / `max` | On `kind: "number"` only |
| `suggested_topics` | On `grounding_gap` only |
| `url` | On `link_role_*` only |

Questions you will actually see:

| `id` | Asked when |
|---|---|
| `tone` | Message said nothing about tone. Options: `professional`, `conversational`, `bold`, `storytelling`, `inspirational`, `educational`, `analytical` |
| `length` | Length not stated. Options: `about 110-120 words` (default), `about 200 characters`, `about 200 words`, `three short paragraphs` |
| `intent` | Could not tell this was a request for posts |
| `grounding` | Could not tell whether to use knowledge base or message alone — and `use_knowledge` is off |
| `grounding_gap` | Knowledge base cannot ground this topic |
| `link_role_0…` | A URL in the message could be a subject or voice sample |
| `clarifier_0…2` | Model-written: which launch, which audience, which result to lead with |
| `edit_target` | An edit turn could not tell which draft |

At most **2 rounds** of questions per conversation. At the cap, agent takes each unanswered question's `default` and writes. The headline round does not count against this.

---

## Errors

| Where | Status | Body |
|---|---|---|
| Validation | `400` | DRF field errors, or `{"detail": …}` on the attachment cap |
| Foreign / unknown resource | `404` | `{"detail": "Not found."}` |
| Lifecycle conflict | `409` | `{"detail": "…"}` |
| Source that could not be read | — | Not an HTTP error. `attachments[].status` is `failed` with `error` |
| Vendor failure mid-turn | — | Not an HTTP error. `status` becomes `failed` and an agent message says so |

---

## Post versions

Every content change to a post saves a numbered **version** (v1, v2, …). A version holds **content only** (headline, body, body_blocks, hashtags, cta, image, video, media) — **never status or schedule time; read those from the live post**.

Creates a version: generate (v1), chat edit, `PATCH posts/{id}/`, image/video upload, generate image, regenerate, Image Chat "Add to post", restore (a **new** number). Approve / schedule / time change → **no** version, no chat card. Quick saves by the same user within 2 min update one version.

**`current_version`** on every post (`GET posts/`, `GET posts/{id}/`) = the version the post matches now.

**`payload.versions`** on every chat card that shows posts = `{postId: n}` — the version that card showed. Old cards (pre-versioning) have no `versions` → render the live post. The legacy `edit` payload `after` snapshot is **no longer sent**.

### `GET content/posts/{postId}/versions/{n}/`

```ts
interface PostVersion {
  id: string; post: string; number: number;
  source: string;            // "agent_chat" | "editor" | "regenerate" | "restore" | "image_chat" | …
  note: string;              // e.g. "add emojis"
  restored_from: number | null;
  conversation_id: string | null;
  headline: string; body: string; body_blocks: object; hashtags: string[]; cta: string;
  image_url: string; image_status: string; image_origin: string;
  video_url: string; media: string; media_type: string;
  is_current: boolean; created_at: string;
}
```

- `404` = no such version **or** the post was deleted → "This post was deleted."
- `image_status: "pending"` → poll this version every 3s until `ready` / `failed`. Otherwise immutable — cache by `postId + n`.
- History list (newest first, paginated, `?page=`): `GET content/posts/{postId}/versions/` → `PaginatedPostVersions` `{count, next, previous, results: PostVersion[]}`. Shown in the chat via `VersionHistoryModal`.

### Latest card per post

The **latest** card for a post = the **last** agent message where `payload.versions[postId] === post.current_version` (old chats: the last agent card showing the post). Latest → status badge, Approve, Edit, select. Older → "Old version · vN" + **only** "Use this version" (none for published posts). No delete on chat cards.

### `POST agent/conversations/{id}/restore/`

Body `{"post": "<postId>", "version": 1}` → `200` instantly (no agent turn):

```json
{
  "version": { "number": 4, "source": "restore", "note": "Restored from version 1", "restored_from": 1, "...": "full version" },
  "message": {
    "id": "uuid", "role": "agent", "kind": "edit", "text": "Restored post 1 to version 1.",
    "payload": { "source": "restore", "post_ids": ["A"], "versions": {"A": 4}, "restored_from": {"A": 1}, "changed": ["body"], "changes": {"A": ["body"]} },
    "created_at": "…"
  }
}
```

After 200: append `message` (null if that version was already current), refetch the post. An approved/scheduled post goes back to **draft**. Disable while the conversation is `running`.

Errors: `400 {"post": ["That post is not one of this conversation's drafts."]}` · `400 {"detail": "A published post cannot be changed."}` · `404` · `409 {"detail": "This conversation is already working on something…"}` · `409 {"detail": "This conversation has been archived…"}`

Outside the chat: `POST content/posts/{postId}/versions/{n}/restore/` (no body) → `{version, post}`; every chat holding the post gets a "restored outside this chat" card. Same 400/404, no 409.

---

## Rendering the drafts

Posts come from `GET content/posts/?state=agent`. Two fields carry the text:

* `body` — plain text. What publishes to LinkedIn.
* `body_blocks` — the same post as a **Tiptap (ProseMirror) document**. Load it into the editor; fall back to `body` if it is `{}`.

**Editing**: `PATCH content/posts/{id}/` with `body_blocks` set to the editor's document. `body` is re-derived from it automatically.

**With `use_hashtags` on**, tags are in **two** places: the `hashtags` array, and the last line of `body`/`body_blocks`. Do **not** append the array under the body — tags are already there.

---

## The composer's panel — `GET`/`PATCH settings/`

```json
{
  "post_count": 5,
  "use_hashtags": true,
  "use_emoji": false,
  "use_ai_image": true,
  "ignore_headline": false,
  "ask_questions": true,
  "use_post_length": false,
  "post_length": "",
  "use_target_audience": false,
  "target_audience": "",
  "writer_model": "gemini-2.5-pro",
  "ai_models": {
    "anthropic": [{ "model_id": "claude-opus-5", "label": "Claude Opus 5", "selected": false }],
    "deepseek": [{ "model_id": "deepseek-v4-pro", "label": "DeepSeek V4 Pro", "selected": false }],
    "gemini": [
      { "model_id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro", "selected": true },
      { "model_id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash", "selected": false }
    ]
  },
  "knowledge": [
    { "id": "6f1c2b9e-…", "kind": "pdf", "label": "Campaign Knowledge", "name": "q4-campaign.pdf", "status": "ready", "enabled": true },
    { "id": "a03d77c1-…", "kind": "website", "label": "", "name": "https://acme.com", "status": "crawling", "enabled": false }
  ],
  "tone_and_style": [
    { "id": "6f1c2b9e-…", "kind": "pdf", "label": "My CEO voice", "name": "ceo-posts.pdf", "status": "ready", "enabled": true },
    { "id": "a03d77c1-…", "kind": "website", "label": "Company blog", "name": "https://acme.com/blog/launch", "status": "ready", "enabled": true }
  ]
}
```

`GET` creates the row with defaults on first read — never 404s. `PATCH` is partial. `post_count` outside **1–20** is a `400`.

| Field | Default | What it does |
|---|---|---|
| `post_count` | `5` | How many posts a turn writes |
| `use_hashtags` | `true` | Tags in `hashtags` array and last line of body |
| `use_emoji` | `false` | Emoji in the body |
| ~~`use_knowledge`~~ | — | **Removed** (Story #3999). Sending it is ignored — use `knowledge` switches |
| `use_ai_image` | `true` | Off → no image at all, not even stock |
| `ignore_headline` | `false` | Skip headline round |
| `ignore_grilling` | `false` | Skip clarifying questions. **No longer returned** by `GET` (optional in the type) |
| `ask_questions` | `true` | Ask clarifying questions before writing |
| `use_post_length` | `false` | On → drafts follow `post_length` |
| `post_length` | `""` | Free text. Presets: `"100 words"` (Short) · `"200 words"` (Medium) · `"300 words"` (Long) · `""` (Let agent decide); anything else is a user-written custom length. No option field — the UI maps the string back to a pill or the custom box |
| `use_target_audience` | `false` | On → drafts are written for `target_audience` |
| `target_audience` | `""` | Free text, e.g. `"Startup founders and CTOs in SaaS"` |
| `writer_model` | — | `model_id` of the model that writes drafts. Change with `PATCH { "writer_model": "claude-opus-5" }` |
| `ai_models` | — | Read-only. Available writer models grouped by provider key; exactly one has `selected: true` |
| `knowledge` | `[]` | One switch per **knowledge** source (oldest first). See [Knowledge switches](#knowledge-switches) |
| `tone_and_style` | `[]` | One switch per **tone / style** source (oldest first). Backend field is `tone_and_style` (the spec md called it `voice`). See [Tone / style switches](#tone--style-switches) |

The prompt outranks the panel (prompt > panel > default).

```ts
type AgentModelOption = { model_id: string; label: string; selected: boolean };
// AgentSettings += { writer_model?: string; ai_models?: Record<string, AgentModelOption[]>; knowledge?: KnowledgeSwitch[]; tone_and_style?: VoiceSwitch[] }
```

### Knowledge switches

Agent Mode only (Story #3999). Each knowledge source has its own **label** and **on/off switch**; a chat uses only the sources that are on.

```ts
type KnowledgeKind = "pdf" | "website" | "linkedin";
interface KnowledgeSwitch {
  id: string;        // same id as the source's own route
  kind: KnowledgeKind; // send back with the id when flipping
  label: string;     // note for the agent; "" = none
  name: string;      // file name, URL or profile URL
  status: string;    // "ready" | "failed" | "pending" | "extracting" | "crawling" | "fetching"
  enabled: boolean;
}
```

- Only `ready` sources are used. Tone / style references are **never** listed. Empty pool → `[]`.
- **Flip**: `PATCH settings/` with only the changed switches — `{ "knowledge": [{ "kind": "website", "id": "a03d…", "enabled": true }] }`. Combinable with other settings; response = full settings body. Saved **on the source** (persists for later chats). `PATCH { "enabled": false }` on the source's own route does the same.
- **All off** → posts written without knowledge (old `use_knowledge: false`). **No sources** → same as before. Attachments (`+` in the prompt box) are not listed and always used for their chat.
- A prompt sentence ("don't use my knowledge base") still wins for that message, but can't switch a source back on.
- `is_default` no longer limits knowledge — switches decide. (It no longer picks the tone/style reference either — see [Tone / style switches](#tone--style-switches).)

**`label` = the source's note for the agent** (optional free text, max 200 chars, e.g. "Use this for article making" — confirmed with backend; the UI shows it as a note under the source name, not as the name). All create / list / detail / PATCH responses now carry `label` and `enabled` (`true` on new uploads):

| Source | Request | Field |
|---|---|---|
| PDF | `POST linkedin/agent/documents/` (multipart) | `label` beside `file` |
| Website | `POST linkedin/agent/websites/` | `{ "url": "acme.com", "label": "Company website" }` |
| LinkedIn profile | `POST linkedin/profiles/` | `{ "profile_url": "…", "label": "My LinkedIn" }` |

Edit the note: `PATCH` the same detail route with `{ "label": "…" }`. The UI sends no note for LinkedIn profiles.

**Refusals** — nothing is saved on a `400` (including other fields in the same PATCH):

| Request | Status | Body |
|---|---|---|
| Source not a knowledge source of this workspace (other workspace, tone/style, deleted) | `400` | `{"knowledge": ["No pdf knowledge source <id> in this workspace."]}` |
| Unknown `kind` | `400` | `{"knowledge": [{"kind": ["\"video\" is not a valid choice."]}]}` |
| `label` over 200 chars | `400` | `{"label": ["Ensure this field has no more than 200 characters."]}` |
| Foreign / inactive workspace | `404` | unchanged |

### Tone / style switches

Agent Mode only (Story #4025). Same model as knowledge: each tone / style source has its own **label** (UI: note for the agent) and **on/off switch**. **Several can be on at once.**

```ts
interface VoiceSwitch {
  id: string;                    // same id as the source's own route
  kind: "pdf" | "website";       // send back with the id when flipping
  purpose?: "tone" | "style";  // in the spec; not sent by the backend today
  label: string;                 // note for the agent; "" = none
  name: string;                  // file name or URL
  status: string;                // "ready" | "failed" | "pending" | "extracting" | "crawling"
  enabled: boolean;
}
```

- Listed in `GET settings/` → **`tone_and_style`** (oldest first; the spec md said `voice`, the live API sends `tone_and_style` — confirmed from a real response). Only tone/style sources — a source is never in both `knowledge` and `tone_and_style`. Empty pool → `[]`. Only `ready` sources are used.
- **Upload**: same routes with `purpose: "tone" | "style"` + optional `label` (max 200) — PDF `POST linkedin/agent/documents/` (multipart `file`, `purpose`, `label`); URL `POST linkedin/agent/websites/` `{ "url", "purpose", "label" }`. New uploads start **on**; others unchanged. Edit the note: `PATCH` the detail route with `{ "label": "…" }`.
- **Flip**: `PATCH settings/` with only the changed switches — `{ "tone_and_style": [{ "kind": "pdf", "id": "c9e0…", "enabled": true }] }` (key assumed to match the GET field — **to confirm with backend**). Combinable with `knowledge` and other settings; response = full settings body. Saved **on the source**. `PATCH { "enabled": false }` on the source's own route does the same.
- **What the switches do**: one on → that voice; several on → one blended voice (wording / greetings / sign-offs from **tone**, structure from **style**); all off → default voice; no sources → as before. Sources on share ~8,000 characters equally.
- A voice link pasted in the message still wins for that message. While any source is on, the "what tone?" question isn't asked; suggested length comes from the newest source that is on and states one.
- Applies to new posts and **Regenerate**; chat edits never read a voice source.
- `is_default` on tone/style **no longer picks** the voice. Workspaces with several sources kept only the one in use switched on.
- `knowledge` / `tone_and_style` items carry **no file URL** for PDFs (`name` is just the file name), so the composer can link websites / LinkedIn but not PDFs. Adding a `url` per item would let PDFs open too.

**Refusals** — nothing is saved on a `400`:

| Request | Status | Body |
|---|---|---|
| Not a tone/style source of this workspace (other workspace, knowledge source, deleted) | `400` | `{"tone_and_style": ["No pdf tone or style source <id> in this workspace."]}` (spec: `voice`) |
| Unknown `kind` (including `linkedin`) | `400` | `{"tone_and_style": [{"kind": ["\"linkedin\" is not a valid choice."]}]}` (spec: `voice`) |
| Tone/style source sent in `knowledge` | `400` | `{"knowledge": ["No pdf knowledge source <id> in this workspace."]}` |
| `label` over 200 chars | `400` | `{"label": ["Ensure this field has no more than 200 characters."]}` |
| Foreign / inactive workspace | `404` | unchanged |

---

## Worked example

```
POST   conversations/                                 201  → id=f4d6…
POST   conversations/f4d6…/attachments/               201  {"id":"9b1f…","status":"pending"}
GET    conversations/f4d6…/                           200  attachments[0].status=ready
POST   conversations/f4d6…/messages/                  202  {"run_id": "0f1c…"}
GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt = { kind: "questions", id: "6032…", 3 clarifiers }
POST   conversations/f4d6…/answer/                    202
GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt = { kind: "headlines", id: "45fb…", headlines: ["…","…","…"], can_generate_more: true }
POST   conversations/f4d6…/answer/                    202  (optional) { more_headlines: true, headlines: [current list] }
GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt = { kind: "headlines", id: "7a2c…", headlines: [more…], can_generate_more: … }
POST   conversations/f4d6…/answer/                    202  { headlines: [final list] }
GET    conversations/f4d6…/                           200  status=completed
       artifacts.post_ids = ["a1…","b2…","c3…"]
GET    content/posts/?state=agent                     200  → the drafts
POST   conversations/f4d6…/messages/                  202
       { "text": "make post 2 longer" }
```

---

# 3. Posts API

**Base path**: `{{baseUrl}}/workspaces/{{workspaceId}}/content/posts/`

Relevant endpoints for the Review & Approval and Agent Composer flows.

---

## `POST posts/{id}/approve/`

Moves a draft post to `approved` / `scheduled` status.

**Success `200`** — the updated `PostType` object.

### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{"suggested_publish_at": ["This post's suggested time has already passed. Move it to a future time before approving."]}` | `suggested_publish_at` is in the past at approve time |

**UI behaviour on this 400**: show the error message as a toast **and** auto-open the Edit Suggested Publish Time modal for that post, pre-filled with the current `suggested_publish_at`.

---

## `PATCH posts/{id}/`

Partial update of a post. Accepts `body_blocks`, `suggested_publish_at`, `image_url`, `video_url`, `status`, `media`, etc.

**Success `200`** — the updated `PostType` object.

### Errors (field-level)

| Status | Body | When |
|---|---|---|
| `400` | `{"suggested_publish_at": ["Cannot schedule a post in the past. Send a time in the future."]}` | `suggested_publish_at` value is a past datetime |

**UI behaviour on this 400 (Edit Suggested Publish Time modal)**: keep the modal open, display the error message inline under the datetime input (red border + red text). Do **not** fire a toast. Clear the error when the user changes the input value.

---

# 2. Image Chat API

One post, one conversation about its picture. The user says in their own words how the picture should change, and the backend makes a new one. They keep going until happy, then press **Add to post**.

**Nothing reaches the post until Add to post is called.** Generating writes nothing — not the picture, not `image_status`, not `media`.

**Base path**: `{{baseUrl}}/workspaces/{{workspaceId}}/image-chats/`

---

## Endpoints

| Method | Path | Success | Notes |
|---|---|---|---|
| `POST` | `image-chats/` | `201` new / `200` existing | `{ post: id }` — one chat per post |
| `GET` | `image-chats/{id}/` | `200` full chat | Poll while `status === "running"` |
| `POST` | `image-chats/{id}/messages/` | `202` generating / `200` text-only | `{ prompt }` |
| `POST` | `image-chats/{id}/add_to_post/` | `200` full chat | `{ image: imageId }` |
| `GET` | `image-chats/` | `200` paginated list | `count`/`next`/`previous`/`results`, page size 25 |
| `GET`/`PATCH` | `image-chats/settings/{chatId}/` | `200` settings | Per-chat image settings — see §4 |
| `GET` | `image-chats/{id}/stock/recommended/` | `200` `{ query, photos }` | Pexels photos picked for the post — see §5 |
| `GET` | `image-chats/{id}/stock/search/?q=&page=` | `200` `{ query, page, has_more, photos }` | User's own Pexels search — see §5 |
| `GET`/`PATCH` | `image-chats/settings/` | `200` settings | **Workspace** settings (no chat id) — `image_knowledge` switches, see §6 |
| `GET`/`POST` | `image-chats/knowledge/` | `200` paginated / `201` source | Image knowledge sources — see §6 |
| `GET`/`PATCH`/`DELETE` | `image-chats/knowledge/{id}/` | `200` / `200` / `204` | One source; `PATCH` changes `label`, and `text` on typed-text sources — see §6 |

---

## Response shape — `ImageChat`

Every route returns **the whole chat**:

```json
{
  "id": "3f1c…",
  "post": "9ab2…",
  "post_image_url": "https://…/post_images/generated_9ab2.jpg",
  "post_media_type": "image",
  "status": "ready",
  "messages": [
    {
      "id": "…",
      "role": "agent",
      "text": "Tell me how you want to change this image.",
      "image": null,
      "created_at": "2026-09-23T05:40:11Z"
    }
  ],
  "images": [
    {
      "id": "…",
      "status": "ready",
      "url": "https://…/image_chat/turn_….jpg",
      "prompt": "make the desk blue",
      "is_base": false,
      "is_added_on_post": true,
      "kind": "edit",
      "source": "…",
      "error": "",
      "created_at": "2026-09-23T05:41:02Z"
    }
  ],
  "created_at": "2026-09-23T05:40:11Z",
  "updated_at": "2026-09-23T05:41:02Z"
}
```

### TypeScript types

```ts
type ImageChat = {
  id: string;
  post: string;
  post_image_url: string;          // "" when the post has no picture
  post_media_type: "image" | "video" | "none";
  status: "running" | "ready";     // poll while "running"
  messages: ChatMessage[];         // oldest first
  images: GeneratedImage[];        // oldest first — for strip/picker only
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  image: GeneratedImage | null;    // non-null → render a picture card
  created_at: string;
};

type GeneratedImage = {
  id: string;
  status: "pending" | "ready" | "failed";
  url: string;                     // "" until ready
  prompt: string;                  // "" on a base image
  is_base: boolean;                // the post's own picture, copied in
  is_added_on_post: boolean;       // true if this image is currently on the post
  kind: "edit" | "new" | "stock";  // unknown kinds → render as a normal picture card
  source: string | null;           // id of the picture it was made from
  error: string;                   // filled only when failed
  created_at: string;
};
```

`messages` and `images` are both **oldest first**. Render `messages` as the transcript — `images` is for a strip or picker only.

---

## 1. Open the chat — `POST image-chats/`

```json
{ "post": "9ab2…" }
```

* **201** — new chat. Contains one agent greeting line and, if the post has a picture, one `is_base: true` image.
* **200** — the existing chat for this post. Pressing the button twice is not two chats.

On a **200**, if the post's picture changed since the chat last looked, a new `is_base` image is appended — that is the picture the next turn will edit.

**On open:** find `images.find(img => img.is_added_on_post)` and restore the "Added" button state to that image's id.

### Refusals

| Status | Body | When |
|---|---|---|
| `400` | `{"post": ["No such post in this workspace."]}` | Unknown post or wrong workspace |

---

## 2. Send a turn — `POST image-chats/{id}/messages/`

```json
{ "prompt": "make the desk blue" }
```

### 202 — image request

**202 Accepted** with the chat. The user's line and an agent line with `image.status: "pending"` are already in `messages`. Poll `GET image-chats/{id}/` every ~2s while `status === "running"`.

```jsonc
// after poll resolves — same message id
{ "id": "86f452cc-…", "role": "agent", "text": "Making the desk blue. One moment.",
  "image": { "id": "e80e04a6-…", "status": "ready", "url": "https://…jpg", … } }
```

The agent line is written on send and only a **failure** rewrites its text.

### 200 — not about the picture

A greeting, a question about the assistant, anything unrelated: **200 OK**. No new image, chat not locked, next message works immediately.

### `kind` field

| `kind` | Meaning |
|---|---|
| `"edit"` | Last `ready` picture sent as the source to change. `source` points at it. |
| `"new"` | No picture sent — drawn fresh from post body + prompt. `source` is `null`. |
| `"stock"` | A Pexels photo put on the post (§5). Card text "Added a stock photo to your post.", `prompt: ""`, `is_base: true`. The next turn edits this photo. |

### Refusals

| Status | Body | When |
|---|---|---|
| `400` | `{"prompt": ["This field may not be blank."]}` | Empty prompt |
| `409` | `{"detail": "This chat is already making an image. Wait for it to finish, then try again."}` | Turn still running |
| `409` | `{"detail": "This chat has reached its limit of 50 images. Add one to the post and start a new chat to keep going."}` | 50-image cap |

---

## 3. Add to post — `POST image-chats/{id}/add_to_post/`

```json
{ "image": "…imageId…" }
```

**200**, with the chat — `post_image_url` now reflects the added picture. Any `ready` image can be added, **including `is_base`** (that is the undo).

### Refusals

| Status | Body | When |
|---|---|---|
| `400` | `{"image": ["No finished image with that id in this chat."]}` | Unknown id, wrong chat, or `pending`/`failed` image |
| `400` | `{"detail": "This post is already on LinkedIn — its image cannot be changed."}` | Published post |

---

## 4. Image settings — `GET`/`PATCH image-chats/settings/{chatId}/`

Per-chat settings (previously workspace-wide at `image-chats/settings/`). Exactly one item in `image_ratio` and `ai_model` has `is_active: true`. `image_style` may have **no** active item on a fresh chat — the frontend treats that as `"None"` (no style applied).

### GET response

Example (staging, `GET .../image-chats/settings/{chatId}/`):

```json
{
  "use_post_body": true,
  "image_ratio": [
    { "is_active": true, "title": "Post Size", "size": "1080 X 1080", "ratio": "1:1", "image": "https://creativegenie.blob.core.windows.net/backend-staging-media/aspet-ratio-images/image_9.png" },
    { "is_active": false, "title": "Landscape Size", "size": "1200 X 628", "ratio": "16:9", "image": "https://creativegenie.blob.core.windows.net/backend-staging-media/aspet-ratio-images/image_8.png" },
    { "is_active": false, "title": "Portrait Size", "size": "1080 X 1350", "ratio": "4:5", "image": "https://creativegenie.blob.core.windows.net/backend-staging-media/aspet-ratio-images/image_6.png" }
  ],
  "ai_model": [
    { "is_active": false, "title": "Nano Banana", "model_name": "google/nano-banana", "image": "https://creativegenie.blob.core.windows.net/backend-staging-media/model-dp-images/3f0b9148-01a3-4ece-a84d-55ce8aed006a_1456x816.jpg" },
    { "is_active": false, "title": "Nano Banana 2", "model_name": "google/nano-banana-2", "image": "https://creativegenie.blob.core.windows.net/backend-staging-media/model-dp-images/image.jpeg" },
    { "is_active": true, "title": "Nano Banana Pro", "model_name": "google/nano-banana-pro", "image": "https://creativegenie.blob.core.windows.net/backend-staging-media/model-dp-images/nana_banana_pro_hero.webp" }
  ],
  "image_style": [
    { "is_active": false, "title": "None", "description": "No specific style applied", "image": "" },
    { "is_active": false, "title": "Realistic", "description": "Lifelike precision and detail", "image": "" },
    { "is_active": false, "title": "Film Noir", "description": "Classic high contrast and moody lighting", "image": "" },
    { "is_active": false, "title": "Cartoon", "description": "Whimsical and stylized", "image": "" },
    { "is_active": false, "title": "Comic", "description": "For vibrant storytelling", "image": "" },
    { "is_active": false, "title": "Painting", "description": "Artistic and textured visual", "image": "" },
    { "is_active": false, "title": "Sketch", "description": "Hand-drawn feel for creative projects", "image": "" },
    { "is_active": false, "title": "Anime", "description": "Distinctive aesthetic style", "image": "" },
    { "is_active": false, "title": "PixelArt", "description": "Perfect for a vintage look", "image": "" },
    { "is_active": false, "title": "Studio Shot", "description": "Polished and professional", "image": "" },
    { "is_active": false, "title": "Surreal", "description": "Fantasy meets reality", "image": "" },
    { "is_active": false, "title": "Custom", "description": "Create your own unique style", "image": "" }
  ]
}
```

`image` can be `""` on any option — the UI shows a fallback icon.

### PATCH body — send only the changed field

```json
{
  "use_post_body": false,
  "image_ratio": "1:1",
  "ai_model": "google/nano-banana-pro",
  "image_style": "Realistic"
}
```

| Field | Value sent | Notes |
| --- | --- | --- |
| `use_post_body` | `boolean` | Include post text as context for generation |
| `image_ratio` | option's `ratio` (e.g. `"1:1"`) | Shape of the next generated image |
| `ai_model` | option's `model_name` (e.g. `"google/nano-banana-pro"`) | Model that renders the image |
| `image_style` | option's `title` (e.g. `"Realistic"`) | `"None"` = no style applied. `"Custom"` is currently sent as a plain selection (no custom text field) |

### TypeScript types

```ts
type ImageRatioOption = {
  is_active: boolean;
  title: string;
  size: string;
  ratio: string;
  image: string;
};

type ImageModelOption = {
  is_active: boolean;
  title: string;
  model_name: string;
  image: string;
};

type ImageStyleOption = {
  is_active: boolean;
  title: string; // "None" = no style applied
  description: string;
  image: string; // may be ""
};

type ImageChatSettings = {
  use_post_body: boolean;
  image_ratio: ImageRatioOption[];
  ai_model: ImageModelOption[];
  image_style: ImageStyleOption[];
};

type ImageChatSettingsPatch = Partial<{
  use_post_body: boolean;
  image_ratio: string; // ImageRatioOption.ratio
  ai_model: string; // ImageModelOption.model_name
  image_style: string; // ImageStyleOption.title
}>;
```

---

## 5. Stock photos (Pexels)

Two read routes. Putting a photo on the post uses the existing post `PATCH` — no new route for that step. Wrong chat id or another workspace's chat → `404 {"detail": "No ImageChat matches the given query."}`.

### Photo shape — `StockPhoto`

```json
{
  "id": 7710157,
  "alt": "Young professionals engaged in a strategic planning session…",
  "photographer": "Alena Darmel",
  "width": 4933,
  "height": 3289,
  "thumbnail_url": "https://images.pexels.com/photos/7710157/pexels-photo-7710157.jpeg?auto=compress&cs=tinysrgb&h=350",
  "url": "https://images.pexels.com/photos/7710157/pexels-photo-7710157.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "pexels_url": "https://www.pexels.com/photo/colleagues-having-a-business-meeting-7710157/"
}
```

```ts
type StockPhoto = {
  id: number;            // grid key
  alt: string;           // may be ""
  photographer: string;  // optional credit
  width: number;         // original size — every photo is landscape
  height: number;
  thumbnail_url: string; // grid image only
  url: string;           // send THIS in PATCH { image_url } — never thumbnail_url
  pexels_url: string;
};
```

### `GET image-chats/{id}/stock/recommended/`

```json
{ "query": "generative ai marketing teams small business marketing", "photos": [ /* ≤ 15 */ ] }
```

```ts
type StockRecommendedResponse = { query: string; photos: StockPhoto[] };
```

- Searches the post's first three hashtags as words (`#RemoteWork` → `remote work`); no hashtags → stored image search term → headline / first body line. If the hashtags find nothing together, the first hashtag alone. `query` is always what actually answered — shown as the search box placeholder.
- Nothing to search for → `{"query": "", "photos": []}`.
- Cached 24h by the backend (re-searches when hashtags change).

### `GET image-chats/{id}/stock/search/?q=&page=`

```json
{ "query": "coffee shop", "page": 1, "has_more": true, "photos": [ /* ≤ 15 */ ] }
```

```ts
type StockSearchResponse = { query: string; page: number; has_more: boolean; photos: StockPhoto[] };
```

| Param | Required | Notes |
|---|---|---|
| `q` | yes | Trimmed, max 200 chars |
| `page` | no | Default `1`, max `100` |

Request `page + 1` while `has_more`; pages never repeat a photo. Empty `photos` + `has_more: false` = no results. Not cached.

### Put a photo on the post — `PATCH content/posts/{postId}/ { "image_url": photo.url }`

**200** with the full post. Only a `https://images.pexels.com/…` address counts as a stock pick:

| Field | Becomes |
|---|---|
| `image_url` | The photo's `url` |
| `image_origin` | `"stock"` — a later Regenerate keeps this photo |
| `media_type` | `"image"`, **unless** the post was set to video on purpose (stays `"video"` → offer `PATCH {"media": "image"}`) |
| `current_version` | New version (`source: "editor"`); same-user edits within 2 min fold into one |

Status does not change. Then `GET image-chats/{id}/` — the transcript ends with an agent card `"Added a stock photo to your post."` whose `image.kind === "stock"`, `is_added_on_post: true` (earlier cards turn `false`). One card per pick; every Image Chat open on the post gets it; no card if the post has no chat yet.

### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{"q": ["This field is required."]}` / `{"q": ["This field may not be blank."]}` | Search with missing / blank `q` — never sent by the UI |
| `400` | `{"page": ["Ensure this value is greater than or equal to 1."]}` | Bad `page` |
| `400` | `{"image_url": ["This post is already on LinkedIn — its image cannot be changed."]}` | `PATCH` a Pexels `url` on a published post |
| `503` | `{"detail": "Stock photos are not available right now. Try again in a moment."}` | Pexels failed / not configured (either `GET`) — show with **Retry** |
| `404` | `{"detail": "No ImageChat matches the given query."}` | Wrong chat id / workspace |

Show backend text as is.

---

## 6. Image knowledge (brand guide for pictures)

Story #4075. A workspace uploads its brand guide for pictures (colours, fonts for text on images, logo rules, visual style) as **sources**: a **PDF**, a **URL** or **typed text**, each with an optional **note** (`label`). Sources that are switched on and `ready` are added to every picture's prompt, **workspace-wide**: Image Chat turns, a post's automatic picture, the composer's "generate image" button and image edits in Agent Mode. They are read when each picture is made, so a toggle applies to the next one. The user's message still wins. Chat / message / image payloads are unchanged; `GeneratedImage.prompt` still shows only what the user typed.

> **Any number of sources can be on at once.** Each toggle is independent: turning one on or off never changes another. Every source that is on and `ready` is sent, oldest first; two guides that disagree are both sent as written.

### `GET image-chats/settings/` — workspace settings (no chat id)

```json
{
  "image_ratio": ["… unchanged …"],
  "ai_model": ["… unchanged …"],
  "image_knowledge": [
    { "id": "79e82157-…", "kind": "pdf", "label": "Brand Guide 2026", "name": "Brand Guide 2026", "status": "ready", "enabled": true },
    { "id": "be5897fb-…", "kind": "text", "label": "Christmas colours", "name": "Christmas colours", "status": "ready", "enabled": false }
  ]
}
```

Oldest first, every source in the workspace, `[]` when none. `name` = label, else filename / URL.

### `PATCH image-chats/settings/` — toggle one source

```json
{ "image_knowledge": { "id": "be5897fb-…", "enabled": true } }
```

One toggle per request (an object, not an array); may be sent together with `image_ratio` / `ai_model`. `200` → the whole settings payload; re-render the list from it. A `pending` source can be switched on, but nothing reaches the image model until it is `ready`; a `failed` one never sends anything.

### `POST image-chats/knowledge/` — add a source

Exactly one of `text`, `url`, `file`; `label` optional (≤ 200).

| Source | Content type | Body |
|---|---|---|
| Text | JSON | `{ "label": "Brand colours", "text": "Use only orange #FF6B00…" }` |
| URL | JSON | `{ "label": "Brand page", "url": "acme.com/brand" }` |
| PDF | multipart | `file=<brand.pdf>`, `label=Typography` |

`201` → the new source, **switched on** (the others keep their toggle). Text is `ready` at once; a PDF / URL starts `pending` and is read in the background (a few seconds), then becomes `ready` or `failed`. Poll while any source is `pending`. A URL is read as **one page** (no crawl).

```json
{
  "id": "6f1c2b9e-…",
  "kind": "text",
  "label": "Brand colours",
  "name": "Brand colours",
  "filename": "",
  "url": "",
  "text": "Use only orange #FF6B00 and charcoal #1A1A1A…",
  "status": "ready",
  "enabled": true,
  "error": "",
  "created_at": "2026-10-12T09:30:00Z"
}
```

`filename`: PDF only · `url`: normalised (`https://…`), URL only · `text`: text sources only (what was read from a PDF / URL is not returned) · `error`: sentence to show when `failed`.

Limits: `label` 200 · `text` 8,000 · `.pdf` only · 8,000 characters **in total** for every source that is on reach the image model, oldest first — when over, the newest text is cut off.

### List, rename, delete

| Request | Response |
|---|---|
| `GET image-chats/knowledge/?page=` | `200` paginated (25), oldest first |
| `GET image-chats/knowledge/{id}/` | `200` one source |
| `PATCH image-chats/knowledge/{id}/ { "label": "…" }` | `200` source — rename / note |
| `PATCH image-chats/knowledge/{id}/ { "text": "…" }` | `200` source — **typed-text sources only** |
| `DELETE image-chats/knowledge/{id}/` | `204` — a source that was on just leaves the brand guide |

**Edit a typed note:** send `text` to a `text` source — same rules as adding (not blank, ≤ 8,000, trimmed). `label` can change in the same request:

```json
{ "label": "Brand colours v2", "text": "Use only orange #FF6B00 and navy #1A2B4C." }
```

`200` → the source with the new `text`. Its toggle doesn't change, so if it's on, the **next** picture uses the new text. `PATCH` changes only `label` and `text` — `enabled` (or anything else) is ignored; toggling happens only through the settings route. A PDF's or URL's text can't be edited (`400`) — to replace one, delete it and add a new one.

### TypeScript types

```ts
type ImageKnowledgeKind = "pdf" | "url" | "text";
type ImageKnowledgeStatus = "pending" | "ready" | "failed";

// GET/PATCH image-chats/settings/ → image_knowledge[]
type ImageKnowledgeSwitch = {
  id: string;
  kind: ImageKnowledgeKind;
  label: string;
  name: string;
  status: ImageKnowledgeStatus;
  enabled: boolean;
};

// image-chats/knowledge/ routes
type ImageKnowledgeSource = ImageKnowledgeSwitch & {
  filename: string;
  url: string;
  text: string;
  error: string;
  created_at: string;
};
```

### Errors

| Case | Response |
|---|---|
| None / more than one of `text`, `url`, `file` | `400 {"source": ["Give exactly one of file, url or text."]}` |
| Not a PDF | `400 {"file": ["Only PDF files are supported."]}` |
| Blank text (adding or editing) | `400 {"text": ["A brand guide note cannot be blank."]}` |
| Text > 8,000 (adding or editing) | `400 {"text": ["Ensure this field has no more than 8000 characters."]}` |
| Editing `text` on a PDF or URL source | `400 {"text": ["Only a typed note can be edited. Replace a PDF or URL by deleting it and adding another."]}` |
| Invalid URL | `400 {"url": ["Enter a valid URL."]}` |
| Label > 200 | `400 {"label": ["Ensure this field has no more than 200 characters."]}` |
| Bad toggle shape | `400 {"image_knowledge": ["Send one toggle: …"]}` |
| Toggle id not in workspace | `400 {"image_knowledge": ["No image knowledge source with that id in this workspace."]}` |
| Not the user's workspace / source from another workspace / missing | `404` |

A source that can't be read is not an HTTP error. It comes back `status: "failed"` with one of:
- `I couldn't read that — check the link, or upload the file itself.`
- `There was no readable text in that — a scanned PDF or a page that builds itself in the browser will read empty.`

---

## Polling rule

Poll `GET image-chats/{id}/` every 2s while `chat.status === "running"`. The chat-level `status` is the single source of truth — `"running"` exactly while a turn is being generated. A failed turn leaves the chat `"ready"`. A spinner never runs forever — a background sweep fails any turn still `pending` after 20 minutes.

**The client rule: poll while `status === "running"`, stop on `"ready"`.**

---

## What is new on a Post

`image_origin` — `"ai"`, `"stock"`, `"upload"`, `"chat"`, or `""`. A picture added from Image Chat is `"chat"` and survives every later rewrite.

A generated picture follows the chat's active `image_ratio` (1:1, 16:9 or 4:5 — see §4), so it can be square, landscape or portrait. An uploaded picture keeps its original shape until a turn edits it. The frontend always renders images at their natural aspect ratio (never cropped to a fixed box).

---

## Copy that comes from the backend

| Event | Text |
|---|---|
| chat opened | Tell me how you want to change this image. |
| chat opened, no picture | Tell me what image you want for this post, and I will create it. |
| turn accepted | *written from what they asked* |
| turn failed | I could not make that image. Try describing the change again. |
| added to the post | Added to your post. |
| stock photo put on the post | Added a stock photo to your post. |
| message not about the picture | *written for what they asked — varies* |

Never re-write agent copy client-side.
