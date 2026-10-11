# Tasks — Stock Image (Pexels)

PRD: `docs/prd/stock-image.md`

- [x] Types: `StockPhoto`, `StockRecommendedResponse`, `StockSearchResponse`; `"stock"` in `GeneratedImage.kind`
- [x] Service: `getStockRecommended`, `searchStock` (`imageChatService`)
- [x] `StockImageModal` — recommended grid, debounced search, infinite scroll, hover Add to post, large preview with Add to post, 503 Retry, close only via ✕
- [x] Stock image button in the Image Chat composer
- [x] Add to post → `patchPostRaw` → refetch chat → invalidate post lists; video-post notice with Switch to image
- [x] `extractErrorMessage` falls back to the first field error (`{"image_url": ["…"]}`)
- [x] Docs: `docs/linkedin-agent.md`, `docs/api-reference.md`, `CONTEXT.md`
- [ ] QA: open modal → recommended grid + placeholder query
- [ ] QA: type → 400 ms → results; scroll → next page; clear → recommended again
- [ ] QA: hover Add to post and preview Add to post → modal closes, "Added a stock photo" card, Edit + Preview show the photo
- [ ] QA: backdrop click and ESC do not close the modal
- [ ] QA: video post → Switch to image notice
