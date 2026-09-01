# Agent Mode — frontend integration

One prompt box, one conversation. The user types what they want, the agent asks
what it needs, then writes **draft Posts**. Nothing publishes: a draft goes
through the same approve → schedule gate as every other post.

Everything below is under:

```
{{baseUrl}}/workspaces/{{workspaceId}}/agent/
```

`baseUrl` is `https://<host>/api/v1`. Every request needs
`Authorization: Token <key>`. A workspace the user does not own answers **404**
(never 403).

---

## The four endpoints

| Method | Path | Returns |
|---|---|---|
| `POST` | `conversations/` | `201` + empty conversation |
| `GET` | `conversations/{id}/` | `200` + conversation, transcript, pending question, post ids |
| `POST` | `conversations/{id}/messages/` | `202` + `{"run_id": "…"}` |
| `POST` | `conversations/{id}/answer/` | `202` + `{"run_id": "…"}` |

Two of them are **async**. `messages/` and `answer/` return `202` immediately;
the turn runs on a Celery worker for roughly 10–60 seconds. The client polls
`GET conversations/{id}/` and renders whatever state it finds. The `run_id` is
for logs and correlation — there is no endpoint that takes it.

Also available and worth wiring:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `conversations/` | Paginated list, no transcripts (`page`, `page_size`, default 25) |
| `POST` | `conversations/{id}/cancel/` | Stop button. Idempotent, returns the conversation |
| `DELETE` | `conversations/{id}/` | `204`. Gone, including the transcript |
| `GET`/`PATCH` | `settings/` | The composer's four toggles (see the last section) |

---

## The loop, in order

```
1. POST conversations/                    → id
2. POST conversations/{id}/messages/      → 202
3. GET  conversations/{id}/  (poll ~2s)   → status
      running         → keep polling
      awaiting_input  → render pending_interrupt, go to 4
      completed       → render artifacts.post_ids, done (or send another message)
      failed          → render the last agent message
4. POST conversations/{id}/answer/        → 202, back to 3
```

A conversation is created empty and does nothing until the first message. It is
fine to create it when the user opens the composer.

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
  "created_at": "2026-09-01T09:33:44.583173Z",
  "updated_at": "2026-09-01T09:33:44.583173Z"
}
```

## 2. Send a message — `POST conversations/{id}/messages/`

```json
{ "text": "write a few posts about my technical skills, make them longer and use emoji" }
```

`text` is required, non-blank, max **4000** characters. A pasted document is a
`400` — that is what a Knowledge Source is for.

`202`:

```json
{ "run_id": "0f1c0f4e-6a2e-4b31-9f0a-2b0a5f2e5c11" }
```

The same endpoint does two different jobs, and the agent decides which:

* On a new conversation → a **new batch** of drafts.
* On a `completed` conversation → an **edit** of the drafts it already wrote
  ("make post 2 longer", "regenerate the image on the last one"). `completed`
  is a resting state, not an end state.

### 409s

| `detail` | Meaning | What the UI should do |
|---|---|---|
| `This conversation is already working on something. Wait for it to finish, or cancel it.` | A turn is in flight | Disable send while `status == "running"` |
| `This conversation is waiting on an answer. Reply to the pending question, or cancel it.` | `awaiting_input` | Show the question form, not the text box |
| `This conversation has been archived. Start a new one.` | Untouched for 7 days while waiting on an answer | Offer "new conversation" |

Shape is always `{"detail": "…"}`.

## 3. Poll — `GET conversations/{id}/`

The whole conversation, every time. Transcript included — a conversation is
bounded by the turns a person takes in it, so there is no pagination here.

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
    "questions": [ … ]
  },
  "artifacts": { "post_ids": [] },
  "created_at": "…",
  "updated_at": "…"
}
```

Every field except the two inputs is read-only — `status`, `intent`,
`grounding`, `title` and `pending_interrupt` are what the agent decided.

### `status`

| Value | Meaning | UI |
|---|---|---|
| `draft` | Created, no message yet | Empty composer |
| `running` | A turn is executing | Spinner, send disabled, offer Cancel |
| `awaiting_input` | Suspended on a question | Render `pending_interrupt` |
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
| `text` | user's message; agent's refusals and explanations | `{}` — or, on an answer the user submitted, `{"interrupt_id": "…", "answers": {…}}` |
| `posts` | the turn that wrote drafts | `{"post_ids": ["…"]}` |
| `edit` | an edit turn | `{"post_ids": ["…"], "field": "text" \| "image"}` |
| `error` | the stale-run sweep | `{}` |

A user's answer arrives as a `user`/`text` message with **empty `text`** and the
answers in `payload` — render it from `payload.answers`, not from `text`.

Questions are **never** a transcript message. They live only in
`pending_interrupt`, and only the current round exists. Past rounds are visible
through the answer messages above.

### `artifacts.post_ids`

The drafts this conversation produced, in creation order. **That order is the
numbering the user sees** — "post 2" means `post_ids[1]`, and the edit resolver
uses the same ordering, so keep them in this order in the UI.

An edit turn does not add ids; it updates the same posts.

Fetch the posts themselves from the ordinary content route:

```
GET {{baseUrl}}/workspaces/{{workspaceId}}/content/posts/?state=agent
```

## 4. Answer a question — `POST conversations/{id}/answer/`

```json
{
  "interrupt_id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "answers": {
    "clarifier_0": "Generative AI development — LLM integrations and RAG",
    "grounding_gap": "write it from my message alone"
  }
}
```

`interrupt_id` is `pending_interrupt.id` **verbatim**. `answers` is keyed by
each question's `id`. Answer every question in the round in one request; at most
40 keys. `202` + `{"run_id": …}`, then poll again.

### 409s

| `detail` | Meaning |
|---|---|
| `That answer is for a question this conversation has moved on from. Reload it to see what it is waiting on.` | Stale `interrupt_id` — re-`GET` and re-render |
| `This conversation is not waiting on an answer.` | Nothing pending; the round already resolved |

---

## Rendering `pending_interrupt`

```json
{
  "id": "45fb6c398cd543e1aebdf2fed9d30e57",
  "kind": "questions",
  "questions": [ /* one or more — typically 2–5 */ ]
}
```

`kind` is always `"questions"` today. Each question:

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
| `suggested_topics` | On `grounding_gap` only — the same list as `options` minus the first entry, so you can render them as suggestions rather than as two kinds of option |
| `url` | On `link_role_*` only — the link being asked about |

Render generically off `kind` + `options` + `allow_free_text` and you cover
every question the agent can ask. The ones you will actually see:

| `id` | Asked when |
|---|---|
| `count` | The message did not say how many posts (default 7) |
| `tone` | Always, unless already stated — `professional`, `conversational`, `bold`, `storytelling` |
| `length` | Length not stated and Make-longer not toggled. Free text allowed ("about 200 characters") |
| `intent` | It could not tell this was a request for posts |
| `grounding` | It could not tell whether to use the knowledge base or the message alone |
| `grounding_gap` | **The knowledge base cannot ground this topic.** Options are "write it from my message alone" plus topics it *can* cover. Free text = a different topic, and it re-checks |
| `link_role_0…` | A URL in the message could be a subject or a voice sample |
| `clarifier_0…2` | Model-written: which launch, which audience, which result to lead with |
| `edit_target` | An edit turn could not tell which draft. Options are the drafts themselves, in their real numbering |

Notes that matter:

* **`emoji`, `knowledge`, `AI image` and `make longer` are never asked about.**
  They always have a value: the prompt's, else the stored toggle, else the
  default.
* A round is composed in a fixed order: routing questions, then the settings
  form, then one question per ambiguous link, then up to three clarifiers.
  Render them in the order given.
* At most **2 rounds** of questions per conversation. At the cap the agent stops
  asking, takes each unanswered question's own `default`, and writes — except a
  `grounding_gap` it still cannot resolve, which becomes a plain refusal message
  in the transcript.
* An `awaiting_input` conversation nobody answers is archived after **7 days**.

---

## Errors, in one place

| Where | Status | Body |
|---|---|---|
| Validation (blank `text`, >4000 chars, missing `interrupt_id`) | `400` | DRF field errors |
| Foreign / unknown workspace or conversation | `404` | `{"detail": "Not found."}` |
| Lifecycle conflict | `409` | `{"detail": "…"}` — the sentences listed above |
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
  are bold. Render from this; fall back to `body` if it is `[]` (rows written
  before this feature).

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
| `tight` | `true` = no blank line between this block and the one above (a lead-in directly over its bullets) |
| `items[]` | List rows, each `{ spans }` |

Blocks separated by a blank line unless `tight`. Arrows, bullets and emoji are
plain characters and publish as-is; **bold** is converted to Unicode math-bold
letters at publish time, so what the user sees bold in the composer is bold in
the published post.

A user editing a draft `PATCH`es `body` as plain text (markdown-lite is
accepted — `**bold**`, `- `/`→ ` lines) and `body_blocks` is re-derived
server-side. Never send `body_blocks`; it is read-only.

---

## The composer's toggles — `GET`/`PATCH settings/`

```json
{ "use_emoji": false, "use_knowledge": true, "use_ai_image": false, "make_longer": false }
```

`PATCH` is partial — send only what changed. They are what the user meant when
they said nothing in particular, so **the prompt outranks them**: "no emoji this
time" wins over `use_emoji: true` for that generation. Flipping one applies to
the next generation; drafts already written keep what they were written under.

Because these four always resolve, the agent never asks about them.

---

## Worked example

```
POST   conversations/                                 201  → id=f4d6…
POST   conversations/f4d6…/messages/                  202  {"run_id": "0f1c…"}
       { "text": "write posts about my technical skills, longer, with emoji" }

GET    conversations/f4d6…/                           200  status=running
GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt.id = 6032…, 3 clarifier questions

POST   conversations/f4d6…/answer/                    202
       { "interrupt_id": "6032…",
         "answers": { "clarifier_0": "Generative AI development",
                      "clarifier_1": "Recruiters",
                      "clarifier_2": "Cutting inference cost with RAG" } }

GET    conversations/f4d6…/                           200  status=awaiting_input
       pending_interrupt.id = 45fb…, one grounding_gap question

POST   conversations/f4d6…/answer/                    202
       { "interrupt_id": "45fb…",
         "answers": { "grounding_gap": "write it from my message alone" } }

GET    conversations/f4d6…/                           200  status=completed
       artifacts.post_ids = ["a1…","b2…","c3…"]
       messages[-1] = { role: "agent", kind: "posts",
                        text: "Here are 3 draft posts. Nothing publishes until you approve." }

GET    content/posts/?state=agent                     200  → the drafts, with body_blocks

POST   conversations/f4d6…/messages/                  202
       { "text": "make post 2 longer" }                    ← edits, does not start a new batch
```

---

## Checklist

- [ ] Poll `GET {id}/` every ~2s while `running`; stop on any other status.
- [ ] Send disabled unless `status` is `draft` or `completed`.
- [ ] Cancel button visible while `running` and `awaiting_input`.
- [ ] Question form rendered generically from `kind` / `options` /
      `allow_free_text`, with `default` pre-selected.
- [ ] `interrupt_id` echoed verbatim; on a `409` re-`GET` and re-render instead
      of retrying.
- [ ] `artifacts.post_ids` order preserved — it is the numbering the user and
      the agent both mean by "post 2".
- [ ] Drafts rendered from `body_blocks`, falling back to `body`.
- [ ] `409` and `404` handled distinctly from `400`.
