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

## Acceptance Criteria

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
