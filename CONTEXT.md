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
| **Knowledge Switch** | Per-source on/off for Agent Mode knowledge (PDF, website, LinkedIn profile), shown in Composer settings and saved on the source. Only sources switched on are used; all off = no knowledge. Replaces the old single `use_knowledge` toggle |
| **Voice Switch** | Per-source on/off for Agent Mode tone / style samples (PDF, website) — `tone_and_style` in agent settings, shown in Composer settings → Tone / Style. Several can be on (blended voice); all off = default voice. Replaces `is_default` picking the voice |
| **Source Note** | Optional free text (max 200 chars) telling the agent how to use a knowledge or tone / style link or PDF, e.g. "Use this for article making". Stored in the backend `label` field; not a display name. LinkedIn profiles don't take one |
| **Knowledge Base** | Agent-level websites and documents used to generate on-brand posts. Workspace-scoped, managed via `agent/websites/` and `agent/documents/` |
| **Post Version** | Numbered snapshot (v1, v2, …) of a post's content, saved on every content change. Holds content only — status and schedule time always come from the live post. `current_version` on a post = the version it matches now |
| **Latest Card** | For a post, the last agent chat card whose `payload.versions[postId]` equals the post's `current_version`. Only it can approve / edit / select; older cards show "Old version · vN" + "Use this version" |
| **Restore ("Use this version")** | Brings an old version back as a **new** version number; approved/scheduled posts return to Draft |
| **Image Chat** | One-per-post AI conversation for generating and editing a post's image. Accessed at `/linkedin/edit-image/[postId]` |
| **Image Settings** | Per-chat settings for Image Chat (`image-chats/settings/{chatId}/`): Use post body toggle, **AI Model** (e.g. Nano Banana) and **Image Ratio** / media size (e.g. Landscape Size 1200 X 628, 16:9). One active option each |
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
| `/settings` | Account settings (read-only user details) |
| `/inbox` | Inbox (not yet built) |
