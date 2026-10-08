# Tasks — Knowledge Notes & Switches

PRD: `docs/prd/knowledge-switches.md`

- [x] Types: `label`, `enabled` on `ProfileDocument` / `ProfileWebsite` / `LinkedInProfile`; `KnowledgeSwitch` + `knowledge` on `AgentSettings`; remove `use_knowledge` from `AgentSettings`
- [x] Service: `label` on create calls; `patchAgentDocument` / `patchAgentWebsite` / `patchProfile` (label); settings PATCH accepts `knowledge` switch list
- [x] `useAgentSettings`: `setKnowledgeEnabled` — optimistic per-item update + rollback
- [x] KnowledgeBaseModal: split Knowledge card into Your LinkedIn profile (no note) + Additional knowledge
- [x] Source icons (`SourceIcon` vector tiles: website / PDF / LinkedIn) in Knowledge base modal + composer
- [x] Composer settings: Knowledge accordion + read-only Tone / Style accordion
- [x] Less text (team feedback): blue tip → 💡 guide on Knowledge title, no subsection hints, short placeholders, "Upload PDF", single-line note input, Your LinkedIn profile input hidden once a profile exists
- [x] KnowledgeBaseModal: note field always visible under the Additional knowledge URL + staged PDF card with note
- [x] KnowledgeBaseModal: "Note: …" line under website / PDF rows + inline note edit
- [x] KnowledgeBaseModal: invalidate agent-settings after add / note edit / delete
- [x] Composer settings: remove Use knowledge base toggle; add Knowledge switch list (status badges, empty state link)
- [x] Docs: `docs/linkedin-agent.md`, `docs/api-reference.md`, `CONTEXT.md`
- [ ] QA: upload PDF with a note → appears in composer list (name + Note line), on; flip off → reload keeps it off
- [ ] QA: edit a note → composer list shows the new note
- [ ] QA: profile URL in Additional knowledge → toast; non-profile URL in Your LinkedIn profile → toast
- [x] Additional knowledge: Add link appears only after typing; URL validation (inline error after blur / Add)
- [ ] QA: invalid link (e.g. `hello`) → Add link disabled, red message after blur; `acme.com` → adds
- [ ] QA: no sources → empty state link opens Knowledge base
