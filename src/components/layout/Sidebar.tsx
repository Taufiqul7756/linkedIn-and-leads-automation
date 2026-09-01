"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LuLogOut,
  LuSettings,
  LuChevronDown,
  LuLoader,
  LuLayoutGrid,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPlus,
  LuUser,
  LuFileText,
  LuZap,
} from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import { cn } from "@/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/service/authService";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

const linkedInSubItems = [
  { label: "Automation", href: "/linkedin/automation", icon: LuZap },
  { label: "Accounts & Knowledge", href: "/linkedin/accounts", icon: LuUser },
  { label: "Post Management", href: "/linkedin/post-management", icon: LuFileText },
];

const LINKEDIN_ROOT = "/linkedin";

const leadsSubItems = [
  { label: "Leads Generate", href: "/leads/generate", live: true },
  { label: "Leads Outreach", href: "/leads/outreach", live: false },
  { label: "Leads by Niche", href: "/leads/niche", live: false },
  { label: "Inbox", href: "/leads/inbox", live: false },
];

const LEADS_ROOT = "/leads";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(pathname.startsWith(LEADS_ROOT));
  const [linkedInOpen, setLinkedInOpen] = useState(pathname.startsWith(LINKEDIN_ROOT));
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      if (next) {
        setLeadsOpen(false);
        setLinkedInOpen(false);
        setUserMenuOpen(false);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;

  const displayName = user?.username || user?.email || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

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

  const isLinkedInActive = pathname.startsWith(LINKEDIN_ROOT);

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col overflow-hidden bg-[#1a1740] transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-white/10",
          collapsed ? "justify-center px-3" : "justify-between px-5"
        )}
      >
        {collapsed ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400">
            <span className="text-sm font-bold text-white">R</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400">
              <span className="text-sm font-bold text-white">R</span>
            </div>
            <span className="font-semibold text-white">Relay</span>
          </div>
        )}

        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <LuPanelLeftOpen className="h-4 w-4" />
          ) : (
            <LuPanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Workspace
          </p>
        )}

        {/* Leads Management */}
        <div>
          <button
            onClick={() => {
              if (collapsed) return;
              setLeadsOpen((v) => !v);
            }}
            title={collapsed ? "Leads Management" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
              pathname.startsWith(LEADS_ROOT)
                ? "bg-white/15 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <LuLayoutGrid className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Leads Management</span>
                <LuChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    leadsOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </>
            )}
          </button>

          {!collapsed && leadsOpen && (
            <div className="mt-0.5 space-y-0.5 pl-3">
              {leadsSubItems.map(({ label, href, live }) =>
                live ? (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                      pathname === href || pathname.startsWith(href + "/")
                        ? "bg-white/15 font-medium text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className="text-xs text-white/30">•</span>
                    <span className="flex-1">{label}</span>
                  </Link>
                ) : (
                  <span
                    key={href}
                    title="Coming soon"
                    className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/30"
                  >
                    <span className="text-xs text-white/20">•</span>
                    <span className="flex-1">{label}</span>
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/40">
                      Soon
                    </span>
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {/* LinkedIn */}
        <div className="mt-1">
          <button
            onClick={() => {
              if (collapsed) return;
              setLinkedInOpen((v) => !v);
            }}
            title={collapsed ? "LinkedIn" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
              isLinkedInActive ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0077B5]">
              <FaLinkedinIn className="h-3 w-3 text-white" />
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">LinkedIn</span>
                <LuChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    linkedInOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </>
            )}
          </button>

          {!collapsed && linkedInOpen && (
            <div className="mt-0.5 space-y-0.5 pl-3">
              {linkedInSubItems.map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-violet-600/60 font-medium text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {label === "Automation" ? (
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-600">
                        <LuPlus className="h-2.5 w-2.5 text-white" />
                      </div>
                    ) : (
                      <Icon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex-1">{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* User bottom section */}
      <div ref={userMenuRef} className="relative shrink-0 border-t border-white/10 p-3">
        {/* Popup menu */}
        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 z-30 mb-1 overflow-hidden rounded-xl border border-white/10 bg-[#1a1740] shadow-lg">
            <div className="p-1">
              <Link
                href="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LuSettings className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              >
                {loggingOut ? (
                  <LuLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <LuLogOut className="h-4 w-4" />
                )}
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        )}

        {/* Trigger */}
        {!mounted ? (
          <div className="h-10 w-full animate-pulse rounded-lg bg-white/10" />
        ) : collapsed ? (
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            title={displayName}
            className="flex w-full items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/10"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/30 text-xs font-bold text-violet-300">
              {initials}
            </div>
          </button>
        ) : (
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/10"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/30 text-xs font-bold text-violet-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{displayName}</p>
              <p className="truncate text-[10px] text-white/40">Account settings</p>
            </div>
            <LuChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200",
                userMenuOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        )}
      </div>
    </aside>
  );
}
