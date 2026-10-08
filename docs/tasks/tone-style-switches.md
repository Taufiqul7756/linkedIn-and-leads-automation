# Tasks — Tone / Style Notes & Switches

PRD: `docs/prd/tone-style-switches.md` · Story #4025

- [x] Types: `VoiceSwitch`, `AgentSettings.tone_and_style`, `AgentSettingsPatch.tone_and_style`
- [x] `useAgentSettings`: `setVoiceEnabled` (optimistic per item, rollback, `tone_and_style[0]` toast); poll while voice processing
- [x] Composer: Tone / Style accordion → switches from `settings.tone_and_style` (drop the documents/websites queries + Default badge)
- [x] KnowledgeBaseModal Tone card: ↳ note under link (appears after typing) + Add link after typing + URL validation
- [x] KnowledgeBaseModal Tone card: staged PDF with note
- [x] KnowledgeBaseModal: inline note edit on tone rows; invalidate agent-settings after tone add / note edit / delete
- [x] Docs: linkedin-agent.md, api-reference.md, CONTEXT.md
- [x] Fix: backend field is `tone_and_style`, not `voice` (spec md was wrong); `purpose` optional (not sent)
- [x] Composer settings panel in a portal (fixed, z-50) — no longer clipped by the chat column's overflow-hidden when an accordion expands
- [x] Accordions: >5 sources → list scrolls inside; subtitles → ⓘ hover tips (`HoverGuide anchor="parent" position="top"`)
- [x] Accordion rows: website / LinkedIn names open in a new tab; "Note:" bold, note line same gray as the name
- [ ] Confirm with backend: PATCH key is `tone_and_style` (assumed to match GET)
- [ ] QA: upload tone PDF with a note → composer Tone / Style list shows it, on; flip off → reload keeps it off
- [ ] QA: two tone sources on at once → both stay on
- [ ] QA: edit a tone note → composer shows the new note
