# PRD — Agent chat attachments (numbered, used on request)

Story #4084 · LinkedIn Agent (`/linkedin/automation` → `AutomationView`) · Agent Mode only.

## Goal

The user attaches PDFs and URLs to an Agent Mode conversation with the `+` in the prompt box and
tells the agent in the message which file to use and what for. An attachment the message
doesn't mention is ignored.

## Behaviour

### Attach (`+` button — now active)

- `+` opens the attach popover: **Upload a PDF** or **Paste a URL** → **Add**.
- Disabled while the agent is working, waiting for answers, or generating more drafts.
- No conversation yet → one is created first (an attachment needs a conversation id).
- At most 5 attachments per conversation ("Maximum 5 attachments reached.").
- Routes unchanged: `POST/GET conversations/{id}/attachments/`, `DELETE attachments/{aid}/`.

### Numbered chips

- Every attachment has a backend `number` (from 1, upload order, per conversation).
- Chip shows **`#number label`** (e.g. `#2 pricing.pdf`), list ordered by `number`.
- The number is fixed: deleting #2 leaves #1 and #3, the next upload is #4. The frontend never
  renumbers.
- Pending → spinner; failed → red chip with "Failed", the `error` as tooltip; × removes it.
- While the `POST` is in flight an "Uploading… <name>" chip shows at once (no blank gap).
- After adding, poll `GET conversations/{id}/` now and every 2s until no attachment is `pending`
  (also when the agent isn't running); opening a conversation with a pending attachment resumes it.

### Say how to use it

- Once something is attached, the empty prompt box shows a hint built from the real numbers, e.g.
  *Say how to use it — "use #1 as knowledge, #3 for tone"* (replaces the cycling examples).
- A small line under the chips: *Only attachments your message mentions are used — refer to them
  by number, name or type.*

### Attachment questions

- New question round fields `attachment_which` ("Which attachment?", no default) and
  `attachment_use` ("How should I use it?", default "as knowledge").
- Asked even when Ask Questions is off; round has `can_skip: false` → no "Skip questioning".
- A choice question with no default shows a **"Choose one…"** placeholder and **Next** stays
  disabled until an option is picked (or the question is switched off — a blank answer ends the
  turn with an `attachment_unclear` message).
- A default is pre-selected (`attachment_use` → "as knowledge").

### New agent messages

`payload.kind` = `attachment_unusable`, `attachment_unclear`, `attachment_decision_failed` are
ordinary agent text messages; the chat shows them in an amber bubble so they read as "fix and send
again" rather than a normal reply.

### Unchanged

- Send disabled while any attachment is `pending` (`409` otherwise).
- Edits and "Generate more drafts" keep their files — nothing to send.
