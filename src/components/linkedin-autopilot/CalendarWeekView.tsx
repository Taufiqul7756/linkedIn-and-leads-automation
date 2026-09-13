"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { cn } from "@/utils/cn";
import type { PostType } from "@/types/Post";

const STATUS_BLOCK: Record<PostType["status"], string> = {
  published: "border-green-400 bg-green-50 text-green-800",
  scheduled: "border-blue-400 bg-blue-50 text-blue-800",
  approved: "border-emerald-400 bg-emerald-50 text-emerald-800",
  draft: "border-violet-400 bg-violet-50 text-violet-800",
  failed: "border-red-400 bg-red-50 text-red-800",
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_PX = 56;

function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getPostDate(post: PostType): Date | null {
  const raw = post.scheduled_at ?? post.published_at ?? post.suggested_publish_at;
  return raw ? new Date(raw) : null;
}

function fmtHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface Props {
  posts: PostType[];
  onPostClick: (id: string) => void;
}

export default function CalendarWeekView({ posts, onPostClick }: Props) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 7am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = HOUR_PX * 7;
    }
  }, []);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const rangeLabel = `${weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  const prevWeek = () =>
    setWeekStart((p) => {
      const d = new Date(p);
      d.setDate(d.getDate() - 7);
      return d;
    });

  const nextWeek = () =>
    setWeekStart((p) => {
      const d = new Date(p);
      d.setDate(d.getDate() + 7);
      return d;
    });

  // Group posts by day index within the visible week
  const postsByDay = useMemo(() => {
    const groups: PostType[][] = Array.from({ length: 7 }, () => []);
    posts.forEach((post) => {
      const d = getPostDate(post);
      if (!d) return;
      const idx = weekDays.findIndex((wd) => sameDay(wd, d));
      if (idx !== -1) groups[idx].push(post);
    });
    return groups;
  }, [posts, weekDays]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const totalHeight = 24 * HOUR_PX;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">{rangeLabel}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(weekStartOf(today))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={prevWeek}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <LuChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextWeek}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <LuChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day column headers */}
      <div
        className="grid border-b border-gray-100"
        style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
      >
        <div className="border-r border-gray-100" />
        {weekDays.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className="border-l border-gray-100 py-2 text-center">
              <p
                className={cn(
                  "text-[11px] font-medium",
                  isToday ? "text-violet-600" : "text-gray-500"
                )}
              >
                {DAY_SHORT[d.getDay()]}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday ? "bg-violet-600 text-white" : "text-gray-800"
                )}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="max-h-[580px] overflow-y-auto">
        <div className="relative flex" style={{ height: totalHeight }}>
          {/* Hour labels gutter */}
          <div className="w-14 shrink-0 border-r border-gray-100">
            {hours.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end border-b border-gray-100 pr-2 pt-0.5"
                style={{ height: HOUR_PX }}
              >
                <span className="text-[10px] font-medium text-gray-400">{fmtHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((_, dayIdx) => (
            <div
              key={dayIdx}
              className="relative flex-1 border-l border-gray-100"
              style={{ height: totalHeight }}
            >
              {/* Hour separator lines */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-b border-gray-100"
                  style={{ top: h * HOUR_PX, height: HOUR_PX }}
                />
              ))}

              {/* Posts */}
              {postsByDay[dayIdx].map((post) => {
                const d = getPostDate(post)!;
                const raw = post.scheduled_at ?? post.published_at ?? post.suggested_publish_at;
                const top = d.getHours() * HOUR_PX + (d.getMinutes() / 60) * HOUR_PX;
                return (
                  <button
                    key={post.id}
                    onClick={() => onPostClick(post.id)}
                    className={cn(
                      "absolute inset-x-0.5 rounded border-l-2 px-1.5 py-0.5 text-left transition-opacity hover:opacity-75",
                      STATUS_BLOCK[post.status]
                    )}
                    style={{ top, minHeight: 22, zIndex: 1 }}
                  >
                    <p className="truncate text-[10px] font-semibold leading-tight">
                      {raw ? fmtTime(raw) : ""} · {post.body.slice(0, 22)}
                    </p>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
