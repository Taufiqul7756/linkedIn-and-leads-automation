# PRD — Post Version History (LinkedIn Agent chat)

Source: backend spec "Post Version History — Frontend Changes" (2026-10). API details: `docs/api-reference.md` → Post versions.

## Problem

Chat cards rendered posts by id from the live post. Every edit overwrote the post, so after "add emojis" then "make it shorter" **every** card in the chat showed the latest text. After the backend dropped the `after` snapshot from `kind: "edit"` messages, edit cards showed only the text ("Updated post 1 — body.") and no post at all.

## Behaviour

- Each chat card renders each of its posts at the version it recorded (`payload.versions[postId]`) via `GET posts/{id}/versions/{n}/`. Status and schedule time always come from the live post.
- Cards without `versions` (pre-versioning chats) render the live post as before; legacy `after` snapshots are still used as a fallback while live posts load.
- **Latest card** per post = last agent card where `versions[postId] === post.current_version` (fallback: last agent card showing the post). Decided **per post** — one card can hold a latest post and an old one.
  - Latest: live status badge, Approve (drafts), Edit text / image / time, selectable.
  - Older: "Old version · vN" badge, **only** "Use this version" (hidden for published posts). No edit, select, approve, or time row.
- **Use this version** → `POST conversations/{id}/restore/` → append the returned message, refetch posts. Button disabled while the conversation is `running` or another restore is in flight. Errors shown as toast (`post[0]` field error or `detail`).
- Version `404` → "This post was deleted." placeholder, no buttons.
- Version with `image_status: "pending"` polls every 3s; otherwise cached forever (`["post-version", workspaceId, postId, n]`).
- No delete button on any chat card (delete lives in post management).
- Saving in `EditDraftModal` refetches the conversation so the backend's "You edited post N in post management." card appears.

## Out of scope (for now)

- Version history list UI (`GET posts/{id}/versions/`)
- Restore from the post page (`POST posts/{id}/versions/{n}/restore/`)
