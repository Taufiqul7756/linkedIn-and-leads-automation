# PRD: Follow-up Plans (ADR 0025)

## Overview

A user who has already generated posts from a marketing plan can now "continue" that plan — requesting a fresh batch of 3 plans that carry the same strategy forward without repeating the ground already covered. This is called a **follow-up** or **chapter two**.

The existing generate flow (brief → pick plan → headlines → generate → c-done) is **completely unchanged**. We add one button, one service method, two type fields, and a state badge on plan cards.

---

## User Story

> After generating posts from a plan, the user sees a prompt:
> "Do you want to make more posts with this plan?"
> Clicking it triggers a follow-up that produces 3 new plans — continuation of the same strategy — and drops them back into the familiar b-select chooser.

---

## Trigger Point

The "Continue this plan" entry point lives at **c-done phase** inside the AgentModeSection modal:

- After posts are created and the success screen is shown, a secondary button appears below "View Drafts":
  **"Make more posts with this plan"**
- Clicking it calls `POST plans/{selectedPlan.id}/follow-up/` with an empty body.
- While the call is in-flight, show a spinner on the button (synchronous model call — a few seconds).
- On success: receive 3 new MarketingPlan objects → `setPlans(newPlans)` → `setSelectedPlan(newPlans[0])` → `setPhase("b-select")`.
- From b-select onward, the flow is **identical** to the existing path: pick a plan, get headlines, generate, poll, done.

---

## API

### New Endpoint

```
POST /api/v1/workspaces/{workspace_pk}/content/plans/{id}/follow-up/
```

- **Body**: send `{}` (empty). `target_audience`, `region`, `days` are inherited from the parent plan's brief automatically.
- **Response**: `201` — array of 3 `MarketingPlan` objects (same shape as `POST plans/`).
- **Takes a few seconds** — synchronous model call. Show a spinner on the button.

#### Error Codes
| Code | When | Body |
|------|------|------|
| 404 | Plan not found or wrong workspace | `{"detail": "Not found."}` |
| 400 | Agent mode has no ready knowledge | `{"detail": "Agent mode has no ready knowledge…"}` — show verbatim |
| 400 | region is not an IANA timezone | `{"region": ["Unknown timezone: …"]}` |

### Existing Endpoints — Unchanged
- `POST plans/{id}/headlines/` — same contract
- `POST plans/{id}/generate/` — unchanged
- `GET posts/?plan={id}&status=draft` — unchanged

---

## New Fields on MarketingPlan

Three read-only fields are added to every `MarketingPlan` response:

```ts
post_count: number        // how many posts were generated from this plan
has_follow_up: boolean    // has this plan already been continued (a follow-up was created)
brief.parent_plan: string | null  // NEW on PlanningBrief — null when planned from scratch
```

---

## Plan Card State Matrix (b-select)

| post_count | has_follow_up | Meaning | Primary Action |
|---|---|---|---|
| 0 | false | Never used | "Generate posts" (current behaviour) |
| > 0 | false | Used, not yet continued | "Continue this plan" button |
| > 0 | true | Used, already continued | "Continued ✓" badge — warn user, point to the newer chapter |

> `has_follow_up` is a **hint**, not a block. The API allows a plan to be continued more than once (branches). Use the badge to inform the user, never to disable the flow.

---

## Calendar Rule (handled by the backend, no frontend logic needed)

The 3 follow-up plans' posts will have `suggested_publish_at` dates starting **after the parent plan's last post** (using the later of `suggested_publish_at` or `scheduled_at`, so user-rescheduled posts are respected). If the parent plan has no posts yet, the window starts now. Weekends are skipped as usual. A brief without a `region` produces `null` suggestions — not an error.

---

## What Does NOT Change

- No existing API path, field, enum, status code, or error key changes.
- `POST plans/` still takes the same body and returns 3 plans.
- The post lifecycle (approve → schedule) is untouched.
- `scheduled_at` still has exactly one writer — the schedule call.
- Nothing auto-publishes.

---

## Type Changes Required

### `src/types/Agent.ts`

**PlanningBrief** — add `parent_plan`:
```ts
export type PlanningBrief = {
  id: string;
  target_audience: string | null;
  region: string | null;
  days: number;
  parent_plan: string | null;  // NEW — null when planned from scratch
};
```

**MarketingPlan** — add `post_count` and `has_follow_up`:
```ts
export type MarketingPlan = {
  // ...existing fields...
  post_count: number;       // NEW
  has_follow_up: boolean;   // NEW
};
```

---

## Service Change Required

### `src/service/agentService.ts`

Add `followUpPlan`:
```ts
followUpPlan: (planId: string) =>
  postRaw<MarketingPlan[]>(`/workspaces/${workspaceId}/content/plans/${planId}/follow-up/`, {}),
```

---

## UI Changes Summary

### 1. c-done phase — `AgentModeSection.tsx`
- Add a secondary button below "View Drafts": **"Make more posts with this plan"**
- On click: set loading state → call `followUpPlan(selectedPlan.id)` → on success: setPlans / setSelectedPlan / setPhase("b-select")
- Show spinner in button while loading
- On error: `toast.error(extractErrorMessage(err))`, stay on c-done

### 2. Plan cards in b-select — `AgentModeSection.tsx`
- When `plan.post_count > 0 && !plan.has_follow_up`: show a subtle "Continue this plan" text badge/chip on the card (informational — the actual trigger is the c-done button)
- When `plan.post_count > 0 && plan.has_follow_up`: show a "Continued ✓" green badge — this plan has already spawned a follow-up

### 3. Type updates — `src/types/Agent.ts`
- `PlanningBrief.parent_plan: string | null`
- `MarketingPlan.post_count: number`
- `MarketingPlan.has_follow_up: boolean`

### 4. Service update — `src/service/agentService.ts`
- Add `followUpPlan(planId)` method

---

## Scope (V1)

- No override of `target_audience` / `region` / `days` in the follow-up call — always send empty body (inherit all)

---

## V2 — Plans History, Plan Detail & Source Modal Improvements

Shipped in `v4/ui-refinement` branch.

### Plans History Modal

A "Plans" button in the PostManagementSection header (agent mode only) opens `PlansHistoryModal`:

- Fetches `GET /content/plans/?batch=all&page_size=50` — returns all plans across all batches.
- Groups plans by `batch` field using `useMemo`; newest batch first.
- Shows "Batch N · Date" label per group, each with a 3-column grid of plan cards.
- Plan cards show: Used / Continued ✓ / Unused badge, title, post count.
- Clicking a plan opens `PlanDetailModal` (nested modal, `key={selectedPlan?.id}`).

New service method: `agentService(workspaceId).getAllPlans(batch?: string)` — appends `?batch=X&page_size=50`.

### Plan Detail Modal (`PlanDetailModal`)

Opens from PlansHistoryModal or from the PLAN column chip in PostManagementSection.

Layout:
- Blue-bordered plan card at top (`border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white`): Used/Continued/Unused badge, audience/region/days meta, angle text, pillars chips.
- Thin connector line (`ml-[19px] h-5 w-px bg-gray-200`) from card to posts.
- Posts section header (count).
- Numbered timeline: left column = numbered circle (ring-2 colored by `STATUS_RING[post.status]`) + `w-px flex-1 bg-gray-200` connector between items; right column = post card with headline, body preview, status badge, date.
- Loading skeletons while fetching.
- Empty state when no posts yet.

Uses `postsService(workspaceId).getDraftsByPlan(planId)` (which queries `?plan={id}&state=agent`). Query key: `["posts", "by-plan", planId, workspaceId]`.

### PLAN Column in Post Management Table (agent mode)

- An additional PLAN column is shown when `mode === "agent"`.
- Each row shows an indigo chip with the plan title (or nothing if no plan).
- Clicking the chip opens `PlanDetailModal` for that plan (`e.stopPropagation()` prevents row-click).
- Plans are fetched once via `getAllPlans("all")` and stored in a `Map<string, MarketingPlan>` for O(1) per-row lookup. Cache key `["plans","all",workspaceId]` is shared with PlansHistoryModal.
- Column count: agent mode = 9, manual mode = 8.

### Clickable Rows & Simplified Actions

- Every `<tr>` in PostManagementSection is now `cursor-pointer` with `onClick={() => setViewPostId(post.id)}`.
- `e.stopPropagation()` added to the checkbox `<td>` and actions `<td>` to prevent unintended view-post triggers.
- The three-dot dropdown (`RowDropdown`) is removed. Actions column now shows only a single `LuTrash2` delete button.
- View post is accessed by clicking anywhere on the row.

### Source Modal Live Status Polling

Both `AgentKnowledgeUploadModal` and `KnowledgeUploadModal` now:

1. **Poll while processing**: `refetchInterval: (query) => results.some(d => !isTerminal(d.status)) ? 3000 : false` — polls every 3 s until all items reach `ready`, `error`, or `failed`.
2. **Status badge per row**: teal=ready, red=error/failed, amber=pending/processing.
3. **Shimmer animation** (`animate-shimmer-card`) on rows that are not yet terminal.
4. **Modal stays open** after Save — user sees the live status update in real time.
5. **Button label**: "Cancel" renamed to "Close".

### Tooltip Alignment Fix

Tooltips in both source modals fixed to prevent overflow at modal edges:
- Knowledge (leftmost button): `align="left"` — expands rightward
- Tone (middle button): `align="center"`
- Style (rightmost button): `align="right"` — expands leftward
