# Tasks — Agent chat attachments

PRD: `docs/prd/agent-attachments.md` · Story #4084

## Build

- [x] `Attachment.number` in `src/types/LinkedInAgent.ts`
- [x] Enable the `+` button (remove "Soon"), disable while running / awaiting / generating more
- [x] Chips show `#number label`, sorted by `number`
- [x] Prompt hint with real numbers once something is attached + "only mentioned attachments are used" line
- [x] Question card: blank-default choice → "Choose one…" placeholder, Next disabled until picked
- [x] Amber bubble for `attachment_unusable` / `attachment_unclear` / `attachment_decision_failed`
- [x] Fix: keep polling while any attachment is pending (not only while running), first check at once, resume on open
- [x] "Uploading… <name>" chip while the attachment POST is in flight
- [x] Docs: `docs/linkedin-agent.md`, `docs/api-reference.md`, `CONTEXT.md`

## QA

- [ ] Attach PDF + URL → chips `#1`, `#2`; pending spinner → ready
- [ ] Delete #2, attach again → `#1`, `#3`
- [ ] "use #1 as knowledge" → posts use it; message without mention → attachment ignored
- [ ] "use the pdf" with two PDFs → Which attachment? (no Skip questioning, Next disabled until picked)
- [ ] "use pricing.pdf" → How should I use it? with "as knowledge" pre-selected
- [ ] Message naming a failed file → amber "I couldn't use #1 …" message
