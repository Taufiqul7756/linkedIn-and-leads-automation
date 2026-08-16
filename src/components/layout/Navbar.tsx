"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LuLogOut,
  LuBuilding2,
  LuUser,
  LuCheck,
  LuPlus,
  LuChevronDown,
  LuLoader,
  LuX,
  LuTrash2,
} from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import { cn } from "@/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceService } from "@/service/workspaceService";
import { authService } from "@/service/authService";
import toast from "react-hot-toast";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import Modal from "@/components/ui/Modal";
import { WorkspaceType } from "@/types/Workspace";

const navLinks = [{ label: "Leads", href: "/leads" }];

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
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    isLoading: wsLoading,
    setActiveWorkspace,
    refetchWorkspaces,
  } = useWorkspace();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Create workspace inline form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"corporate" | "personal">("corporate");
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WorkspaceType | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCreateForm(false);

      setNewName("");

      setNewType("corporate");
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "?";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService().logout();
    } catch {
      // proceed regardless
    } finally {
      logout();
      router.push("/login");
    }
  };

  const handleSelectWorkspace = async (id: string) => {
    setActiveWorkspace(id); // optimistic
    setMenuOpen(false);
    try {
      await workspaceService().setDefaultWorkspace(id);
      await refetchWorkspaces();
    } catch (err) {
      toast.error(extractErrorMessage(err));
      await refetchWorkspaces(); // revert to server state
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
      setMenuOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-4 md:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400">
              <span className="text-sm font-bold text-white">R</span>
            </div>
            <span className="hidden font-semibold text-gray-900 sm:inline">Relay</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map(({ label }) => (
              <span
                key={label}
                className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-gray-300"
                title="Coming soon"
              >
                {label}
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                  Soon
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/linkedin-autopilot"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:px-3.5",
                pathname === "/linkedin-autopilot"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              <FaLinkedinIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">LinkedIn Autopilot</span>
            </Link>

            {/* Avatar + workspace dropdown */}
            <div ref={menuRef} className="relative">
              {!mounted ? (
                <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200 sm:w-32" />
              ) : (
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-8 select-none items-center gap-1.5 rounded-full bg-violet-100 pl-1 pr-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-200"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-200 text-[11px] font-bold">
                    {initials}
                  </span>
                  {activeWorkspace && (
                    <span className="hidden max-w-[100px] truncate text-xs font-medium text-violet-800 sm:inline">
                      {activeWorkspace.name}
                    </span>
                  )}
                  <LuChevronDown className="h-3 w-3 text-violet-500" />
                </button>
              )}

              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  {/* User info */}
                  <div className="px-4 py-3">
                    <p className="truncate text-xs font-semibold text-gray-800">
                      {user?.username || user?.email}
                    </p>
                    {user?.username && (
                      <p className="truncate text-xs text-gray-400">{user.email}</p>
                    )}
                  </div>

                  <div className="mx-3 border-t border-gray-100" />

                  {/* Workspaces section */}
                  <div className="px-4 pb-1 pt-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Workspaces
                    </p>

                    {wsLoading ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                        Loading…
                      </div>
                    ) : (
                      <ul className="max-h-44 space-y-0.5 overflow-y-auto">
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
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {ws.name}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                    WORKSPACE_TYPE_STYLES[ws.type]
                                  )}
                                >
                                  {ws.type}
                                </span>
                                {isActive && (
                                  <LuCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(ws);
                                  setMenuOpen(false);
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

                    {/* Create workspace */}
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

                  <div className="mx-3 mt-2 border-t border-gray-100" />

                  {/* Sign out */}
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <LuLogOut className="h-4 w-4" />
                    {loggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
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
