"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LuBell,
  LuBuilding2,
  LuUser,
  LuCheck,
  LuPlus,
  LuChevronDown,
  LuLoader,
  LuX,
  LuTrash2,
} from "react-icons/lu";
import { cn } from "@/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceService } from "@/service/workspaceService";
import toast from "react-hot-toast";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import Modal from "@/components/ui/Modal";
import { WorkspaceType } from "@/types/Workspace";

const WORKSPACE_TYPE_STYLES = {
  corporate: "bg-blue-100 text-blue-700",
  personal: "bg-purple-100 text-purple-700",
};

function WorkspaceIcon({ type }: { type: "corporate" | "personal" }) {
  return type === "corporate" ? (
    <LuBuilding2 className="h-3.5 w-3.5 shrink-0" />
  ) : (
    <LuUser className="h-3.5 w-3.5 shrink-0" />
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    isLoading: wsLoading,
    setActiveWorkspace,
    refetchWorkspaces,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"corporate" | "personal">("corporate");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCreateForm(false);

      setNewName("");

      setNewType("corporate");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;

  const displayName = user?.username || user?.email || "";
  const initials = displayName.slice(0, 2).toUpperCase() || "?";

  const handleSelectWorkspace = async (id: string) => {
    setActiveWorkspace(id);
    setOpen(false);
    try {
      await workspaceService().setDefaultWorkspace(id);
      await refetchWorkspaces();
    } catch (err) {
      toast.error(extractErrorMessage(err));
      await refetchWorkspaces();
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await workspaceService().deleteWorkspace(deleteTarget.id);
      await refetchWorkspaces();
      toast.success(`Workspace "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await workspaceService().createWorkspace(newName.trim(), newType);
      if (!ws) throw new Error("Failed to create workspace");
      await workspaceService().setDefaultWorkspace(ws.id);
      await refetchWorkspaces();
      toast.success(`Workspace "${ws.name}" created!`);
      setOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5">
        {/* Workspace switcher — left */}
        <div ref={dropdownRef} className="relative">
          {!mounted ? (
            <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
            >
              <WorkspaceIcon type={activeWorkspace?.type ?? "corporate"} />
              <span className="max-w-[160px] truncate font-medium text-gray-800">
                {activeWorkspace?.name ?? "Select workspace"}
              </span>
              {activeWorkspace && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                    WORKSPACE_TYPE_STYLES[activeWorkspace.type]
                  )}
                >
                  {activeWorkspace.type}
                </span>
              )}
              <LuChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200",
                  open ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
          )}

          {open && (
            <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="px-4 pt-3 pb-1">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Workspaces
                </p>

                {wsLoading ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                    <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <ul className="max-h-52 space-y-0.5 overflow-y-auto">
                    {workspaces.map((ws) => {
                      const isActive = ws.id === activeWorkspace?.id;
                      return (
                        <li key={ws.id} className="group flex items-center gap-1">
                          <button
                            onClick={() => handleSelectWorkspace(ws.id)}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <WorkspaceIcon type={ws.type} />
                            <span className="min-w-0 flex-1 truncate font-medium">{ws.name}</span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                WORKSPACE_TYPE_STYLES[ws.type]
                              )}
                            >
                              {ws.type}
                            </span>
                            {isActive && <LuCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(ws);
                              setOpen(false);
                            }}
                            className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                            title="Delete workspace"
                          >
                            <LuTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!showCreateForm ? (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-2 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <LuPlus className="h-3.5 w-3.5" />
                    Create workspace
                  </button>
                ) : (
                  <form onSubmit={handleCreateWorkspace} className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        New workspace
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="text-gray-300 hover:text-gray-500"
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Workspace name"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    />
                    <div className="flex gap-1.5">
                      {(["corporate", "personal"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewType(t)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium capitalize transition-colors",
                            newType === t
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          )}
                        >
                          <WorkspaceIcon type={t} />
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={!newName.trim() || creating}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creating ? (
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LuPlus className="h-3.5 w-3.5" />
                      )}
                      {creating ? "Creating…" : "Create"}
                    </button>
                  </form>
                )}
              </div>
              <div className="mt-2 border-t border-gray-100" />
              <div className="px-4 py-2">
                <p className="truncate text-xs font-semibold text-gray-700">
                  {user?.username || user?.email}
                </p>
                {user?.username && (
                  <p className="truncate text-[11px] text-gray-400">{user.email}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right — bell + avatar */}
        <div className="flex items-center gap-2">
          <button className="relative rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <LuBell className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-700">
            {initials}
          </div>
        </div>
      </header>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete workspace"
        width="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This action
          cannot be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteWorkspace}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
