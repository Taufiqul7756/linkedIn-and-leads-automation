# Tasks — Post Version History

PRD: `docs/prd/post-version-history.md`

- [x] Remove delete button from all chat cards (`DraftCard`, `AllDraftsModal`)
- [x] Types: `current_version` on `AgentPost`; `PostVersion`; `RestoreVersionResponse`
- [x] Service: `getPostVersion`, `restoreVersion` (`linkedinAgentService`)
- [x] `VersionedDraftCard` — fetch version, merge live status/time, 404 → deleted, poll pending image
- [x] `getLatestCardByPost` — latest-card rule per post
- [x] `DraftCard` read-only / old-version mode + "Use this version"
- [x] Edit cards render from `payload.post_ids` + `payload.versions` (no more `after`)
- [x] Posts cards render via `renderCard` with the message's versions
- [x] Restore handler — append message, refetch posts, toast errors
- [x] Refetch conversation after `EditDraftModal` save
- [ ] QA: generate 2 → edit 1 in chat → old card shows "Old version · v1"; restore v1 → new card is latest
- [ ] QA: edit in post management → "You edited post N…" card appears and is latest
- [ ] QA: old pre-versioning chat still renders
- [ ] Optional: version history list / restore from post page
