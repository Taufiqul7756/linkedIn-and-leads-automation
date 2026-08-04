# Project Context

This file defines the domain language used in this project.
Claude reads this file every session. Use these exact terms consistently.

## Domain Glossary

| Term | Definition |
| --- | --- |
| Agent | An AI-powered autonomous task executor within the Autopilot workflow |
| Autopilot Orchestrator | The top-level agent that coordinates all sub-agents end-to-end |
| Draft | A generated post awaiting human review before scheduling |
| Approved | A post that has passed the Review Gate and is ready to schedule |
| Scheduled | A post queued for auto-publish at a specific time |
| Published | A post that has been successfully posted to LinkedIn |
| Failed | A post that could not be published (e.g. token expired) |
| Review Gate | The human approval step between generation and scheduling |
| Knowledge Base | Crawled website content used to generate on-brand posts |
| Add Sources | User action to upload files (PDF, DOC, DOCX) or paste text into the Knowledge Base |
| Run Agent | Bulk action that triggers the agentic swarm for selected leads; appears in the Leads table header when ≥ 1 rows are selected |
| Marketing Plan | AI-generated content strategy with title, angle, pillars, and sample hooks; created in batches of 3 via `POST /content/plans/` |
| Plan Batch | Group of 3 Marketing Plans produced from a single generation call; identified by a shared `batch` UUID |
| Follow-up Plan | A new batch of 3 plans that continues an existing plan's strategy; created via `POST /content/plans/{id}/follow-up/` |
| Plans History | The full list of all Marketing Plan batches ever created; accessed from PostManagementSection header (agent mode) |
| Plan Detail | Modal showing a single Marketing Plan's metadata and the posts generated from it as a numbered timeline |
| Engagement Rate | (reactions + comments) / impressions expressed as a percentage |
| Lead Status | Validation state of a lead: Valid (green), Invalid (red), Risky (amber) |
| Outreach | Channel/state of outreach for a lead: Replied · Email sent · WhatsApp sent · LinkedIn sent · Not contacted |
| Lead Actions | Per-row channel buttons on the Leads table: WhatsApp · Email · LinkedIn |

## Routing

| Path | Page |
| --- | --- |
| `/leads` | Leads page |
| `/campaigns` | Campaigns page |
| `/inbox` | Inbox page |
| `/analytics` | Analytics page |
| `/linkedin-autopilot` | LinkedIn Autopilot page (dedicated route, not nested under dashboard group) |

## Business Rules

- Posts are generated as drafts and will not publish until approved
- Human approval is required at the Review Gate before scheduling
- The Autopilot runs 7 agents: Connector, Knowledge, Generator, Review Gate, Scheduler, Publisher, Analytics
- Bulk delete requires selecting at least 2 posts
- Run Agent is available when at least 1 post is selected
- Deleting a post permanently removes it; always requires confirmation via DeleteConfirmModal (used in both Review & Approval and Post Management)

## Status Flows

```
[Draft] → [Approved] → [Scheduled] → [Published]
                                   ↘ [Failed]
```

## API Conventions

- Base URL: `NEXT_PUBLIC_API_URL`
- Auth: httpOnly cookie (refresh token) + access token
- Error shape: `{ type, errors: [{ code, detail, attr }] }`
- Pagination: `{ count, next, previous, results }`
