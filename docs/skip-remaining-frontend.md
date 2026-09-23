# Skip Remaining Questions — frontend changes

## 1. `GET .../conversations/{id}/` (and the `202` poll response)

`pending_interrupt` gains one new field, only on `kind: "questions"`:

```json
{
  "id": "6032…",
  "kind": "questions",
  "questions": [
    /* unchanged */
  ],
  "can_skip": false
}
```

- `can_skip: false` → don't show the skip control. This is always the case on
  the **first** round of a turn.
- `can_skip: true` → show a "skip the rest" button/link alongside the
  questions. This happens from the **second** round onward (any time the
  agent asks again in the same turn).

Applies to every `kind: "questions"` round the same way — including the rare
"I can't ground that" question, not just the main tone/topic/length round.

## 2. `POST .../conversations/{id}/answer/`

The `answers` body accepts one new optional key:

```json
{
  "answers": {
    "skip_remaining": true
  }
}
```

- Can be sent **alone**, or **alongside** real answers to the round currently
  shown (e.g. the user answers tone/length _and_ clicks skip in one submit —
  both are applied).
- Only takes effect when `can_skip` was `true` for that round. Sending it on
  round 1 is silently ignored (no error, just no effect) — so no need to
  guard against it client-side beyond hiding the button.
- When it takes effect, the agent stops asking and writes the post(s)
  immediately with defaults for anything left unanswered — same as what
  happens today when the round limit is hit.

## Nothing else changes

Same response shapes, same polling, same everything else. This is purely:
render a button when `can_skip` is true, and send one extra key when clicked.
