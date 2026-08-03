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
- [x] Create route `src/app/linkedin-autopilot/page.tsx`

## Phase 2 — Mock Data

- [x] Define TypeScript types and write mock data (`src/lib/mock/linkedinAutopilot.ts`)

## Phase 3 — UI Components

### Navbar
- [x] Logo + nav links; LinkedIn Autopilot CTA button
- [x] User avatar with logout dropdown

### Setup Stepper
- [x] `src/components/linkedin-autopilot/SetupStepper.tsx` — horizontal progress bar
- [x] Accepts `mode: "agentic" | "manual"` prop; filters Profile URL step out in manual mode
- [x] Step 1 (LinkedIn Connect) — completion driven by `account.connected`
- [x] Step 2 (Profile URL) — agentic only; driven by `["linkedin-profiles",workspaceId]`
- [x] Steps 3–5 (Knowledge / Tone / Style) — driven by `GET /documents/` per purpose
- [x] `ProfileUrlModal.tsx` — profile list, modal delete confirm (username from regex), polling, invalidates cache on ready
- [x] `KnowledgeUploadModal.tsx` — type dropdown, PDF upload, URL input, existing docs list

### Mode Tabs
- [x] Agent / Manual tabs at top of page with URL persistence (`?mode=agent|manual`)
- [x] Agent (default): shows AgentModeSection, hides GeneratePostsSection
- [x] Manual: shows GeneratePostsSection, hides AgentModeSection; stepper hides Profile URL step
- [x] Wrapped in `<Suspense>` (uses `useSearchParams`)
- [x] `type Mode = "agent" | "manual"` in page.tsx and SetupStepper.tsx

### Account & Knowledge Base Section
- [x] LinkedIn account card (Connected status, Manage button)
- [x] Knowledge base card — "Add sources" → KnowledgeUploadModal
- [x] Stats grid — real API

### Generate Posts Section (Manual mode)
- [x] Number of posts, Use Emoji toggle, Length toggle
- [x] Tone reference PDF + Style reference PDF dropdowns
- [x] Source URL + custom prompt textarea + Suggest prompts
- [x] Generate button → API; image polling via `["posts-generating"]` flag
- [x] ModelSwitcher in bottom bar

### Review & Approval Section
- [x] Draft post cards with polling
- [x] Edit, Regenerate, Delete, Approve actions
- [x] Approve invalidates `["posts","draft",workspaceId]` (partial, `exact: false`) + `["posts","all"]`
- [x] Filtered by mode: passes `state=agent|manual` to `GET /content/posts/?status=draft&state=X` based on `?mode=` URL param
- [x] Query key includes mode `["posts","draft",workspaceId,mode]` — tab switch triggers automatic refetch

### Post Management Section
- [x] Filter, pagination, page size, checkbox select-all
- [x] Bulk delete, status pills, per-row actions
- [x] Delete via RejectConfirmModal

### Agent Mode Section
- [x] `src/components/linkedin-autopilot/AgentModeSection.tsx` — blue banner + 3-phase modal
- [x] Phase A a-submit: LinkedIn Profile URL + Websites + Documents all visible (not gated on profile)
- [x] Phase A: websites/docs call API immediately on add/upload (no local queuing)
- [x] Phase A: shimmer animation while status is crawling/processing; stops on ready/error/failed
- [x] Phase A: purpose selector (knowledge/tone/style) on each website and document
- [x] Phase A: resource polling every 3s; stops when all items terminal (ready/error/failed)
- [x] Phase A a-ready: profile cards show username from `profile_url` regex + summary from facets
- [x] Phase A a-ready: Knowledge Sources card (websites + docs with shimmer, purpose badge, status badge)
- [x] Phase A: modal delete confirm for profiles, websites, and documents (separate modals)
- [x] Phase B b-select: plan cards editable via pencil icon → edit modal → PATCH API
- [x] Phase B b-select: Back button returns to a-ready
- [x] Phase C: polls drafts, sets `["posts-generating"]` flag, auto-closes
- [x] Agent endpoints: `/linkedin/agent/documents/` + `/linkedin/agent/websites/` (workspace-level, no profile required)
- [x] Terminal status fix: `failed` treated same as `error` (stops polling + red badge)

### Model Switcher
- [x] `ModelSwitcher.tsx` — fetches models, `["selected-model"]` cache, `dropUp` prop
- [x] `useSelectedModel()` hook
- [x] Placed in GeneratePostsSection + AgentModeSection a-ready + b-select

### Autopilot Agent Workflow Section
- [x] Live badge, orchestrator banner, 7 agent cards

### Modals
- [x] `Modal.tsx` — widths: sm/md/lg/xl/2xl/3xl; `disableBackdropClose`, `minHeight`, `bodyClassName`
- [x] `LinkedInManageModal`, `KnowledgeUploadModal`, `ScheduleModal`
- [x] `EditPostModal`, `RejectConfirmModal`, `ViewPostModal`, `RegeneratePostConfirmModal`

## Phase 4 — Polish

- [x] Page background color (#E9ECF5)
- [x] Shimmer animation (`animate-shimmer-card`) in globals.css
- [x] Responsive layout
- [ ] Loading skeleton states
- [ ] Empty states (no posts, no connection)

## Phase 5 — Real Integration

- [x] LinkedIn OAuth connect flow
- [x] Post stats, generate, draft list, approve, delete, manage, schedule, view, upload image, edit
- [x] Logout, website URLs, documents, post management, image generation

## Phase 6 — Workspace Migration

- [x] WorkspaceContext + WorkspaceProvider
- [x] All service files prefixed with `/workspaces/${workspaceId}/`
- [x] Navbar workspace switcher
- [x] Query keys include workspaceId

## Phase 7 — Agent Mode & Model Switcher

- [x] `src/types/Agent.ts` — `LinkedInProfile` (updated to match real API: `profile_url`, `facets`, no `name`/`headline`), `MarketingPlan`, `ProfileDocument`, `ProfileWebsite`
- [x] `src/service/agentService.ts` — full CRUD + agent doc/website endpoints + `updatePlan`
- [x] `src/service/aiModelService.ts` — `getModels()`
- [x] `src/types/AIModel.ts`
- [x] Agent mode full implementation (see Agent Mode Section above)
- [x] Setup Stepper Step 2 live via agentService

## Phase 8 — Bug Fixes

- [x] URL persistence conflict: workspace switch + mode switch competing `useEffect`s causing mode to reset to "agent" intermittently
  - Effect 2 now reads `window.location.search` at execution time (not stale `searchParams` closure)
  - Effect 2 deps narrowed to `[activeWorkspace?.id, pathname]` — never fires on URL-only changes
  - Guard `if (liveParams.get("workspace")) return` prevents overwriting existing URL params

## Phase 9 — Future

- [ ] Real-time agent status polling (WebSocket)
- [ ] Calendar view page
- [ ] Bulk delete confirmation modal
- [ ] Regenerate Post API wired
- [ ] Refresh metrics button per post
- [ ] Image removal via PATCH
- [ ] Hashtag PATCH (backend fixing)

## Phase 10 — Agentic Mode V2 (Brief → Headlines → Posts)

- [x] New `b-brief` phase: Planning Brief form (target audience, IANA timezone picker, days 1–90)
- [x] `generatePlans` accepts full brief body `{ target_audience?, region?, days?, writer_model? }`
- [x] New `b-headlines` phase: headlines list from `POST plans/{id}/headlines/`; editable text fields + checkboxes
- [x] "Generate more" button: calls headlines endpoint with `exclude` = all current headlines; appends to list
- [x] `getHeadlines(planId, { count?, exclude? })` added to agentService
- [x] `generateFromPlan` accepts full request `{ headlines[], tone?, length?, use_emoji?, use_ai_image?, writer_model?, tone_document?, style_document? }`
- [x] `reextractAgentDocument(docId)` added to agentService
- [x] StepBar updated to 4 steps: Base · Marketing Plans · Headlines · Generate Posts
- [x] `AgentModeSection` embedded inside `AccountSection` (no longer rendered standalone in page.tsx)
- [x] `AccountSection` and `PostManagementSection` accept `mode` prop
- [x] `PostManagementSection` passes `state` to `getAllPosts`; query key includes mode
- [x] `PostManagementSection` SCHEDULED column shows `suggested_publish_at` (greyed "suggested") for approved posts without `scheduled_at`
- [x] `ScheduleModal` accepts `suggestedAt` prop; pre-fills date/time from suggestion
- [x] `ReviewApprovalSection` can edit `suggested_publish_at` via `PATCH posts/{id}/`
- [x] `getDraftsByPlan` updated to use `?plan={id}&state=agent`
- [x] New types: `PlanningBrief`, `PaginatedPlans`, `HeadlinesRequest`, `HeadlinesResponse`, `GenerateFromPlanRequest`
- [x] `PostType` updated: `state`, `plan`, `headline`, `suggested_publish_at`, `use_emoji`, `writer_model`, nullable `cta`/`engagement`/`website_profile`
- [x] `MarketingPlan` updated: `brief: PlanningBrief|null`, `linkedin_profile: string|null`
- [x] `Modal.tsx` extended with `"4xl"` width (`max-w-4xl`)

## Phase 11 — UX Refinements & Model Switcher

- [x] `SetupStepper`: agent mode steps 3–5 (Knowledge/Tone/Style) now check agent-level APIs (`getAgentDocuments` + `getAgentWebsites`) independently from manual mode (`documentService`); each query only fires for the relevant mode
- [x] `RegeneratePostConfirmModal`: stripped to two controls — Make Longer toggle (sends `mode: "extend"`) + Instructions textarea; all tone/length/content_style/emoji options removed
- [x] `RegeneratePostBody` type simplified to `{ instruction?: string; mode?: "rewrite" | "extend" }`
- [x] `Tooltip` component (`src/components/ui/Tooltip.tsx`): CSS-only hover tooltip with `position` (top/bottom), `align` (center/left/right) props; defaults to `LuInfo` icon; `align="right"` prevents right-edge overflow
- [x] `AgentModeSection` b-brief: replaced verbose inline text with tooltips on Target Audience, Audience Timezone, Planning Window; COMMON_TIMEZONES expanded with 15 EU/UK entries (Belgrade, Brussels, Bucharest, Budapest, Copenhagen, Dublin, Kiev, Luxembourg, Oslo, Prague, Riga, Sofia, Tallinn, Vienna, Vilnius)
- [x] `AgentModeSection` a-submit: tooltips on LinkedIn Profile URL, Websites, Documents section headers and purpose select dropdown
- [x] `AgentModeSection` a-ready Knowledge Sources: tooltips on section header, Websites label (`align="left"`), Documents label (`align="left"`); purpose select tooltip (`align="right"`)
- [x] `AgentModeSection` b-headlines: post rate warning modal — if `selectedCount / briefDays > 2` show confirmation with Adjust / Proceed anyway before generating
- [x] `KnowledgeUploadModal`: tooltip on Source type label + per-tab tooltips (Knowledge/Tone/Style)
- [x] `GeneratePostsSection`: tooltips on Number of posts, Use Emoji, Length, Tone reference PDF, Style reference PDF, Source URL, Custom prompt
- [x] `ModelSwitcher`: provider tabs (Gemini / Claude) derived dynamically from API response; colored provider badge on trigger button (blue=Gemini, orange=Claude); active tab auto-syncs with selected model; models filtered per active provider tab
