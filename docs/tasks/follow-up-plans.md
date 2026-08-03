# Tasks: Follow-up Plans (ADR 0025)

Feature branch: `feat/follow-up-plans`
PRD: `docs/prd/follow-up-plans.md`

---

## Task List

### T1 — Type updates `src/types/Agent.ts`
- [ ] Add `parent_plan: string | null` to `PlanningBrief`
- [ ] Add `post_count: number` to `MarketingPlan`
- [ ] Add `has_follow_up: boolean` to `MarketingPlan`

### T2 — Service method `src/service/agentService.ts`
- [ ] Add `followUpPlan(planId: string)` — `POST .../content/plans/{planId}/follow-up/` with empty body `{}`
- [ ] Return type: `MarketingPlan[]` (same shape as generatePlans)

### T3 — c-done phase button `AgentModeSection.tsx`
- [ ] Add "Make more posts with this plan" secondary button below "View Drafts" at `c-done` phase
- [ ] Local `isFollowingUp: boolean` state for the spinner
- [ ] On click: set `isFollowingUp = true` → call `agentService(workspaceId).followUpPlan(selectedPlan!.id)`
- [ ] On success: normalise response to array → `setPlans(newPlans)` → `setSelectedPlan(newPlans[0])` → `setPhase("b-select")` → `setIsFollowingUp(false)`
- [ ] On error: `toast.error(extractErrorMessage(err))` → `setIsFollowingUp(false)` — stay on c-done
- [ ] Show `LuLoader` spinner inside the button while `isFollowingUp` is true; disable button

### T4 — Plan card badges in b-select `AgentModeSection.tsx`
- [ ] When `plan.post_count > 0 && !plan.has_follow_up`: show a subtle amber chip "Used" on the card header row (indicates posts were generated, ready to continue)
- [ ] When `plan.post_count > 0 && plan.has_follow_up`: show a green "Continued ✓" badge in card header — do NOT disable card or block the flow (has_follow_up is a hint only)

---

## Implementation Order

1. T1 (types) — no deps
2. T2 (service) — depends on T1
3. T3 (c-done button) — depends on T2
4. T4 (card badges) — depends on T1, can do alongside T3

---

## Acceptance Criteria

- [ ] At c-done, "Make more posts with this plan" button is visible
- [ ] Clicking it shows a spinner and calls `POST plans/{id}/follow-up/`
- [ ] On success, the user lands at b-select with 3 new plan cards
- [ ] The rest of the flow (headlines → generate → poll → done) works exactly as before
- [ ] Plan cards with `post_count > 0` and `has_follow_up: true` show the "Continued ✓" badge
- [ ] Plan cards with `post_count > 0` and `has_follow_up: false` show the "Used" chip
- [ ] API errors show a toast — user stays on c-done and can retry or close
- [ ] TypeScript has no `any` — new fields are typed correctly
