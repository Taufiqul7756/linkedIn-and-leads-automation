# PRD — Knowledge Notes & Switches (LinkedIn Agent)

Source: backend spec "Knowledge switches in the Composer — frontend changes" (Story #3999, Agent Mode only). API details: `docs/api-reference.md` → Knowledge switches.

## Problem

Knowledge sources were all-or-nothing: one `use_knowledge` toggle turned the whole pool on or off, and the agent had no per-source guidance. Users want to tell the agent how to use each source ("Use this for article making") and pick which sources a chat uses.

> The backend field is called `label`, but it is the source's **note for the agent** (confirmed with backend), not a display name.

## Behaviour

### Knowledge card layout
- **Your LinkedIn profile** — LinkedIn profile URL input + list. No note. Non-profile URL → toast, not added.
- **Additional knowledge** — everything else (websites, LinkedIn posts, other links, PDFs), each with an optional note.

### Note at upload (Additional knowledge only)
- **Link** (website, LinkedIn post, any non-profile URL): a "Note for the agent (optional)" field (max 200 chars, counter) is always visible under the URL row → sent as `label` to `websites/`. A profile URL pasted here → toast "Add LinkedIn profiles under Your LinkedIn profile."
- **LinkedIn profile**: added in Your LinkedIn profile, no note.
- **PDF**: the picked file is staged in a card (file name, ✕, note field, Cancel / Upload) instead of uploading immediately → `label` sent with the multipart upload.
- Cleared after a successful add / upload. Tone / Style got the same form + note later — see `tone-style-switches.md`.
- `400 { label: [...] }` → toast with the field error.

### Edit note
- Website / PDF rows keep the file name / URL as the title; under it "Note: …" with ✏️, or "Add note for the agent" when empty → inline input (Enter / ✓ save, Esc / ✕ cancel) → `PATCH {label}` on the source's own route.
- Profile rows: no note shown or edited.

### Composer settings — knowledge switches
- The single **Use knowledge base** toggle is removed (`use_knowledge` no longer sent).
- New **Knowledge** block lists `settings.knowledge` (oldest first): kind icon (PDF / Website / LinkedIn), `name` as the title with a "Note: …" line when `label` is set, status badge for non-ready (Processing / Failed), and a toggle.
- Each flip saves immediately: optimistic cache update of that one item → `PATCH settings/ { knowledge: [{ kind, id, enabled }] }` → invalidate. On error the item rolls back and a toast shows.
- Empty pool → "No knowledge yet" + **Add in Knowledge base** link (opens the modal).
- All off → posts are written without knowledge (backend). Attachments are not listed — always used for their chat.
- Upload / note edit / delete in `KnowledgeBaseModal` invalidates `["agent-settings", workspaceId]` so the list stays in sync.

## Out of scope
- Switches inside the Knowledge base modal (composer only, per decision)
- Notes on tone/style sources and on LinkedIn profiles
- Paused Autopilot page (`/linkedin-autopilot`) — untouched
