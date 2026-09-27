# Project Context

Domain language for this project. Use these exact terms consistently across code, comments, and docs.

## Auth

Token-based auth. `Authorization: Token <key>` header on every API request. Token stored in `localStorage["auth"]`. Never httpOnly cookies.

## Domain Glossary

| Term | Definition |
| --- | --- |
| **Workspace** | Top-level tenant scope. Every API route is nested under `/workspaces/{workspaceId}/`. Active workspace stored in `localStorage["activeWorkspaceId"]` and `?workspace=` URL param |
| **Draft** | A generated post awaiting human review before scheduling |
| **Approved** | A post that has passed the Review Gate and is ready to schedule |
| **Scheduled** | A post queued for auto-publish at a specific time |
| **Published** | A post that has been successfully posted to LinkedIn |
| **Failed** | A post that could not be published (e.g. expired token) |
| **Review Gate** | The human approval step between generation and scheduling |
| **Agent Mode** | LinkedIn post generation via the Conversation API — one chat session produces a batch of drafts |
| **Conversation** | A single Agent Mode chat session. Has a status state machine: `draft → running → awaiting_input → completed / failed / cancelled / archived` |
| **Pending Interrupt** | A question round (`kind: "questions"`) or headline selection round (`kind: "headlines"`) that pauses a conversation waiting for user input |
| **Marketing Plan** | AI-generated content strategy with title, angle, pillars, and sample hooks; created in batches of 3 via `POST /content/plans/` |
| **Plan Batch** | Group of 3 Marketing Plans produced from a single generation call; identified by a shared `batch` UUID |
| **Follow-up Plan** | A new batch of 3 plans that continues an existing plan's strategy; created via `POST /content/plans/{id}/follow-up/` |
| **Knowledge Base** | Agent-level websites and documents used to generate on-brand posts. Workspace-scoped, managed via `agent/websites/` and `agent/documents/` |
| **Image Chat** | One-per-post AI conversation for generating and editing a post's image. Accessed at `/linkedin/edit-image/[postId]` |
| **Run Agent** | Bulk action that triggers the agentic swarm for selected leads |
| **Lead Status** | Validation state of a lead: Valid (green) · Risky (amber) · Invalid (red — auto-removed) |
| **Outreach** | Channel/state of outreach for a lead: Not contacted · Email sent · WhatsApp sent · LinkedIn sent · Replied |

## Post Status Flow

```
[Draft] → [Approved] → [Scheduled] → [Published]
                                   ↘ [Failed]
```

## Active Routes

| Path | Feature |
| --- | --- |
| `/linkedin/automation` | LinkedIn Agent (Conversation API) |
| `/linkedin/post-management` | Post Management |
| `/linkedin/accounts` | LinkedIn Accounts |
| `/linkedin/edit-image/[postId]` | Image Chat |
| `/leads` | Leads page |
| `/inbox` | Inbox (not yet built) |
