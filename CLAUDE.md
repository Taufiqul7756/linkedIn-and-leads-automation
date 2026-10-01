# CLAUDE.md — AI Project Bible

This file is read by Claude at the start of every session.
It contains all conventions, patterns, and rules for this project.

**Also read `CONTEXT.md` at the start of every session.** It contains the domain glossary, active routes, and post status flow. Keep it up to date — if a new feature adds a new term, route, or status, update `CONTEXT.md` in the same session.

## Tech Stack

- **Framework**: Next.js 16, App Router, TypeScript
- **Styling**: Tailwind CSS v4 (dark mode via `class`)
- **Data Fetching**: React Query + Axios
- **Validation**: Zod
- **Animations**: Framer Motion
- **Theming**: next-themes
- **Notifications**: react-hot-toast
- **Icons**: react-icons
- **Utilities**: lodash, clsx, tailwind-merge

## Folder Structure

```
src/
├── app/                        # App Router (pages, layouts)
├── components/
│   ├── ui/                     # Generic primitives (Button, Modal, Spinner, Badge)
│   ├── layout/                 # Navbar, Header, Footer, Sidebar
│   └── [feature]/              # Feature-scoped components (e.g. linkedin-autopilot/)
├── hooks/                      # useQueryWithTokenRefresh, useMutationWithTokenRefresh, etc.
├── service/                    # One file per domain (authService, etc.)
├── lib/
│   ├── api.ts                  # Axios instance
│   ├── queryClient.ts          # React Query singleton
│   ├── mock/                   # Mock data per feature (e.g. linkedinAutopilot.ts)
│   └── validations/            # Zod schemas
├── types/                      # TypeScript interfaces per domain
├── context/                    # React contexts
├── config/                     # config.ts (env vars via Config object)
├── utils/                      # Pure utility functions (cn, extractErrorMessage, formatDate)
└── styles/                     # globals.css
```

## Docs Structure

```
docs/
├── designs/
│   └── screenshots/[feature]/  # Reference screenshots for each feature
├── prd/                        # One PRD markdown file per feature
└── tasks/                      # One task tracking file per feature
```

Always create `docs/prd/<feature>.md` and `docs/tasks/<feature>.md` before building a new feature.

## API Layer Rules

### Axios Instance
Located at `src/lib/api.ts`. Includes:
- `baseURL` from `Config.API_URL`
- `withCredentials: false` (token in `Authorization` header)
- 401 interceptor → clears localStorage + redirects to `/login`
- Exported helpers: `get<T>`, `post<T>`, `patch<T>`, `del<T>` — these **swallow errors** (return `undefined` on failure)
- Raw variants: `postRaw<T>`, `patchRaw<T>` — these **re-throw on error** — use whenever callers need `onError` / `catch` handling (e.g. showing inline errors, opening a modal on failure)

### Config Object
Located at `src/config/config.ts`.
**Never read `process.env` directly in components or services.**
Always use `Config.API_URL`, `Config.BACKEND_URL`, `Config.SITE_URL`.

### Service Pattern
Each domain has a service file, e.g. `src/service/projectsService.ts`:
```ts
import { get, post, patch, del } from "@/lib/api";
import { ProjectType } from "@/types/project";

export const projectsService = () => ({
  getProjects: () => get<ProjectType[]>("/projects/"),
  getProjectById: (id: number) => get<ProjectType>(`/projects/${id}/`),
  createProject: (data: Partial<ProjectType>) => post<ProjectType>("/projects/", data),
  updateProject: (id: number, data: Partial<ProjectType>) =>
    patch<ProjectType>(`/projects/${id}/`, data),
  deleteProject: (id: number) => del<void>(`/projects/${id}/`),
});
```

### GET Calls — useQueryWithTokenRefresh

```tsx
const { data, isLoading, error } = useQueryWithTokenRefresh(
  ["query-key", dependency],
  async () => {
    const response = await domainService().getMethod(dependency);
    return response;
  },
  { enabled: !!dependency },
);
```

### POST/PATCH/DELETE — useMutationWithTokenRefresh

```tsx
const handleAction = useMutationWithTokenRefresh(
  (data: DataType) => domainService().mutateMethod(data),
  {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["query-key"] });
      toast.success("Success message");
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      toast.error(message);
    },
  },
);
// Call: handleAction.mutate(data)
```

## Naming Conventions

| Thing         | Convention              | Example                       |
| ------------- | ----------------------- | ----------------------------- |
| Components    | PascalCase              | `UserCard.tsx`                |
| Hooks         | `use` prefix, camelCase | `useQueryWithTokenRefresh.ts` |
| Services      | camelCase + `Service`   | `projectsService.ts`          |
| Types         | PascalCase              | `ProjectType.ts`              |
| Zod schemas   | camelCase + `Schema`    | `projectSchema.ts`            |
| Route folders | kebab-case              | `user-management/`            |

## TypeScript Rules

- No `any` — use `unknown` and narrow
- All API shapes have a type in `src/types/`
- Zod schemas in `src/lib/validations/`

## Component Rules

- One default export per file
- `"use client"` only when needed (state, events, browser APIs)
- Props interfaces defined above the component in the same file

## Modal Pattern

Use `src/components/ui/Modal.tsx` for all modals. It handles backdrop, ESC key, title, and close button.

```tsx
<Modal isOpen={open} onClose={() => setOpen(false)} title="Title" width="md">
  {/* content */}
</Modal>
```

- Widths: `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` | `"3xl"`
- Extra props: `disableBackdropClose` (bool), `minHeight` (string, inline style on body), `bodyClassName` (string, extra classes on body div)
- Modal panel has `max-h-[90vh]` with scrollable body (`overflow-y-auto`) and pinned header (`shrink-0`)
- Modal state lives in the parent component
- Pass `null` as the selected item when closed; guard with `if (!item) return null` inside the modal
- Use `key={item?.id ?? "no-item"}` on modals that hold local state — remounts with fresh state when item changes (avoids `useEffect` sync)

## Dropdown Pattern (click-outside)

For custom dropdowns (not `<select>`), use `useRef` + `useEffect` to close on outside click:

```tsx
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!open) return;
  const handler = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [open]);
```

## Checkbox Pattern (indeterminate)

Native `indeterminate` is not a React prop — set it via `ref`:

```tsx
const ref = useRef<HTMLInputElement>(null);
useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
<input ref={ref} type="checkbox" checked={checked} onChange={onChange} />
```

## Global CSS Conventions

Defined in `src/app/globals.css`:
- `button { cursor: pointer; }` — all buttons get pointer cursor
- `input[type="checkbox"] { cursor: pointer; }` — all checkboxes get pointer cursor
- Page background color: `#E9ECF5` (blue-lavender)
- Section cards with blue-gray gradient: `bg-gradient-to-b from-[#ECEEF8] to-white`

## Sibling Component Coordination (via React Query cache)

To share state between sibling components without prop drilling, use a manually-set React Query cache key:

```tsx
// Producer (e.g. GeneratePostsSection) — set a flag after async action
queryClient.setQueryData(["my-flag"], Date.now());

// Consumer (e.g. ReviewApprovalSection) — subscribe with enabled: false
const { data: flagValue } = useQuery({
  queryKey: ["my-flag"],
  queryFn: () => null,
  enabled: false,
  staleTime: Infinity,
});
const isActive = flagValue != null;

// Clear the flag when done
queryClient.setQueryData(["my-flag"], null);
```

Used for: post-generate polling flag `["posts-generating"]`.

## File Upload Pattern

For binary file uploads (e.g. image upload):

```ts
// Service
uploadImage: (id: string, file: File) => {
  const form = new FormData();
  form.append("image", file);   // field name must match backend
  return post<ResponseType>(`/resource/${id}/upload_image/`, form);
},
```

- Show a local `URL.createObjectURL(file)` preview immediately
- Auto-trigger upload in the `onChange` handler (no separate submit step)
- Show spinner overlay on preview while uploading; clear on success/error

## Multi-Param URL Persistence Pattern

When a page manages two independently-writable URL params (e.g. `?workspace=` and `?mode=`), the "initialize missing params" effect must **not** include `searchParams` in its dependency array — stale closures cause one param to silently overwrite the other. Read `window.location.search` instead:

```tsx
// Effect: inject ?workspace= only when absent
useEffect(() => {
  if (!activeWorkspace) return;
  const liveParams = new URLSearchParams(window.location.search); // live, not stale
  if (liveParams.get("workspace")) return;                        // already present → bail
  liveParams.set("workspace", activeWorkspace.id);
  if (!liveParams.get("mode")) liveParams.set("mode", "agent");
  router.replace(`${pathname}?${liveParams.toString()}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeWorkspace?.id, pathname]); // never re-fires on URL-only changes
```

Keep the URL→context sync effect's deps narrow too: `[searchParams, workspaces]` (not `activeWorkspace`).

## Image Chat Polling Pattern

Used on `/linkedin/edit-image/[postId]` — `imageChatService` uses axios directly (same as `linkedinAgentService`).

```ts
// Open chat on mount — also restores "Added" button state
const c = await imageChatService(workspaceId).openChat(postId);
setChat(c);
const alreadyAdded = c.images.find((img) => img.is_added_on_post);
if (alreadyAdded) setAddedImageId(alreadyAdded.id);
if (c.status === "running") startPolling(c.id);

// Poll every 2s while running
pollRef.current = setInterval(async () => {
  const c = await imageChatService(workspaceId).getChat(chatId);
  setChat(c);
  if (c.status === "ready") stopPolling();
}, 2000);

// Send message — optimistic UI: append user message immediately, replace on response
setChat((prev) => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev);
const c = await imageChatService(workspaceId).sendMessage(chat.id, prompt);
setChat(c); // server response replaces state wholesale (removes optimistic msg)
if (c.status === "running") startPolling(c.id);
// On error: remove optimistic message and restore input

// Add image to post
const c = await imageChatService(workspaceId).addToPost(chat.id, imageId);
setChat(c); // post_image_url updated in returned chat
```

- Send button disabled while `chat.status === "running"`
- Replace state wholesale from each response — never append client-side (except the optimistic user message pre-send)
- `chat.post_image_url` drives both the preview and media section (persists on reload)
- `is_added_on_post: boolean` on `GeneratedImage` — read on `openChat` to restore `addedImageId` after reload
- Delete image: `PATCH posts/{id}/ { image_url: "" }` then `setChat(prev => ({ ...prev, post_image_url: "" }))`
- Auto-scroll: `useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat?.messages])`
- Scroll-to-newest button: shown when `chatContainerRef` scroll distance from bottom >120px

## Docs Maintenance

After every feature change or bug fix, update the relevant docs **in the same session** — never leave them stale.

| What changed | Where to update |
| --- | --- |
| LinkedIn Agent feature (UI logic, state, components) | `docs/prd/linkedin-agent.md` |
| Leads feature (UI logic, state, components) | `docs/prd/leads-agent.md` |
| API shape changed (new field, new endpoint, new error, renamed param) | `docs/api-reference.md` |
| New route, new domain term, or status change | `CONTEXT.md` |
| Cross-session pattern or architectural decision | `CLAUDE.md` + `memory/MEMORY.md` |

Rules:
- If an API field is added or removed, update the TypeScript type block **and** the JSON example in `docs/api-reference.md`
- If a PRD section says "pending" and the feature ships, remove the pending note and replace with the implemented behaviour
- If only the frontend implementation changed (no API shape change), only the PRD needs updating — not `api-reference.md`

## Do Not

- Read `process.env` directly in components
- Hardcode **anything** visual in component files — no raw hex values, no arbitrary px/rem spacing, no magic numbers for sizes, shadows, radii, or z-indices. Every design value must come from `src/app/globals.css`

## No Hardcoding Rule

All design tokens live in `src/app/globals.css` as CSS variables and Tailwind utility extensions. Components reference tokens — they never define values.

| Category | Wrong | Right |
| --- | --- | --- |
| Color | `bg-[#E9ECF5]` / `color: #2563eb` | CSS var defined in `globals.css`, referenced via Tailwind class |
| Spacing | `mt-[18px]` / `padding: 14px` | Standard Tailwind scale (`mt-4`, `p-3`) or a named CSS var |
| Border radius | `rounded-[10px]` | Standard Tailwind scale or a CSS var |
| Shadow | `shadow-[0_2px_8px_rgba(0,0,0,0.1)]` | Named shadow CSS var in `globals.css` |
| Z-index | `z-[999]` | Named z-index CSS var or standard Tailwind scale |
| Font size / weight | `text-[13px]` | Standard Tailwind scale |

**When adding a new design value:**
1. Define it as a CSS variable in `globals.css` under the relevant section
2. Use it via Tailwind or `var(--name)` in the component
3. Never repeat the raw value in two places — the variable is the single source of truth
- Use `any` type
- Commit directly to `main` — always use PRs
- Use `useEffect` to sync props into state inside a modal — use `key={item?.id}` on the modal in the parent instead
- Include `searchParams` in an initialization `useEffect` that also calls `router.replace` — use `window.location.search` to avoid stale-closure param conflicts
