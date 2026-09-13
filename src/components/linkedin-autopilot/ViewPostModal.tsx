"use client";
import { LuEye, LuThumbsUp, LuMessageSquare, LuCalendar, LuClock } from "react-icons/lu";
import Modal from "@/components/ui/Modal";
import { postsService } from "@/service/postsService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";

interface ViewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string | null;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  draft: "bg-violet-100 text-violet-700",
  failed: "bg-red-100 text-red-700",
};

export default function ViewPostModal({ isOpen, onClose, postId }: ViewPostModalProps) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const { data: post, isLoading } = useQueryWithTokenRefresh(
    ["post", workspaceId, postId],
    () => postsService(workspaceId).getPost(postId!),
    { enabled: !!postId && !!workspaceId }
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="View Post" width="2xl">
      {isLoading && (
        <div className="space-y-3">
          {[80, 100, 60, 40].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-gray-100"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {!isLoading && !post && (
        <p className="py-8 text-center text-sm text-gray-400">Post not found.</p>
      )}

      {!isLoading && post && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[post.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {post.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <LuCalendar className="h-3 w-3" /> Scheduled
              </div>
              <p className="text-xs text-gray-700">{formatDateTime(post.scheduled_at)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <LuClock className="h-3 w-3" /> Published
              </div>
              <p className="text-xs text-gray-700">{formatDateTime(post.published_at)}</p>
            </div>
          </div>

          <div className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
            {post.body}
          </div>

          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt="Post image"
              className="w-full rounded-xl object-cover"
              style={{ maxHeight: 260 }}
            />
          )}

          {post.status === "published" && post.engagement && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Engagement
              </p>
              <div className="flex flex-wrap gap-6">
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <LuEye className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold">{post.engagement.impressions}</span> impressions
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <LuThumbsUp className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold">{post.engagement.likes}</span> likes
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <LuMessageSquare className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold">{post.engagement.comments}</span> comments
                </span>
                <span className="text-sm font-semibold text-green-600">
                  {post.engagement.rate.toFixed(1)}% rate
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
