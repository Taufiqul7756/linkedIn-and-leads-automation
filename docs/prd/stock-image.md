# PRD — Stock Image (Pexels) in the Image Chat

Source: backend spec "Stock photos (Pexels) in the Image Chat — frontend changes" (Story #4026, 2026-10). API details: `docs/api-reference.md` → Image Chat → §5 Stock photos.

## Problem

The Image Chat can only generate AI pictures. Users want to put a real photo on a post without prompting for one.

## Behaviour

- **Stock image** button in the Image Chat composer toolbar, directly left of the AI model button. Disabled while the chat is `running`. Hidden with the rest of the composer on published posts.
- Opens `StockImageModal` (`src/components/linkedin/StockImageModal.tsx`, `Modal` width `4xl`, `disableBackdropClose`) — closes **only** via the ✕ button (no backdrop click, no ESC).
- **Recommended**: on open, `GET image-chats/{chatId}/stock/recommended/`. Skeleton grid while loading. The returned `query` becomes the search box placeholder. Empty `query` + no photos → only the search box with a "Search for a photo" hint.
- **Search**: as-you-type, debounced 400 ms. Blank/whitespace input is never sent — clearing the box goes back to the recommended grid. `GET stock/search/?q=&page=1`, then **infinite scroll** (`page + 1` while `has_more`) via an `IntersectionObserver` sentinel at the end of the grid. No results → "No photos found for '…'".
- **Grid card** (3 columns, `thumbnail_url`, `alt` as tooltip): hover shows an **Add to post** button and a dark overlay with the photographer credit. Clicking the card opens a **large preview**.
- **Large preview** (overlay inside the modal): `url` image at natural aspect ratio, photographer credit + "View on Pexels" link, **Add to post** button, ✕ / Back to return to the grid.
- **Add to post** (grid or preview): `PATCH content/posts/{postId}/ { image_url: photo.url }` (always `url`, never `thumbnail_url`) via `patchPostRaw` so errors surface. While in flight that photo's button shows a spinner and all other Add buttons are disabled. On success: close the modal, refetch the chat (`GET image-chats/{chatId}/`) — the new "Added a stock photo to your post." card appears marked **Added**, and `chat.post_image_url` updates both the Edit (Media section) and Preview tabs. Post list queries are invalidated.
- **Video post**: if the PATCH response still has `media_type: "video"`, show a toast explaining the photo is saved but the video publishes, with a **Switch to image** action (`PATCH { media: "image" }`).
- **Errors**: backend text shown as is. Recommended / search `503` → message + **Retry** button inside the modal. `PATCH` `400` (published post) → toast with the field message.
- `kind: "stock"` chat cards render like any other image card (Add to post on older stock cards uses `add_to_post/` as before).

## Out of scope

- Stock photos outside the Image Chat (post management, agent cards).
- Multi-select.
