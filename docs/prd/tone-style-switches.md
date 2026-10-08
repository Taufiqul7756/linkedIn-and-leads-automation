# PRD — Tone / Style Notes & Switches (LinkedIn Agent)

Agent Mode only. Story #4025. Builds on [knowledge-switches.md](knowledge-switches.md) (story #3999).
API: `docs/api-reference.md` → Tone / style switches.

## Problem

Only one tone/style source could be used — the one marked `is_default`. Users with several writing samples couldn't choose which voices to use, mix them, or tell the agent what each sample is for.

> The backend field is `label`. As with knowledge, the UI treats it as the source's **note for the agent** (e.g. "Use for greetings and sign-offs"); the file name / URL stays the title.

## Behaviour

### Note at upload (Tone / Style card)
- **Link**: the ↳ note field appears under the URL once something is typed, **Add link** appears too (same as Additional knowledge). URL validated with `isValidUrl`. Sent as `label` with `purpose: "tone"`.
- **PDF**: **Upload PDF** stages the file in a card (file name, ✕, ↳ note, Cancel / Upload) → `label` sent with the multipart upload.
- `400 { label: [...] }` → toast with the field error.

### Edit note
- Tone / style rows: "Note: …" under the name with ✏️, or "Add note for the agent" → inline input → `PATCH { label }` on the source's own route.

### Composer settings — Tone / Style switches
- The Tone / Style accordion lists `settings.tone_and_style` (oldest first): icon, name, "Note: …" line when `label` is set, Processing / Failed badge, and a toggle.
- Flip → optimistic update of that item → `PATCH settings/ { tone_and_style: [{ kind, id, enabled }] }` → invalidate. Error → roll back + toast (`tone_and_style[0]`, else `detail`).
- Several can be on at once. All off = default voice. Summary "n of total on".
- Settings poll every 3s while any knowledge **or voice** item is still processing.
- `is_default` no longer picks the voice — the **Default** badge is removed.

### Sync
- Tone add / note edit / delete in `KnowledgeBaseModal` invalidate `["agent-settings", workspaceId]`.

## Out of scope
- LinkedIn profiles as voice sources (`kind: linkedin` is refused by the API).
