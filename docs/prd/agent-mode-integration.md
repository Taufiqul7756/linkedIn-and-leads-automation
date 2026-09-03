# Agent Mode — frontend integration (V2)

One prompt box, one conversation. The user types what they want, attaches what
they want it written from, approves the first lines, and the agent writes
**draft Posts**. Nothing publishes: a draft goes through the same approve →
schedule gate as every other post.

Everything below is under:

```
{{baseUrl}}/workspaces/{{workspaceId}}/agent/
```

`baseUrl` is `https://<host>/api/v1`. Every request needs
`Authorization: Token <key>`. A workspace the user does not own answers **404**
(never 403).

> **What changed in V2** — read this if you already shipped V1.
>
> * `settings/` changed shape. `make_longer` is **gone**; `post_count`,
>   `use_hashtags`, `ignore_headline` and `ignore_grilling` are new.
> * `pending_interrupt.kind` is no longer always `"questions"`. A new kind,
>   `"headlines"`, offers each post's first line before it is written. Same
>   `answer/` route, different payload.
> * Three new routes: `POST`/`GET conversations/{id}/attachments/` and
>   `DELETE conversations/{id}/attachments/{aid}/`.
> * `GET conversations/{id}/` carries a new `attachments` array.
> * One new `409` on `messages/`: a source is still being read.
> * The `count` question is gone from the question catalogue — the panel
>   answers it. So is the `grounding` question, unless the panel's
>   `use_knowledge` is off.

---

## The endpoints

| Method | Path | Returns |
|---|---|---|
| `POST` | `conversations/` | `201` + empty conversation |
| `GET` | `conversations/{id}/` | `200` + conversation, transcript, attachments, pending question, post ids |
| `POST` | `conversations/{id}/messages/` | `202` + `{"run_id": "…"}` |
| `POST` | `conversations/{id}/answer/` | `202` + `{"run_id": "…"}` |
| `POST` | `conversations/{id}/attachments/` | `201` + the attachment row |
| `GET` | `conversations/{id}/attachments/` | `200` + the list (unpaginated) |
| `DELETE` | `conversations/{id}/attachments/{aid}/` | `204` |

Two of them are **async**. `messages/` and `answer/` return `202` immediately;
the turn runs on a Celery worker for roughly 10–60 seconds. The client polls
`GET conversations/{id}/` and renders whatever state it finds. The `run_id` is
for logs and correlation — there is no endpoint that takes it.

Also available and worth wiring:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `conversations/` | Paginated list, no transcripts (`page`, `page_size`, default 25) |
| `POST` | `conversations/{id}/cancel/` | Stop button. Idempotent, returns the conversation |
| `DELETE` | `conversations/{id}/` | `204`. Gone, including the transcript and the attachments |
| `GET`/`PATCH` | `settings/` | The composer's panel (see the last section) |

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

A conversation is created empty and does nothing until the first message. It is
fine to create it when the user opens the composer — you need its id before an
attachment can be uploaded anyway.

**Do not send a message while any attachment is `pending`.** It is a `409`.
Disable send until every row is `ready` or `failed`.

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
| `kind` | `pdf` or `url` — follows what was sent |
| `url_kind` | `site`, `page` or `profile` on a URL; `""` on a PDF. **Derived server-side**, never sent — `site` means the domain was crawled, `profile` means a LinkedIn `/in/` member profile |
| `label` | What to render in the chip: the file's name, else the address |
| `status` | `pending` → `ready` \| `failed` |
| `error` | Only on `failed`. A sentence the user can read; show it on the chip |

The text is read in the background. Poll `GET conversations/{id}/` — the same
list is inlined there, so one poll covers both the turn and the reading — or
`GET attachments/` on its own. The list is unpaginated and in creation order.

**What an attachment is:** raw source text for **this conversation only**. It
is not extracted, not summarised, and it never joins the workspace's Agent
knowledge base — nothing is added to `agent/documents/` or `agent/websites/`.
Deleting the conversation deletes it.

It also **counts as knowledge**: a workspace with nothing connected but one
attached PDF writes posts instead of refusing.

### Refusals

| Status | Body | When |
|---|---|---|
| `400` | `{"file": ["Only PDF files are supported."]}` | Not a `.pdf` |
| `400` | `{"non_field_errors": ["Attach a PDF or a URL — one of the two, not both."]}` | Both sent, or neither |
| `400` | `{"url": [...]}` | Not a usable URL (a schemeless paste is normalised to `https://`, so that is fine) |
| `400` | `{"detail": "A conversation takes at most 5 attachments. Remove one first."}` | Sixth attachment |

A source that could not be read is **not** an HTTP error: the row comes back
`failed` with `error` set, and the turn writes without it.

### Remove one — `DELETE attachments/{aid}/`

`204`. The next turn writes without it. An unknown id is a `404`.

## 3. Send a message — `POST conversations/{id}/messages/`

```json
{ "text": "write a few posts about my technical skills, longer, with emoji" }
```

`text` is required, non-blank, max **4000** characters. A pasted document is a
`400` — that is what an attachment or a Knowledge Source is for.

`202`:

```json
{ "run_id": "0f1c0f4e-6a2e-4b31-9f0a-2b0a5f2e5c11" }
```

The same endpoint does two different jobs, and the agent decides which:

* On a new conversation → a **new batch** of drafts.
* On a `completed` conversation → an **edit** of the drafts it already wrote
  ("make post 2 longer", "regenerate the image on the last one"). `completed`
  is a resting state, not an end state. An edit turn never offers headlines.

### 409s

| `detail` | Meaning | What the UI should do |
|---|---|---|
| `This conversation is already working on something. Wait for it to finish, or cancel it.` | A turn is in flight | Disable send while `status == "running"` |
| `This conversation is waiting on an answer. Reply to the pending question, or cancel it.` | `awaiting_input` | Show the question form, not the text box |
| `Still reading what you attached. Give it a moment and send that again.` | **V2.** An attachment is still `pending` | Disable send until every attachment is `ready`/`failed` |
| `This conversation has been archived. Start a new one.` | Untouched for 7 days while waiting on an answer | Offer "new conversation" |

Shape is always `{"detail": "…"}`.

## 4. Poll — `GET conversations/{id}/`

The whole conversation, every time. Transcript included — a conversation is
bounded by the turns a person takes in it, so there is no pagination here.

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
    "headlines": ["…", "…"]
  },
  "artifacts": { "post_ids": [] },
  "attachments": [ { "id": "9b1f…", "kind": "url", "status": "ready", "…": "…" } ],
  "created_at": "…",
  "updated_at": "…"
}
```

Every field except the two inputs is read-only — `status`, `intent`,
`grounding`, `title`, `pending_interrupt` and `attachments[].status` are what
the server decided.

### `status`

| Value | Meaning | UI |
|---|---|---|
| `draft` | Created, no message yet | Empty composer |
| `running` | A turn is executing | Spinner, send disabled, offer Cancel |
| `awaiting_input` | Suspended on a question **or on the headline round** | Render `pending_interrupt` by its `kind` |
| `completed` | Turn finished — **resting, not terminal** | Show results; the box stays open for edits |
| `failed` | The turn died (vendor error, timeout) | Show the last agent message; the user can resend |
| `cancelled` | The user pressed stop | Terminal for this conversation |
| `archived` | Swept after 7 days awaiting an answer | Terminal; start a new one |

There is no `error` field on the wire. A failure is a **message in the
transcript**, because the request returned `202` long before it happened.

### `messages[]`

`role` is `user` or `agent`. `kind` is one of:

| `kind` | Written by | `payload` |
|---|---|---|
| `text` | user's message; agent's refusals, notices and explanations | `{}` — or, on an answer the user submitted, `{"interrupt_id": "…", "answers": {…}}` |
| `posts` | the turn that wrote drafts | `{"post_ids": ["…"]}` |
| `edit` | an edit turn | `{"post_ids": ["…"], "field": "text" \| "image"}` |
| `error` | the stale-run sweep | `{}` |

A user's answer arrives as a `user`/`text` message with **empty `text`** and the
answers in `payload` — render it from `payload.answers`, not from `text`. That
includes an answered headline round: `payload.answers.headlines` is the list
they approved.

Questions and headline offers are **never** a transcript message. They live
only in `pending_interrupt`, and only the current round exists.

Agent `text` messages worth recognising, because they explain a batch that is
not what the user asked for:

* `That is more posts than I offer headlines for in one go, so here are 10
  first lines — pick from these and we can do more after.`
* `I couldn't ground that in your Agent knowledge, and you asked me not to stop
  for questions — so I wrote it from your message alone.` (Ignore Grilling on.)

### `artifacts.post_ids`

The drafts this conversation produced, in creation order. **That order is the
numbering the user sees** — "post 2" means `post_ids[1]`, and the edit resolver
uses the same ordering, so keep them in this order in the UI.

An edit turn does not add ids; it updates the same posts.

Fetch the posts themselves from the ordinary content route:

```
GET {{baseUrl}}/workspaces/{{workspaceId}}/content/posts/?state=agent
```

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

`interrupt_id` is `pending_interrupt.id` **verbatim**. For questions, `answers`
is keyed by each question's `id` and every question in the round is answered in
one request; at most 40 keys. `202` + `{"run_id": …}`, then poll again.

### 409s

| `detail` | Meaning |
|---|---|
| `That answer is for a question this conversation has moved on from. Reload it to see what it is waiting on.` | Stale `interrupt_id` — re-`GET` and re-render |
| `This conversation is not waiting on an answer.` | Nothing pending; the round already resolved |

---

## Rendering `pending_interrupt`

```json
{ "id": "45fb…", "kind": "questions" | "headlines", "…": "…" }
```

**Branch on `kind`.** Two shapes, and a third would be a third `kind` rather
than a new endpoint — so treat an unknown `kind` as "reload and show the raw
text", not as a crash.

### `kind: "headlines"` — the headline round (V2)

```json
{
  "id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "kind": "headlines",
  "headlines": [
    "The 3am pager taught me more than the postmortem",
    "We cut inference cost 60% and nobody noticed",
    "Your RAG pipeline is a search problem wearing a hat"
  ]
}
```

Each string is **one post's first line**. Render them as an editable list and
send back what the user settled on:

* **Keep** a line → send it unchanged.
* **Reword** it → send the new text. It is used verbatim.
* **Delete** it → leave it out.
* **Add** one → append it.

What comes back is authoritative, and **`count` becomes `len(headlines)`**.
Three lines in, five sent back = five posts. Send `[]` and the batch is written
with no chosen opener (the number then falls back to the panel's `post_count`).
Blank strings are dropped.

The approved line is the post's **first line byte-for-byte**, and the body
under it was written for that line — one write call per headline.

Things to build around:

* At most **10** headlines are ever offered (a spend ceiling). A larger request
  gets 10 plus the transcript notice quoted above.
* The round runs **once** per conversation, only on a **new batch** turn, and
  never on an edit turn.
* It is **skipped** when the panel's `ignore_headline` is on, and skipped
  silently if the model call fails — the turn goes straight to writing. Do not
  build a UI that waits for it.
* It does **not** count against the 2-round question cap.

### `kind: "questions"`

```json
{
  "id": "6032…",
  "kind": "questions",
  "questions": [ /* one or more — typically 2–4 */ ]
}
```

| Field | Notes |
|---|---|
| `id` | The key to answer under. Always present |
| `question` | The text to show |
| `kind` | `choice`, `number`, or `text` |
| `options` | Buttons/radios. Present on `choice` |
| `default` | Pre-select this. May be absent |
| `allow_free_text` | `true` → also show a text input; free text is accepted and used verbatim |
| `min` / `max` | On `kind: "number"` only |
| `field` | Internal — what the answer fills. Ignore it, except as a way to style specific questions |
| `suggested_topics` | On `grounding_gap` only — the same list as `options` minus the first entry |
| `url` | On `link_role_*` only — the link being asked about |

Render generically off `kind` + `options` + `allow_free_text` and you cover
every question the agent can ask. The ones you will actually see:

| `id` | Asked when |
|---|---|
| `tone` | Always, unless already stated — `professional`, `conversational`, `bold`, `storytelling` |
| `length` | Length not stated. `choice` + free text. Options: `about 110-120 words` (default), `about 200 characters`, `about 200 words`, `three short paragraphs` |
| `intent` | It could not tell this was a request for posts |
| `grounding` | It could not tell whether to use the knowledge base or the message alone — **and the panel's `use_knowledge` is off**. With it on, the panel settles it and this is never asked |
| `grounding_gap` | **The knowledge base cannot ground this topic.** Options are "write it from my message alone" plus topics it *can* cover. Free text = a different topic, and it re-checks |
| `link_role_0…` | A URL in the message could be a subject or a voice sample |
| `clarifier_0…2` | Model-written: which launch, which audience, which result to lead with |
| `edit_target` | An edit turn could not tell which draft. Options are the drafts themselves, in their real numbering |

**Gone in V2:** the `count` question. How many posts is on the panel's ladder
(prompt > panel > default), so it always resolves and is never asked.

Notes that matter:

* **`count`, `emoji`, `hashtags`, `knowledge` and `AI image` are never asked
  about.** They always have a value: the prompt's, else the panel's, else the
  default.
* A round is composed in a fixed order: routing questions, then the settings
  form, then one question per ambiguous link, then up to three clarifiers.
  Render them in the order given.
* At most **2 rounds** of questions per conversation. At the cap the agent stops
  asking, takes each unanswered question's own `default`, and writes — except a
  `grounding_gap` it still cannot resolve, which becomes a plain refusal message
  in the transcript. The headline round does not count against this.
* With the panel's **`ignore_grilling`** on, no clarifying round is composed at
  all — the agent writes with the defaults its own questions would have
  offered. Two things it still does, because they are decisions and not
  preferences: it asks which draft an ambiguous **edit** meant, and it says in
  the transcript when it wrote without knowledge instead of guessing.
* An `awaiting_input` conversation nobody answers is archived after **7 days**.

---

## Errors, in one place

| Where | Status | Body |
|---|---|---|
| Validation (blank `text`, >4000 chars, missing `interrupt_id`, bad attachment, `post_count` out of 1–20) | `400` | DRF field errors, or `{"detail": …}` on the attachment cap |
| Foreign / unknown workspace, conversation or attachment | `404` | `{"detail": "Not found."}` |
| Lifecycle conflict | `409` | `{"detail": "…"}` — the sentences listed above |
| A source that could not be read | — | **Not an HTTP error.** `attachments[].status` is `failed` with `error` |
| Vendor failure mid-turn | — | **Not an HTTP error.** `status` becomes `failed` and an agent message says so |

There is no `503` anywhere in Agent Mode: every model call happens after the
request was already answered with `202`.

A turn whose worker died is settled within ~5 minutes by a sweep (a run is
considered stuck after 20 minutes). Until then, messages to that conversation
answer `409`. Show the Cancel button whenever `status == "running"` — it is the
user's way out.

---

## Rendering the drafts

Posts come from `GET content/posts/?state=agent`. Two fields carry the text:

* `body` — plain text. What publishes to LinkedIn, exactly as stored.
* `body_blocks` — the same text described: paragraphs, lists, and which spans
  are bold. Render from this; fall back to `body` if it is `[]`.

```json
"body_blocks": [
  {"type": "paragraph", "spans": [
    {"text": "Most GenAI demos hide a "},
    {"text": "dirty secret", "bold": true},
    {"text": ". 🤫"}
  ]},
  {"type": "paragraph", "spans": [{"text": "What actually moved the needle:"}]},
  {"type": "list", "marker": "-", "tight": true, "items": [
    {"spans": [{"text": "Celery + Redis → "}, {"text": "80%", "bold": true}, {"text": " faster"}]},
    {"spans": [{"text": "pgvector, so no second database bill"}]}
  ]}
]
```

| Key | Meaning |
|---|---|
| `type` | `paragraph` or `list` |
| `spans[]` | `{ text, bold? }`. Span text may contain `\n` — a soft line break |
| `marker` | The literal glyph the writer used: `-`, `*`, `•` or `→` |
| `tight` | `true` = no blank line between this block and the one above |
| `items[]` | List rows, each `{ spans }` |

Blocks separated by a blank line unless `tight`. Arrows, bullets and emoji are
plain characters and publish as-is; **bold** is converted to Unicode math-bold
letters at publish time.

A user editing a draft `PATCH`es `body` as plain text (markdown-lite is
accepted — `**bold**`, `- `/`→ ` lines) and `body_blocks` is re-derived
server-side. Never send `body_blocks`; it is read-only.

**With `use_ai_image` off**, an Agent draft has no picture at all — `image_url`
is `""` and `image_status` is `"none"`. No stock photo stands in, and a later
regenerate will not pick one either. Do not render an image placeholder that
implies one is coming.

**With `use_hashtags` off**, `hashtags` is `[]` and stays that way through a
rewrite.

---

## The composer's panel — `GET`/`PATCH settings/`

```json
{
  "post_count": 5,
  "use_hashtags": true,
  "use_emoji": false,
  "use_knowledge": true,
  "use_ai_image": true,
  "ignore_headline": false,
  "ignore_grilling": false
}
```

`GET` creates the row with these defaults on first read, so it never 404s.
`PATCH` is partial — send only what changed. `post_count` outside **1–20** is a
`400`.

| Field | Default | What it does |
|---|---|---|
| `post_count` | `5` | How many posts a turn writes. Agent Mode's own number, not manual mode's 7 |
| `use_hashtags` | `true` | Off → no hashtags at all, and none on a later rewrite |
| `use_emoji` | `false` | Emoji in the body |
| `use_knowledge` | `true` | **Which knowledge base the turn stands on.** On = the Agent pool *and* the attachments. Off = the attachments alone; the pool is not read, not gated and not paid for |
| `use_ai_image` | `true` | Off → **no image at all**, not even a stock photo |
| `ignore_headline` | `false` | On → skip the headline round and write straight away |
| `ignore_grilling` | `false` | On → skip the clarifying questions and write straight away |

**The prompt outranks the panel** (prompt > panel > default): "no emoji this
time" wins over `use_emoji: true` for that generation, and "write 3 posts" wins
over `post_count: 5`. "Just write them, don't ask me anything" turns
`ignore_grilling` on for that turn. Flipping a switch applies to the **next**
generation; drafts already written keep what they were written under.

Because every one of them always resolves, the agent never asks about them.

**Gone in V2:** `make_longer`. It was a boolean pretending to be a length. "Long"
is now an option on the `length` question, in the user's own unit — and so is
"about 200 characters", which a boolean could never express.

---

## Worked example

```
POST   conversations/                                 201  → id=f4d6…
POST   conversations/f4d6…/attachments/               201  {"id":"9b1f…","status":"pending"}
       (multipart) file=q3-deck.pdf

GET    conversations/f4d6…/                           200  attachments[0].status=pending
GET    conversations/f4d6…/                           200  attachments[0].status=ready

POST   conversations/f4d6…/messages/                  202  {"run_id": "0f1c…"}
       { "text": "write posts about the Q3 launch, longer, with emoji" }

GET    conversations/f4d6…/                           200  status=running
GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt = { kind: "questions", id: "6032…", 3 clarifiers }

POST   conversations/f4d6…/answer/                    202
       { "interrupt_id": "6032…",
         "answers": { "clarifier_0": "The pricing change",
                      "clarifier_1": "Existing customers",
                      "clarifier_2": "Migration is free" } }

GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt = { kind: "headlines", id: "45fb…",
                             headlines: ["…", "…", "…", "…", "…"] }

POST   conversations/f4d6…/answer/                    202
       { "interrupt_id": "45fb…",
         "answers": { "headlines": ["We changed our pricing. Here is the honest version.",
                                    "Migration is free. Here is why we ate the cost.",
                                    "Three things we got wrong about our old plans."] } }
                                                           → 3 headlines = 3 posts

GET    conversations/f4d6…/                           200  status=completed
       artifacts.post_ids = ["a1…","b2…","c3…"]
       messages[-1] = { role: "agent", kind: "posts",
                        text: "Here are 3 draft posts. Nothing publishes until you approve." }

GET    content/posts/?state=agent                     200  → the drafts, with body_blocks

POST   conversations/f4d6…/messages/                  202
       { "text": "make post 2 longer" }                    → edits, no new batch, no headline round
```

---

## Checklist

- [ ] Poll `GET {id}/` every ~2s while `running`; stop on any other status.
- [ ] Send disabled unless `status` is `draft` or `completed` **and** no
      attachment is `pending`.
- [ ] Attachment chips show `pending` / `ready` / `failed` + `error`, and a
      remove button (`DELETE attachments/{aid}/`). Cap at 5 in the UI too.
- [ ] `pending_interrupt` rendered by **`kind`** — `questions` and `headlines`
      are different components; an unknown kind falls back gracefully.
- [ ] Headline list is editable: keep / reword / delete / add. Send the final
      list; it decides how many posts get written.
- [ ] Question form rendered generically from `kind` / `options` /
      `allow_free_text`, with `default` pre-selected. No `count` question.
- [ ] `interrupt_id` echoed verbatim; on a `409` re-`GET` and re-render instead
      of retrying.
- [ ] `artifacts.post_ids` order preserved — it is the numbering the user and
      the agent both mean by "post 2".
- [ ] Panel `PATCH`es partially; `post_count` bounded 1–20 client-side.
- [ ] `use_ai_image: false` → no image placeholder in the draft card.
- [ ] Drafts rendered from `body_blocks`, falling back to `body`.
- [ ] `409` and `404` handled distinctly from `400`.
