# Tasks — LinkedIn Autopilot Page

## Status Legend
- [x] Done
- [ ] To do
- [~] In progress

---

## Phase 1 — Scaffold & Routing

- [x] Set up Next.js 16 project with App Router, TypeScript, Tailwind v4
- [x] Install all dependencies (React Query, Axios, Zod, Framer Motion, etc.)
- [x] Configure ESLint (flat config), Prettier, Husky, commitlint
- [x] Create root files: README, CHANGELOG, CONTEXT, CLAUDE, Dockerfile
- [x] Add Navbar to root layout (`src/app/layout.tsx`)
- [x] Create route `src/app/linkedin-autopilot/page.tsx`
- [x] Redirect `/` → `/linkedin-autopilot`
- [x] Remove unused `(auth)` and `(dashboard)` route groups

## Phase 2 — Mock Data

- [x] Define TypeScript types: `PostStatus`, `AgentStatus`, `DraftPost`, `ManagedPost`, `Agent`
- [x] Write mock data for account, stats, draft posts, managed posts, agents
  (`src/lib/mock/linkedinAutopilot.ts`)

## Phase 3 — UI Components

### Navbar
- [x] Logo + nav links (Leads, Campaigns, Inbox, Analytics)
- [x] LinkedIn Autopilot CTA button (active state on `/linkedin-autopilot`)
- [x] User avatar with logout dropdown (POST `/auth/logout/`, clears localStorage, redirects to `/login`)

### Page Header
- [x] ~~LinkedIn icon + title + subtitle~~ — **removed** (PageHeader component deleted)

### Setup Stepper
- [x] `src/components/linkedin-autopilot/SetupStepper.tsx` — 5-step horizontal progress bar
- [x] Step 1 (LinkedIn Connect) — completion driven by `account.connected`; opens `LinkedInManageModal`
- [x] Step 2 (Profile URL) — completion driven by `["linkedin-profiles",workspaceId]`; checks for any `status === "ready"` profile
- [x] Steps 3–5 (Knowledge / Tune / Style) — always pending (API TBD); open `KnowledgeUploadModal` with correct type pre-selected
- [x] `src/components/linkedin-autopilot/ProfileUrlModal.tsx` — full profile list (ready/pending/error states), add URL, inline delete confirm, per-profile polling, invalidates `["linkedin-profiles",workspaceId]` on ready
- [x] `src/components/linkedin-autopilot/KnowledgeUploadModal.tsx` — unified modal: type dropdown, PDF upload, URL input, items list with type badges

### Account & Knowledge Base Section
- [x] LinkedIn account card (Connected status, Manage button → LinkedInManageModal)
- [x] Website knowledge base card (Ready status, Add Sources → AddUrlModal, Add to Knowledge Base → KnowledgeBaseUploadModal, Re-crawl button)
- [x] 5 stats cards row (Awaiting · Approved · Scheduled · Published · Avg Engagement) — real API

### Generate Posts Section
- [x] Number of posts free-form input (min 1, max 50) + Use Emoji toggle (Yes/No)
- [x] Tone dropdown
- [x] Length toggle (Short / Medium / Long)
- [x] Content style dropdown
- [x] Custom prompt textarea
- [x] Suggest prompts button
- [x] Generate button + footer note
- [x] Gradient background (blue-gray → white, top to bottom)

### Review & Approval Section
- [x] Section header with awaiting badge
- [x] Two-column draft post cards
- [x] Author info, Draft badge, post body, image, hashtags
- [x] Post-generate polling: spins every 5s, stops when posts arrive
- [x] Edit button → EditPostModal
- [x] Regenerate Post button → RegeneratePostConfirmModal
- [x] Regenerate Image button → floating prompt dropdown → Generate Image API
- [x] Delete button → RejectConfirmModal → DELETE API
- [x] Approve button → POST approve API

### Post Management Section
- [x] Filter dropdown: All / Approved / Scheduled / Published / Failed
- [x] Drafts excluded server-side via `exclude_status=draft`
- [x] Page size selector (2 / 5 / 10 / 15 / 20), default 10
- [x] Pagination bar always visible
- [x] Checkbox column with select-all (indeterminate state)
- [x] Bulk delete when ≥ 2 rows selected
- [x] Table: 8 columns (☐ + POST + CREATED + SCHEDULED + PUBLISHED + STATUS + ENGAGEMENT + ACTIONS)
- [x] Status pills with color coding
- [x] Engagement cell (published metrics / queue / ready / failed states)
- [x] Schedule → ScheduleModal → POST /schedule/ API
- [x] Reschedule → ScheduleModal (reschedule mode) → POST /schedule/ API
- [x] Retry / External link buttons for Failed / Published rows
- [x] Three-dot dropdown: View → ViewPostModal · Delete → RejectConfirmModal → DELETE API

### Autopilot Agent Workflow Section
- [x] Section header with Live badge
- [x] Orchestrator banner
- [x] 7 agent cards in 4+3 grid
- [x] Per-agent status badges

### Modals
- [x] `Modal.tsx` — base modal
- [x] `LinkedInManageModal`
- [x] `KnowledgeBaseUploadModal`
- [x] `ScheduleModal`
- [x] `EditPostModal`
- [x] `RejectConfirmModal`
- [x] `ViewPostModal`
- [x] `RegeneratePostConfirmModal`

## Phase 4 — Polish

- [x] Fix page background color
- [x] Fix Generate Posts card background
- [x] Fix Agent Workflow section background
- [x] Global `cursor: pointer` for buttons and checkboxes
- [x] Responsive layout
- [x] Dark mode removed
- [ ] Loading skeleton states
- [ ] Empty states (no posts, no connection)

## Phase 5 — Real Integration (Pre-workspace)

- [x] LinkedIn OAuth connect flow
- [x] Post stats grid
- [x] Suggest prompts
- [x] Generate posts (synchronous + image polling)
- [x] Draft posts list
- [x] Approve post
- [x] Delete post
- [x] Post management table
- [x] Schedule post
- [x] View single post
- [x] Upload post image
- [x] Edit post body/hashtags
- [x] Logout
- [x] Website URLs list + delete
- [x] Documents list + delete
- [x] Post management draft exclusion
- [x] Delete confirmation modal on Post Management row delete
- [x] Regenerate Image API

## Phase 6 — Workspace Migration (CURRENT)

### Auth & Register
- [ ] Register page (`src/app/register/page.tsx`) — see auth tasks Phase 2
- [ ] WorkspaceContext + WorkspaceProvider — see auth tasks Phase 3

### Service URL Migration
All service files must prefix endpoints with `/workspaces/${workspaceId}/` using `activeWorkspace.id` from `WorkspaceContext`.

- [ ] `src/service/postsService.ts` — add `workspaceId` param to factory; update all endpoints:
  - `GET /workspaces/{id}/content/posts/`
  - `POST /workspaces/{id}/content/posts/generate/` — remove `scope` from body
  - `POST /workspaces/{id}/content/posts/suggest_prompts/` — remove `scope` from body
  - `GET /workspaces/{id}/content/posts/stats/`
  - `POST /workspaces/{id}/content/posts/{postId}/regenerate/`
  - `POST /workspaces/{id}/content/posts/{postId}/approve/`
  - `POST /workspaces/{id}/content/posts/{postId}/schedule/`
  - `POST /workspaces/{id}/content/posts/{postId}/upload_image/`
  - `PATCH /workspaces/{id}/content/posts/{postId}/`
  - `DELETE /workspaces/{id}/content/posts/{postId}/`
  - `POST /workspaces/{id}/content/posts/{postId}/generate_image/`
  - `POST /workspaces/{id}/content/posts/{postId}/refresh_metrics/`

- [ ] `src/service/websiteService.ts` — add `workspaceId` param; update all endpoints:
  - `GET /workspaces/{id}/websites/` — remove `?scope=`
  - `POST /workspaces/{id}/websites/` — remove `scope` from body
  - `DELETE /workspaces/{id}/websites/{siteId}/`
  - `POST /workspaces/{id}/websites/{siteId}/recrawl/`

- [ ] `src/service/documentService.ts` — add `workspaceId` param; update all endpoints:
  - `GET /workspaces/{id}/documents/` — remove `?scope=`
  - `POST /workspaces/{id}/documents/` — remove `scope` from body
  - `DELETE /workspaces/{id}/documents/{docId}/`
  - `POST /workspaces/{id}/documents/{docId}/reextract/`

- [ ] LinkedIn service endpoints:
  - `GET /workspaces/{id}/linkedin/connect/` (returns `{ authorize_url }`)
  - `GET /workspaces/{id}/linkedin/account/`
  - `DELETE /workspaces/{id}/linkedin/account/`
  - Keep `/api/v1/linkedin/callback/` top-level (unchanged)

### Component updates
- [ ] All components that call services must pass `activeWorkspace.id` from `useWorkspace()` hook
- [ ] Navbar: add workspace switcher dropdown (see auth tasks Phase 4)
- [ ] Handle `404` responses on workspace-scoped requests — toast + fallback

### React Query cache invalidation on workspace switch
- [ ] On `setActiveWorkspace()` → call `queryClient.invalidateQueries()` to clear all cached data

## Phase 7 — Agent Mode & Model Switcher ✅

### Types & Services
- [x] `src/types/Agent.ts` — `LinkedInProfile`, `MarketingPlan`
- [x] `src/types/AIModel.ts` — `AIModel`
- [x] `src/service/agentService.ts` — `getProfiles`, `createProfile({profile_url})`, `getProfile`, `refetchProfile`, `deleteProfile`, `generatePlans(writerModel?)`, `generateFromPlan(planId, writerModel?)`
- [x] `src/service/aiModelService.ts` — `getModels()` → `GET /ai-models/`
- [x] `src/service/postsService.ts` — added `getDraftsByPlan(planId)`
- [x] `src/types/Post.ts` — added `writer_model?` to `GeneratePostsBody`

### Model Switcher
- [x] `src/components/linkedin-autopilot/ModelSwitcher.tsx` — fetches models, click-outside dropdown, radio-style selection, stores `model_id` in `["selected-model"]` cache
- [x] `useSelectedModel()` hook exported from `ModelSwitcher.tsx`
- [x] Placed in `GeneratePostsSection` bottom bar (next to Generate button)
- [x] Placed in `AgentModeSection` a-ready phase (before Generate Marketing Plans)
- [x] Placed in `AgentModeSection` b-select action row (before Generate Posts)
- [x] `writer_model` passed to `generatePosts`, `generatePostsFromLink`, `generatePlans`, `generateFromPlan`
- [x] `Modal.tsx` — added `"3xl": "max-w-3xl"` width + `disableBackdropClose` prop

### Agent Mode
- [x] `src/components/linkedin-autopilot/AgentModeSection.tsx` — full 3-phase modal
- [x] Phase A: load profiles, URL submit, polling (3s), ready/error states, profile list with Remove + inline delete confirm, add-another URL
- [x] Phase B: generate plans, 3-column plan cards (title/angle/target_audience/pillars/sample_hooks), select + regenerate
- [x] Phase C: generate from plan, poll for drafts (2.5s), hand off image polling via `["posts-generating"]` flag, auto-close after 2s
- [x] Mounted in `src/app/linkedin-autopilot/page.tsx` between SetupStepper and AccountSection

### Setup Stepper — Step 2 Live
- [x] `SetupStepper.tsx` — fetches `["linkedin-profiles",workspaceId]` via `agentService`
- [x] Step 2 marked done when any profile `status === "ready"`
- [x] `ProfileUrlModal.tsx` invalidates `["linkedin-profiles",workspaceId]` when profile polling reaches `ready`

## Phase 8 — Future

- [ ] Website crawler + knowledge base API
- [ ] Real-time agent status polling (WebSocket)
- [ ] Calendar view page
- [ ] Bulk delete confirmation modal
- [ ] Regenerate Post API wired (modal exists, API now available)
- [ ] Refresh metrics button per post
- [ ] Image removal via PATCH (backend support needed)
- [ ] Hashtag PATCH (backend fixing)
- [ ] Setup Stepper steps 3–5 completion tracking (Knowledge / Tune / Style APIs)
