"use client";
import { useAuth } from "@/context/AuthContext";
import { LuUser, LuMail, LuHash } from "react-icons/lu";

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  const fields = [
    { label: "Username", value: user.username, icon: LuUser },
    { label: "Email", value: user.email, icon: LuMail },
    { label: "Account ID", value: user.id, icon: LuHash },
  ];

  const initials = (user.username || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Your account details.</p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Avatar row */}
        <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-600">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{user.username}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        {/* Fields */}
        <div className="divide-y divide-slate-100">
          {fields.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-4 px-6 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Icon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p className="truncate text-sm text-slate-800">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
