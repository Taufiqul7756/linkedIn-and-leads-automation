"use client";
import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { cn } from "@/utils/cn";
import type { PostType } from "@/types/Post";

const STATUS_DOT: Record<PostType["status"], string> = {
  published: "bg-green-500",
  scheduled: "bg-blue-500",
  approved: "bg-emerald-500",
  draft: "bg-violet-500",
  failed: "bg-red-500",
};

const STATUS_CHIP: Record<PostType["status"], string> = {
  published: "bg-green-50 text-green-800",
  scheduled: "bg-blue-50 text-blue-800",
  approved: "bg-emerald-50 text-emerald-800",
  draft: "bg-violet-50 text-violet-800",
  failed: "bg-red-50 text-red-800",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getPostDate(post: PostType): Date | null {
  const raw = post.scheduled_at ?? post.published_at ?? post.suggested_publish_at;
  return raw ? new Date(raw) : null;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface Props {
  posts: PostType[];
  onPostClick: (id: string) => void;
}

export default function CalendarMonthView({ posts, onPostClick }: Props) {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build 42-cell grid (6 weeks × 7 days)
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay++), inMonth: false });
  }

  // Group posts by date key
  const postsByDate = new Map<string, PostType[]>();
  posts.forEach((post) => {
    const d = getPostDate(post);
    if (!d) return;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!postsByDate.has(key)) postsByDate.set(key, []);
    postsByDate.get(key)!.push(post);
  });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <LuChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <LuChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }, idx) => {
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const dayPosts = postsByDate.get(key) ?? [];
          const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isLastCol = idx % 7 === 6;

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[110px] border-b border-r border-gray-100 p-1.5",
                !inMonth && "bg-gray-50/40",
                isToday && "ring-2 ring-inset ring-violet-500",
                isLastCol && "border-r-0"
              )}
            >
              <span
                className={cn(
                  "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                  isToday
                    ? "bg-violet-600 text-white"
                    : isWeekend && inMonth
                      ? "text-amber-500"
                      : inMonth
                        ? "text-gray-700"
                        : "text-gray-300"
                )}
              >
                {date.getDate()}
              </span>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => {
                  const raw = post.scheduled_at ?? post.published_at ?? post.suggested_publish_at;
                  const time = raw ? fmtTime(raw) : "";
                  return (
                    <button
                      key={post.id}
                      onClick={() => onPostClick(post.id)}
                      className={cn(
                        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-opacity hover:opacity-75",
                        STATUS_CHIP[post.status]
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[post.status])}
                      />
                      <span className="truncate text-[10px] font-medium leading-tight">
                        {time && `${time} · `}
                        {post.body.slice(0, 20)}
                      </span>
                    </button>
                  );
                })}
                {dayPosts.length > 3 && (
                  <p className="px-1 text-[10px] text-gray-400">+{dayPosts.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
