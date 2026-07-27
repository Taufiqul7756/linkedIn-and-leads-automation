# Tasks — Authentication & Workspace Bootstrap

## Status Legend
- [x] Done
- [ ] To do
- [~] In progress

---

## Phase 0 — Landing Page & Auth Redesign (Done)

- [x] `src/app/page.tsx` — public landing page (hero, products, stats, CTA, footer)
- [x] `src/components/layout/LandingNavbar.tsx` — public navbar (Products dropdown, Pricing soon, Login, Free Trial)
- [x] `src/components/layout/AuthGuard.tsx` — added `/` to PUBLIC_ROUTES
- [x] `src/components/layout/Navbar.tsx` — hide on `/` (in addition to `/login`, `/register`); Leads nav item disabled with "Soon" badge
- [x] `src/app/login/page.tsx` — redesigned to split-panel layout (left: form + back button; right: dark visual panel with testimonial + dashboard mockup)
- [x] `src/app/register/page.tsx` — same split-panel layout as login

---

## Phase 1 — Core Auth (Done)

- [x] `src/types/Auth.ts` — `AuthUser`, `LoginResponse` types
- [x] `src/lib/validations/authSchema.ts` — Zod login schema (email + password ≥ 8 chars)
- [x] `src/service/authService.ts` — `login()`, `getMe()`, `logout()`, `refresh()`
- [x] `src/context/AuthContext.tsx` — token + user state from `localStorage`, `login()`, `logout()`
- [x] `src/components/layout/AuthGuard.tsx` — client-side redirect guard for all routes
- [x] `src/app/providers.tsx` — wrapped with `AuthProvider` + `AuthGuard`
- [x] `src/app/login/page.tsx` — login form (email, password toggle, Zod validation, loading state)
- [x] `src/components/layout/Navbar.tsx` — hides on `/login`, shows real user initials from context
- [x] `src/utils/extractErrorMessage.ts` — handles `AxiosError` (Django `detail`, `message`, `non_field_errors`)
- [x] `.env.local` — `NEXT_PUBLIC_API_URL=https://relayapi.azurewebsites.net/api/v1`
- [x] Fixed CORS: removed `withCredentials` from `authApi`
- [x] Fixed SSR hydration mismatch: `AuthContext` initialises `token` as `null` in `useEffect`; `AuthGuard` renders children before mount

---

## Phase 2 — Register Page

- [ ] Add `register` to `src/lib/validations/authSchema.ts` — email + username + password ≥ 8 chars (Zod)
- [ ] Add `register()` to `src/service/authService.ts` — `POST /auth/register/` with `{ email, username, password }`
- [ ] `src/app/register/page.tsx` — register form (email, username, password toggle, Zod validation, loading state)
- [ ] Add register link on login page ("Don't have an account? Register")
- [ ] Add login link on register page ("Already have an account? Login")
- [ ] On register success → same flow as login (store token → fetch workspaces → set first active → redirect)
- [ ] Add `/register` to public routes in `AuthGuard`

---

## Phase 3 — Workspace Bootstrap

- [ ] `src/types/Workspace.ts` — `WorkspaceType` (`id`, `name`, `type: "corporate"|"personal"`, `is_active`, `created_at`)
- [ ] `src/service/workspaceService.ts` — `getWorkspaces()`, `createWorkspace()`, `renameWorkspace()`, `deleteWorkspace()`
- [ ] `src/context/WorkspaceContext.tsx`:
  - `workspaces: WorkspaceType[]`
  - `activeWorkspace: WorkspaceType | null`
  - `setActiveWorkspace(id: string)` — persists to `localStorage["activeWorkspaceId"]`
  - Fetches `GET /workspaces/` once token is available (enabled: !!token)
  - Restores `activeWorkspaceId` from `localStorage` on mount; defaults to `workspaces[0]` if not found
- [ ] Add `WorkspaceProvider` to `src/app/providers.tsx` (wrap inside `AuthProvider`)
- [ ] Update `AuthContext.login()` — after storing token, workspace fetch is triggered automatically via `WorkspaceContext`
- [ ] Update `AuthGuard` — after login redirect, wait for workspaces to load before rendering dashboard

---

## Phase 4 — Workspace Switcher (Navbar)

- [ ] Add workspace switcher dropdown to `Navbar.tsx`
  - Shows `activeWorkspace.name` + type badge (Corporate / Personal)
  - Lists all workspaces; clicking one calls `setActiveWorkspace(id)`
  - On switch: `queryClient.invalidateQueries()` — clears all cached data
- [ ] Show workspace `type` pill (blue = Corporate, purple = Personal) next to name

---

## Phase 5 — Service URL Migration (workspace prefix)

- [ ] Update `src/service/postsService.ts` — prefix all endpoints with `/workspaces/{workspace_pk}/`
- [ ] Update `src/service/websiteService.ts` — prefix all endpoints with `/workspaces/{workspace_pk}/`
- [ ] Update `src/service/documentService.ts` — prefix all endpoints with `/workspaces/{workspace_pk}/`
- [ ] Remove `?scope=` param from all service calls
- [ ] Remove `scope` field from all request bodies (generate, suggest_prompts, etc.)
- [ ] Update LinkedIn service endpoints to use workspace prefix
- [ ] Handle `404` workspace responses — toast + clear active workspace

---

## Phase 6 — Future

- [ ] Create workspace modal (name + type selector)
- [ ] Delete workspace with confirmation modal
- [ ] `/api/v1/auth/me/` call on app boot to validate token freshness
- [ ] Forgot password flow
- [ ] Session expiry handling (401 → clear storage → redirect `/login`)
