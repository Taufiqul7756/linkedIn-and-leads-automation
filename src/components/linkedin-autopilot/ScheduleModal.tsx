"use client";
import { useState } from "react";
import { LuCalendar, LuClock, LuMapPin } from "react-icons/lu";
import Modal from "@/components/ui/Modal";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "schedule" | "reschedule";
  postExcerpt: string;
  currentScheduled?: string | null;
  suggestedAt?: string | null;
  onConfirm: (scheduledAt: string) => void;
  isLoading?: boolean;
}

function formatScheduled(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  mode,
  postExcerpt,
  currentScheduled,
  suggestedAt,
  onConfirm,
  isLoading = false,
}: ScheduleModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const prefill = suggestedAt ?? currentScheduled ?? null;
  const [date, setDate] = useState(() => (prefill ? isoToLocalDate(prefill) : today));
  const [time, setTime] = useState(() => (prefill ? isoToLocalTime(prefill) : "09:00"));

  const handleConfirm = () => {
    if (!date || !time) return;
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    onConfirm(scheduledAt);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "reschedule" ? "Reschedule Post" : "Schedule Post"}
      width="md"
    >
      {/* Post preview */}
      <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <p className="line-clamp-2 text-sm text-gray-600">{postExcerpt}</p>
        {mode === "reschedule" && currentScheduled && (
          <p className="mt-1.5 text-xs text-gray-400">
            Currently scheduled:{" "}
            <span className="font-medium text-blue-600">{formatScheduled(currentScheduled)}</span>
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Date */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <LuCalendar className="h-3.5 w-3.5" />
            Date
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Time */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <LuClock className="h-3.5 w-3.5" />
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Timezone (read-only) */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5">
          <LuMapPin className="h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs font-medium text-gray-700">Timezone</p>
            <p className="text-xs text-gray-400">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!date || !time || isLoading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving…" : mode === "reschedule" ? "Reschedule" : "Schedule Post"}
        </button>
      </div>
    </Modal>
  );
}
