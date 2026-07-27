# PRD — Authentication, Landing Page & Workspace Bootstrap

## Overview

Public marketing landing page at `/` + token-based authentication gate + workspace bootstrap. All routes require login except `/`, `/login`, and `/register`. On login/register success, the app fetches the user's workspace list and activates the first workspace before redirecting to the dashboard.

---

## Landing Page (`/`)

Public marketing page. Authenticated users visiting `/` are redirected to `/linkedin-autopilot`.

### Navbar (`LandingNavbar`)
- Logo (Relay) — links to `/`
- **Products** dropdown: LinkedIn Autopilot → `/linkedin-autopilot`, Leads → `/leads`
- **Pricing** — disabled, "Soon" badge
- **Login** → `/login`
- **Free Trial** → `/register` (teal CTA button)
- Mobile hamburger menu

### Page sections
1. **Hero** — dark gradient bg, badge, headline "The AI Platform for B2B Growth & Outreach", subtext, two CTAs (Start Free Trial / See Products), app dashboard mockup, logo bar
2. **Products** — two feature cards (LinkedIn Autopilot + Leads) with bullet lists and "Get started" links
3. **Stats bar** — 2,500+ companies, 50k+ posts, 94% approval, 3.2x engagement
4. **CTA** — "Ready to grow your business with AI?" + Start Free Trial button
5. **Footer** — logo, Products links, Account links, copyright

---

## Login & Register Pages

Split-panel layout:
- **Left (42%)** — white bg: back button (→ `/`) + logo, form, "Get started free" / "Log in" link, terms footer
- **Right (58%)** — dark gradient (`slate-900 → blue-950`): testimonial card (Taufiqul Islam, CEO @ Precious Memories), dashboard mockup (stats, chart, post rows)

App `Navbar` is hidden on `/`, `/login`, `/register` via pathname check in `Navbar.tsx`.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/auth/register/` | Register — creates user + default Corporate workspace |
| POST | `/api/v1/auth/login/` | Login — returns auth token |
| GET | `/api/v1/auth/me/` | Fetch current user profile |
| GET | `/api/v1/workspaces/` | List workspaces (called immediately after login/register) |
| POST | `/api/v1/workspaces/` | Create workspace — body: `{ name, type }` |
| PATCH | `/api/v1/workspaces/{id}/` | Rename workspace (type is immutable) |
| DELETE | `/api/v1/workspaces/{id}/` | Soft delete (last workspace → 400) |

### Register body
```json
{
  "email": "user@example.com",
  "username": "string",
  "password": "stringst"
}
```

### Login response
```json
{
  "token": "string",
  "user": { "id": "uuid", "email": "string", "username": "string" }
}
```

### Workspace object
```json
{
  "id": "uuid",
  "name": "string",
  "type": "corporate | personal",
  "is_active": true,
  "created_at": "ISO string"
}
```

## Storage

- Full login response stored in `localStorage` under key `"auth"`
- Active workspace id stored in `localStorage` under key `"activeWorkspaceId"`
- Token read back on every page load to restore session
- On logout: both `localStorage` entries removed, state cleared

## Auth + Workspace flow

```
/register → POST /auth/register/ → store token → GET /workspaces/ → set first as active → /linkedin-autopilot
/login    → POST /auth/login/    → store token → GET /workspaces/ → set first as active → /linkedin-autopilot
/login (already authenticated)   → GET /workspaces/ → set active  → /linkedin-autopilot
any protected route (no token)   → /login
```

## WorkspaceContext

- Provides: `workspaces`, `activeWorkspace`, `setActiveWorkspace(id)`
- Fetches `GET /workspaces/` once after token is available
- Defaults to first workspace in list
- Persists `activeWorkspaceId` in `localStorage` (restored on reload)
- Every service call uses `activeWorkspace.id` as `{workspace_pk}` prefix

## Workspace Switcher (Navbar)

- Dropdown in Navbar showing all workspaces
- Clicking switches `activeWorkspaceId` — invalidates all React Query cache keys
- No page reload needed — URL prefix swaps via context

## Scope removal

The old `?scope=corporate|personal` query param is **deleted everywhere**. The workspace `type` is now the scope. Remove it from all request bodies and query strings.

## Error handling

- `404` on any workspace-scoped request → "workspace not found" toast + redirect to workspace list
- Deleting last workspace → backend returns `400` → show error toast

## Out of scope (v1)

- Forgot password / reset
- LinkedIn OAuth login
- httpOnly cookie session
