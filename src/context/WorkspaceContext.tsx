"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { WorkspaceType } from "@/types/Workspace";
import { workspaceService } from "@/service/workspaceService";
import { useAuth } from "@/context/AuthContext";

const WORKSPACE_KEY = "activeWorkspaceId";

interface WorkspaceContextType {
  workspaces: WorkspaceType[];
  activeWorkspace: WorkspaceType | null;
  isLoading: boolean;
  setActiveWorkspace: (id: string) => void;
  refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceType[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workspaceService().getWorkspaces();
      // Handle both plain array and paginated { results: [] } response
      const list = Array.isArray(data)
        ? data
        : ((data as unknown as { results?: WorkspaceType[] }).results ?? []);
      setWorkspaces(list);
      // Prefer server-side default, fallback to localStorage, then first
      const stored = localStorage.getItem(WORKSPACE_KEY);
      const active =
        list.find((w) => w.is_default) ??
        (stored ? list.find((w) => w.id === stored) : null) ??
        list[0] ??
        null;
      if (active) {
        setActiveWorkspaceId(active.id);
        localStorage.setItem(WORKSPACE_KEY, active.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchWorkspaces();
    } else {
      setWorkspaces([]);

      setActiveWorkspaceId(null);
    }
  }, [token, fetchWorkspaces]);

  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    localStorage.setItem(WORKSPACE_KEY, id);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        setActiveWorkspace,
        refetchWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
