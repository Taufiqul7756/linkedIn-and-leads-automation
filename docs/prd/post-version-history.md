# PRD — Post Version History (LinkedIn Agent chat)

Source: backend spec "Post Version History — Frontend Changes" (2026-10). API details: `docs/api-reference.md` → Post versions.

## Problem

Chat cards rendered posts by id from the live post. Every edit overwrote the post, so after "add emojis" then "make it shorter" **every** card in the chat showed the latest text. After the backend dropped the `after` snapshot from `kind: "edit"` messages, edit cards showed only the text ("Updated post 1 — body.") and no post at all.

## Behaviour

- Each chat card renders each of its posts at the version it recorded (`payload.versions[postId]`) via `GET posts/{id}/versions/{n}/`. Status and schedule time always come from the live post.
- Cards without `versions` (pre-versioning chats) render the live post as before; legacy `after` snapshots are still used as a fallback while live posts load.
- **Latest card** per post = last agent card where `versions[postId] === post.current_version` (fallback: last agent card showing the post). Decided **per post** — one card can hold a latest post and an old one.
  - Latest: live status badge, Approve (drafts), Edit text / image / time, selectable.
  - Older: "Old version · vN" badge, **Read more** + "Use this version" (restore hidden for published posts). No edit, select, approve, or time row.
  - **Read more** opens a `Modal` (`2xl`, title "Post N · Old version vK") with the full version: headline, image/video, full `body_blocks` render, and a "Use this version" button (closes on successful restore).
- **Use this version** → `POST conversations/{id}/restore/` → append the returned message, refetch posts. Button disabled while the conversation is `running` or another restore is in flight. Errors shown as toast (`post[0]` field error or `detail`).
- Version `404` → "This post was deleted." placeholder, no buttons.
- Version with `image_status: "pending"` polls every 3s; otherwise cached forever (`["post-version", workspaceId, postId, n]`).
- No delete button on any chat card (delete lives in post management).
- **Version history**: a history icon (`LuHistory`) sits right after the status / "Old version · vN" badge on every chat card. It opens `VersionHistoryModal` (`src/components/linkedin/VersionHistoryModal.tsx`, width `3xl`) — `GET posts/{id}/versions/?page=` newest first, Prev/Next paging. Each row: `vN`, "Current" tag, source label (Generated / Edited in chat / Edited in post management / Regenerated / Restored from vK / Image updated), date, `Prompt: "…"` line from the chat note, image thumb, 3-line body preview with "Show full post" (independent per row — several can stay open to compare; only "Show less" collapses). Non-current rows get "Use this version" (same chat restore; hidden for published posts, disabled while running). Modal closes on a successful restore; `["post-versions", workspaceId, postId]` is invalidated.
- Saving in `EditDraftModal` refetches the conversation so the backend's "You edited post N in post management." card appears.

## Out of scope (for now)

- Restore from the post page (`POST posts/{id}/versions/{n}/restore/`)
