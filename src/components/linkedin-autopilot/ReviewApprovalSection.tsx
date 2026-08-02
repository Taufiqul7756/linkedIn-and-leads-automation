"use client";
import { useState, useEffect, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  LuPencil,
  LuRefreshCw,
  LuImage,
  LuGlobe,
  LuCheck,
  LuLoader,
  LuSparkles,
  LuX,
} from "react-icons/lu";
import toast from "react-hot-toast";
import { postsService } from "@/service/postsService";
import { linkedinService } from "@/service/linkedinService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { PostType } from "@/types/Post";
import EditPostModal from "./EditPostModal";
import RejectConfirmModal from "./RejectConfirmModal";
import RegeneratePostConfirmModal, {
  type RegeneratePostOptions,
} from "./RegeneratePostConfirmModal";

function parseHashtags(raw: unknown): string[] {
  if (!raw) return [];
  const items: string[] = Array.isArray(raw)
    ? raw.map(String)
    : String(raw)
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
  return items.filter((t) => t.length > 0).map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function ImagePromptDropdown({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
}: {
  prompt: string;
  onPromptChange: (val: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const wasGenerating = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (wasGenerating.current && !isGenerating) setOpen(false);
    wasGenerating.current = isGenerating;
  }, [isGenerating]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
      >
        <LuImage className="h-3.5 w-3.5" />
        Regenerate Image
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-1.5 w-96 -translate-x-1/2 rounded-xl border border-blue-100 bg-blue-50 p-3.5 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">Image prompt</span>
            <button
              onClick={() => setOpen(false)}
              className="text-blue-300 transition-colors hover:text-blue-500"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the image you want to generate…"
            className="w-full resize-none rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-2 flex justify-center">
            <button
              onClick={onGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <LuLoader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LuSparkles className="h-3.5 w-3.5" />
              )}
              {isGenerating ? "Generating…" : "Generate Image"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ReviewApprovalSection({ mode }: { mode: "agent" | "manual" }) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [editPost, setEditPost] = useState<PostType | null>(null);
  const [rejectPost, setRejectPost] = useState<PostType | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({});
  const [regenerateTarget, setRegenerateTarget] = useState<PostType | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const { data: textGeneratingFlag } = useQuery<number | null>({
    queryKey: ["posts-text-generating"],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  const isTextGenerating = textGeneratingFlag != null;

  const { data: baseline } = useQuery<number | null>({
    queryKey: ["posts-generating"],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  const isPolling = baseline !== null && baseline !== undefined;
  const baselineCount = typeof baseline === "number" ? baseline : 0;

  const { data: postsData, isLoading } = useQueryWithTokenRefresh(
    ["posts", "draft", workspaceId, mode],
    () => postsService(workspaceId).getDraftPosts(mode),
    {
      enabled: !!workspaceId,
      refetchInterval: isPolling
        ? (query) => {
            const results =
              (query.state.data as { results?: PostType[] } | undefined)?.results ?? [];
            const done =
              results.length > baselineCount && results.every((p) => p.image_status !== "pending");
            return done ? false : 5000;
          }
        : false,
    }
  );

  const posts = postsData?.results ?? [];
  const isGenerating = isPolling && posts.length <= baselineCount;

  useEffect(() => {
    const results = postsData?.results ?? [];
    if (
      isPolling &&
      results.length > baselineCount &&
      results.every((p) => p.image_status !== "pending")
    ) {
      queryClient.setQueryData(["posts-generating"], null);
    }
  }, [postsData, isPolling, baselineCount, queryClient]);

  const { data: account } = useQueryWithTokenRefresh(
    ["linkedin-account", workspaceId],
    () => linkedinService(workspaceId).getAccount(),
    { enabled: !!workspaceId }
  );
  const accountName = account?.name ?? "LinkedIn User";

  const approveMutation = useMutationWithTokenRefresh(
    (id: string) => postsService(workspaceId).approvePost(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId], exact: false });
        queryClient.invalidateQueries({ queryKey: ["posts", "all", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success("Post approved!");
        setApprovingId(null);
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error));
        setApprovingId(null);
      },
    }
  );

  const rejectMutation = useMutationWithTokenRefresh(
    (id: string) => postsService(workspaceId).rejectPost(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId], exact: false });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success("Post deleted.");
        setRejectPost(null);
        setRejectingId(null);
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error));
        setRejectingId(null);
      },
    }
  );

  const regeneratePostMutation = useMutationWithTokenRefresh(
    ({ id, opts }: { id: string; opts: RegeneratePostOptions }) =>
      postsService(workspaceId).regeneratePost(id, opts),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId], exact: false });
        toast.success("Post regenerated!");
        setRegeneratingId(null);
        setRegenerateTarget(null);
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error) || "Failed to regenerate post.");
        setRegeneratingId(null);
      },
    }
  );

  const generateImageMutation = useMutationWithTokenRefresh(
    ({ id, prompt }: { id: string; prompt: string }) =>
      postsService(workspaceId).generateImage(id, prompt),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId], exact: false });
        toast.success("Image generated!");
        setGeneratingImageId(null);
      },
      onError: (error: unknown) => {
        toast.error(extractErrorMessage(error) || "Failed to generate image.");
        setGeneratingImageId(null);
      },
    }
  );

  const handleGenerateImage = (postId: string) => {
    const prompt = imagePrompts[postId]?.trim();
    if (!prompt) return;
    setGeneratingImageId(postId);
    generateImageMutation.mutate({ id: postId, prompt });
  };

  const handleApprove = (id: string) => {
    setApprovingId(id);
    approveMutation.mutate(id);
  };

  const handleRejectConfirm = () => {
    if (!rejectPost) return;
    setRejectingId(rejectPost.id);
    rejectMutation.mutate(rejectPost.id);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-gray-900">Review &amp; Approval</h2>
          {!isLoading && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {postsData?.count ?? 0} awaiting
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && (isTextGenerating || isGenerating) && (
        <div className="mb-4 rounded-xl border border-dashed border-blue-200 bg-blue-50 py-12 text-center">
          <LuLoader className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-blue-600">Generating posts…</p>
          <p className="mt-1 text-xs text-blue-400">This usually takes 5–10 seconds.</p>
        </div>
      )}

      {!isLoading && !isTextGenerating && !isGenerating && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-400">No drafts awaiting review.</p>
        </div>
      )}

      {!isLoading && posts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {posts.map((post) => {
            const hashtags = parseHashtags(post.hashtags);
            const isApproving = approvingId === post.id;

            return (
              <div
                key={post.id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                      {getInitials(accountName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{accountName}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                        <span>Draft preview</span>
                        <LuGlobe className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  <span className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600">
                    Draft
                  </span>
                </div>

                <div className="mb-3 flex-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                  {post.body}
                </div>

                {post.image_status === "pending" ? (
                  <div className="mb-3 flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50">
                    <div className="flex flex-col items-center gap-2">
                      <LuLoader className="h-5 w-5 animate-spin text-blue-400" />
                      <span className="text-xs text-blue-400">Generating image…</span>
                    </div>
                  </div>
                ) : post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url}
                    alt="Post image"
                    className="mb-3 w-full rounded-lg object-cover"
                    style={{ maxHeight: 220 }}
                  />
                ) : null}

                {hashtags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {hashtags.map((tag) => (
                      <span key={tag} className="text-xs font-medium text-blue-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setEditPost(post)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <LuPencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setRegenerateTarget(post)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <LuRefreshCw className="h-3.5 w-3.5" />
                      Regenerate Post
                    </button>
                    <ImagePromptDropdown
                      prompt={imagePrompts[post.id] ?? ""}
                      onPromptChange={(val) =>
                        setImagePrompts((prev) => ({ ...prev, [post.id]: val }))
                      }
                      onGenerate={() => handleGenerateImage(post.id)}
                      isGenerating={generatingImageId === post.id}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRejectPost(post)}
                      disabled={isApproving}
                      className="rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleApprove(post.id)}
                      disabled={isApproving}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                    >
                      <LuCheck className="h-3.5 w-3.5" />
                      {isApproving ? "Approving…" : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RegeneratePostConfirmModal
        key={regenerateTarget?.id ?? "no-regenerate"}
        isOpen={regenerateTarget !== null}
        onClose={() => {
          if (!regeneratingId) setRegenerateTarget(null);
        }}
        defaultTone={regenerateTarget?.tone}
        defaultLength={regenerateTarget?.length}
        defaultContentStyle={regenerateTarget?.content_style}
        isConfirming={regeneratingId === regenerateTarget?.id}
        onConfirm={(opts) => {
          if (!regenerateTarget) return;
          setRegeneratingId(regenerateTarget.id);
          regeneratePostMutation.mutate({ id: regenerateTarget.id, opts });
        }}
      />

      <EditPostModal
        key={editPost?.id ?? "no-post"}
        isOpen={editPost !== null}
        onClose={() => setEditPost(null)}
        post={editPost}
        accountName={accountName}
      />

      <RejectConfirmModal
        isOpen={rejectPost !== null}
        onClose={() => {
          setRejectPost(null);
          setRejectingId(null);
        }}
        postExcerpt={rejectPost?.body.split("\n")[0] ?? ""}
        onConfirm={handleRejectConfirm}
        isConfirming={rejectingId !== null}
      />
    </div>
  );
}
