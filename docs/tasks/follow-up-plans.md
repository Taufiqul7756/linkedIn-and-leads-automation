# Tasks: Follow-up Plans (ADR 0025)

Feature branch: `feature/follow-up-plans-creation`
PRD: `docs/prd/follow-up-plans.md`

---

## Task List

### T1 — Type updates `src/types/Agent.ts`
- [x] Add `parent_plan: string | null` to `PlanningBrief`
- [x] Add `post_count: number` to `MarketingPlan`
- [x] Add `has_follow_up: boolean` to `MarketingPlan`

### T2 — Service method `src/service/agentService.ts`
- [x] Add `followUpPlan(planId: string)` — `POST .../content/plans/{planId}/follow-up/` with empty body `{}`
- [x] Return type: `MarketingPlan[]` (same shape as generatePlans)

### T3 — c-done phase button `AgentModeSection.tsx`
- [x] Add "Make more posts with this plan" secondary button below "View Drafts" at `c-done` phase
- [x] Local `isFollowingUp: boolean` state for the spinner
- [x] On click: set `isFollowingUp = true` → call `agentService(workspaceId).followUpPlan(selectedPlan!.id)`
- [x] On success: normalise response to array → `setPlans(newPlans)` → `setSelectedPlan(newPlans[0])` → `setPhase("b-select")` → `setIsFollowingUp(false)`
- [x] On error: `toast.error(extractErrorMessage(err))` → `setIsFollowingUp(false)` — stay on c-done
- [x] Show `LuLoader` spinner inside the button while `isFollowingUp` is true; disable button
- [x] Removed auto-close `setTimeout` — modal stays open at c-done until user acts

### T4 — Plan card badges in b-select `AgentModeSection.tsx`
- [x] When `plan.post_count > 0 && !plan.has_follow_up`: show amber "Used" chip on card header row
- [x] When `plan.post_count > 0 && plan.has_follow_up`: show teal "Continued ✓" badge — hint only, never blocks

---

## Bug Fixes (shipped alongside)

### Image polling race condition
- [x] Fixed: `baselineDraftCount` now reads from `["posts","draft",workspaceId,"agent"]` (mode-specific key) instead of `["posts","draft",workspaceId]` (no mode key that was always empty → baseline always 0 → stale pre-generation data killed polling immediately)

### Mode-scoped post stats
- [x] `postsService.getPostStats(state?: "agent" | "manual")` — appends `?state=X`
- [x] `AccountSection` uses `["post-stats",workspaceId,mode]` query key — agent and manual dashboards show independent counts
- [x] All existing `invalidateQueries({ queryKey: ["post-stats",workspaceId] })` calls use prefix matching by default, invalidating both variants automatically

### Agent stepper modals
- [x] Created `AgentKnowledgeUploadModal.tsx` — uses agent APIs (docs + websites), URL adding actually calls API
- [x] `SetupStepper` now renders `AgentKnowledgeUploadModal` for agent mode and `KnowledgeUploadModal` for manual mode — separate modals, separate data

---

## Acceptance Criteria (V1)

- [x] At c-done, "Make more posts with this plan" button is visible; modal does not auto-close
- [x] Clicking it shows a spinner and calls `POST plans/{id}/follow-up/`
- [x] On success, the user lands at b-select with 3 new plan cards
- [x] The rest of the flow (headlines → generate → poll → done) works exactly as before
- [x] Plan cards with `post_count > 0` and `has_follow_up: true` show the "Continued ✓" badge
- [x] Plan cards with `post_count > 0` and `has_follow_up: false` show the "Used" chip
- [x] API errors show a toast — user stays on c-done and can retry or close
- [x] TypeScript has no `any` — new fields are typed correctly
- [x] Agent stepper Knowledge/Tone/Style steps open agent-specific modal showing only agent sources
- [x] Agent modal can upload PDFs and add URLs using agent APIs
- [x] Manual stepper steps still open original KnowledgeUploadModal (unchanged)
- [x] Post stats dashboard shows mode-specific counts (agent tab ≠ manual tab)

---

## Phase 2 — UI Refinement v4 (branch: v4/ui-refinement)

PRD addition: `docs/prd/follow-up-plans.md` V2 section

### T5 — Plans History Modal `src/components/linkedin-autopilot/PlansHistoryModal.tsx`
- [x] New file — fetches `getAllPlans("all")`, groups by `batch` (newest first), renders batch headers + 3-col grid of plan cards
- [x] Plan cards show Used/Continued ✓/Unused badge, title, post count
- [x] Clicking a plan opens nested `PlanDetailModal` with `key={selectedPlan?.id ?? "no-plan"}`

### T6 — Plan Detail Modal `src/components/linkedin-autopilot/PlanDetailModal.tsx`
- [x] New file — blue-bordered plan card at top with audience/region/days/angle/pillars
- [x] Numbered timeline posts using flex column layout (numbered ring circle + w-px flex-1 connecting line)
- [x] STATUS_RING + STATUS_BADGE records for post status colours
- [x] Loading skeletons + empty state
- [x] Uses `getDraftsByPlan(plan.id)`, query key `["posts","by-plan",plan.id,workspaceId]`

### T7 — getAllPlans service method `src/service/agentService.ts`
- [x] `getAllPlans(batch?: string)` — `GET .../content/plans/?batch=X&page_size=50`
- [x] Uses `PaginatedPlans` return type

### T8 — PLAN column + Plans History button `src/components/linkedin-autopilot/PostManagementSection.tsx`
- [x] Plans fetched via `getAllPlans("all")`; stored in `Map<string, MarketingPlan>` for O(1) lookup
- [x] PLAN column header added (agent mode only); column count `colCount` = 9 agent / 8 manual
- [x] Per-row indigo chip with plan title; clicking opens `setPlanDetailTarget` (stopPropagation)
- [x] "Plans" button in header (agent mode) opens `PlansHistoryModal`
- [x] Shared cache key `["plans","all",workspaceId]` with PlansHistoryModal

### T9 — Clickable rows & simplified actions `PostManagementSection.tsx`
- [x] `<tr onClick={() => setViewPostId(post.id)}>` — every row opens ViewPostModal
- [x] `e.stopPropagation()` on checkbox `<td>` and actions `<td>`
- [x] Removed `RowDropdown` component entirely; actions column now has only `LuTrash2` delete button

### T10 — Live status polling in AgentKnowledgeUploadModal
- [x] `refetchInterval` on both docs and sites queries (3000ms while any item is non-terminal)
- [x] Status badge per row (teal/red/amber); shimmer on processing rows
- [x] Modal stays open after save (removed `onClose()` from save handler)
- [x] Cancel → Close label

### T11 — Live status polling in KnowledgeUploadModal
- [x] `refetchInterval` on documents query (3000ms while any item is non-terminal)
- [x] Status badge per row (teal/red/amber); shimmer on processing rows
- [x] Modal stays open after save
- [x] Cancel → Close label

### T12 — Tooltip alignment fix
- [x] `AgentKnowledgeUploadModal`: knowledge=`align="left"`, tone=`align="center"`, style=`align="right"`
- [x] `KnowledgeUploadModal`: same alignment pattern
