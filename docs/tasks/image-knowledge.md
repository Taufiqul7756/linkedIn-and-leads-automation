# Tasks — Image Knowledge (brand guide for pictures)

PRD: `docs/prd/image-knowledge.md`

- [x] Types: `ImageKnowledgeSource` (full shape), `ImageKnowledgeSwitch` (settings shape), `ImageKnowledgeKind`, `ImageKnowledgeStatus`
- [x] Service (`imageChatService`): `getWorkspaceSettings`, `toggleImageKnowledge`, `listImageKnowledge` (all pages), `addImageKnowledge` (text / url), `uploadImageKnowledgePdf` (multipart), `patchImageKnowledgeLabel`, `deleteImageKnowledge`; hooks `useImageKnowledgeList` / `useImageKnowledgeSwitches`
- [x] "Image knowledge base" button in the Image Agent header row, aligned with the title
- [x] `ImageKnowledgeModal` — same design as `KnowledgeBaseModal`: URL / PDF add form with note, free-hand text with note, rows (type badge, filename / clickable URL, editable note, status, delete confirm)
- [x] Poll every 2–3 s while any source is `pending`
- [x] Image agent settings popover: Image knowledge switch list under Use post body; optimistic single-row flip → PATCH → replace list from response; rollback + toast on error; empty state opens modal
- [x] Shared `KnowledgeSourceParts.tsx` (note input / inline note / link / status) used by both knowledge modals; `SourceIcon` gets a `text` kind
- [x] Refresh both lists after add / rename / delete
- [x] Edit free text: pencil on text rows → text opens in Write it yourself → Save changes (`PATCH { text }`) / Cancel; no note on text sources
- [x] Docs: `docs/linkedin-agent.md`, `docs/api-reference.md`, `CONTEXT.md`
- [ ] QA: add text → `ready`, on; add URL / PDF → `pending` spinner → `ready` or `failed` with error sentence
- [ ] QA: URL row link opens in a new tab; edit note → saved; delete → confirm → gone from modal and popover
- [ ] QA: toggle in popover → only that row changes; several can be on at once
- [ ] QA: validation errors (non-PDF, blank text, >8,000 chars, invalid URL, >200-char note) show the backend message
- [ ] QA: edit a text source → Save changes → row shows new text, switch unchanged; Cancel restores the empty box
