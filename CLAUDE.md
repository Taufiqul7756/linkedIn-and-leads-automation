# CLAUDE.md — AI Project Bible

This file is read by Claude at the start of every session.
It contains all conventions, patterns, and rules for this project.

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
- `withCredentials: true` (httpOnly cookies)
- 401 interceptor with token refresh and retry
- Exported helpers: `get<T>`, `post<T>`, `patch<T>`, `del<T>`

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

## Do Not

- Read `process.env` directly in components
- Use hardcoded colors — add to Tailwind CSS vars in `globals.css`
- Use `any` type
- Commit directly to `main` — always use PRs
- Use `useEffect` to sync props into state inside a modal — use `key={item?.id}` on the modal in the parent instead
