# PRD — Image Knowledge (brand guide for pictures)

Source: backend spec "Image Knowledge (brand guide for pictures) — frontend changes" (Story #4075, 2026-10). API details: `docs/api-reference.md` → Image Chat → Image Knowledge (to be added when built).

## Problem

Generated pictures ignore the brand: colours, fonts for text on images, logo rules and visual style. Users want to upload a brand guide once and have every picture the workspace makes follow it.

## Concepts

- **Source** — one uploaded piece of image knowledge: a **PDF**, a **URL** or **free-hand text**.
- **Note** — the optional text the user writes for a source. Sent as the backend `label` field (max 200 characters). The backend uses it when building the image prompt.
- **Workspace-wide** — sources belong to the workspace, not to a chat. The same switches apply in every Image Chat and to pictures made outside a chat (a post's automatic picture, the composer's "generate image" button, image edits in Agent Mode).
- Switching a source on/off applies to the **next** picture only. The user's own message still wins over the brand guide.

## Behaviour

### 1. Image knowledge base button

- In the **Image Agent** header bar of the left (chat) panel on `/linkedin/edit-image/[postId]`, in the same row and vertically aligned with the "Image Agent" title (right side of the row).
- Same style as the LinkedIn Agent's Knowledge base button.
- Click → opens `ImageKnowledgeModal`.

### 2. Image knowledge base modal

Same design as the LinkedIn Agent `KnowledgeBaseModal` (dark section header with ⓘ `HoverGuide`, add form, source rows, status badges, inline-editable note, delete confirm modal).

- **Add URL or PDF** — paste a URL or upload a `.pdf`, plus an optional **note**. URL → JSON `{ url, label }`; PDF → multipart `file`, `label`.
- **Free-hand text** — a textarea (max 8,000 characters), **no note** (the text itself says how to use it) → JSON `{ text }`. Blank text is not sent.
- **Rows**, oldest first, one per source:
  - type badge: `PDF` / `www` / `Text`
  - title: PDF **filename**, or the **URL as a clickable link** (new tab); text sources show the start of their text
  - an **On** chip when the source is switched on
  - **note** below the title (links and PDFs only), inline-editable → `PATCH image-chats/knowledge/{id}/ { label }`
  - status: spinner while `pending`; the backend `error` sentence (shown as is) when `failed`
  - delete → confirm modal → `DELETE image-chats/knowledge/{id}/`
- A free-hand text has no note. Its **text can be edited**: pencil icon on the row (text rows only) → the text opens in the Write it yourself box (blue "Editing a text source" state, row highlighted) → **Save changes** (`PATCH image-chats/knowledge/{id}/ { text }`, disabled while unchanged or blank) or **Cancel**. Id, list position and on/off switch stay the same. PDFs and URLs can't be edited (delete + add again).
- **Polling:** while any source is `pending`, refetch every 2–3 s; stop when none are pending.
- After add / rename / delete, refresh both the modal list and the settings switch list.
- Errors: backend field messages shown as is (exactly-one-source, PDF only, blank text, 8,000 chars, invalid URL, 200-char label).

### 3. Image agent settings popover (⚙ in the chatbox)

- **Use post body** stays as is (per-chat settings route).
- Below it, an **Image knowledge** list from `GET image-chats/settings/` (workspace route, no chat id) → `image_knowledge`: kind icon, `name`, and a **switch** bound to `enabled` — same look as the LinkedIn composer's Knowledge switches (`SourceSwitchList`).
- `pending` rows show a spinner and can still be switched; `failed` rows show a failed hint.
- **Toggle:** flip only the clicked row optimistically → `PATCH image-chats/settings/ { image_knowledge: { id, enabled } }` → replace the list with the response's `image_knowledge`. Toggles are independent — any number of sources can be on at once. All sources switched on share 8,000 characters in the image prompt (oldest first, the newest cut when over); the modal ⓘ guide says so.
- On error: roll back the row and toast the message.
- **Empty state:** "Add in Image knowledge base" link → opens the modal.
- The popover is widened to `w-80` (same as the LinkedIn composer panel). More than 5 rows → the list scrolls; long titles truncate.

## Data

- Modal list: `GET image-chats/knowledge/` (paginated 25 per page — fetch all pages) — needs `filename`, `url`, `text`, `label`, `status`, `error`.
- Switch list: `GET image-chats/settings/` → `image_knowledge`.
- Query keys (workspace-scoped): `["image-knowledge", workspaceId]`, `["image-knowledge-settings", workspaceId]`.

## Out of scope

- Editing a source's content (delete and add again).
- Crawling a whole site — a URL is read as one page, so the URL field hint asks for the brand-guide page itself.
- Image Knowledge UI outside the edit-image page.
