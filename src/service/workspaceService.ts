import { get, post, patch, del } from "@/lib/api";
import { WorkspaceType } from "@/types/Workspace";

export interface PaginatedWorkspaces {
  count: number;
  next: string | null;
  previous: string | null;
  results: WorkspaceType[];
}

export const workspaceService = () => ({
  // API may return plain array or paginated { results } — context handles both
  getWorkspaces: () => get<WorkspaceType[] | PaginatedWorkspaces>("/workspaces/"),
  createWorkspace: (name: string, type: "corporate" | "personal") =>
    post<WorkspaceType>("/workspaces/", { name, type }),
  setDefaultWorkspace: (id: string) =>
    patch<WorkspaceType>(`/workspaces/${id}/`, { is_default: true }),
  renameWorkspace: (id: string, name: string) =>
    patch<WorkspaceType>(`/workspaces/${id}/`, { name }),
  deleteWorkspace: (id: string) => del<void>(`/workspaces/${id}/`),
});
