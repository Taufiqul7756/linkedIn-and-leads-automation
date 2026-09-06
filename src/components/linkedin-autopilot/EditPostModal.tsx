"use client";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LuX,
  LuPencil,
  LuPlus,
  LuSettings,
  LuSend,
  LuImage,
  LuVideo,
  LuUpload,
  LuLoader,
} from "react-icons/lu";
import toast from "react-hot-toast";
import TiptapEditor from "@/components/ui/TiptapEditor";
import { postsService } from "@/service/postsService";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { PostType } from "@/types/Post";

// ─── helpers ──────────────────────────────────────────────────────────────────

function plainTextToTiptap(text: string): object {
  const content = text.split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content };
}

// Same strategy as EditDraftModal: prefer body_blocks (Tiptap JSON) over plain text body.
// PostType doesn't declare body_blocks but the API returns it after it's been saved.
function getInitialContent(post: PostType): object {
  const p = post as PostType & { body_blocks?: unknown };
  const bb = p.body_blocks;

  if (bb && typeof bb === "object" && !Array.isArray(bb)) {
    const doc = bb as { type?: string };
    if (doc.type === "doc") return bb as object;
  }

  if (typeof bb === "string" && bb) {
    try {
      const parsed = JSON.parse(bb);
      if (parsed?.type === "doc") return parsed;
    } catch {
      /* ignore */
    }
  }

  return post.body ? plainTextToTiptap(post.body) : { type: "doc", content: [] };
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  post: PostType | null;
  accountName?: string;
}

export default function EditPostModal({ isOpen, onClose, post, accountName: _accountName }: Props) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [bodyJson, setBodyJson] = useState<object>({ type: "doc", content: [] });
  const [editorKey, setEditorKey] = useState(0);
  const [mediaTab, setMediaTab] = useState<"image" | "video">("image");
  const [imageRemoved, setImageRemoved] = useState(false);
  const [videoRemoved, setVideoRemoved] = useState(false);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");

  // Re-initialise when post changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!post) return;
    setBodyJson(getInitialContent(post));
    setEditorKey((k) => k + 1);
    setMediaTab(post.media_type === "video" ? "video" : "image");
    setScheduledDate(isoToDateInput(post.suggested_publish_at));
    setScheduledTime(isoToTimeInput(post.suggested_publish_at));
    setImageRemoved(false);
    setVideoRemoved(false);
    setNewImagePreview(null);
    setNewVideoPreview(null);
    setChangeMsg("");
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!post || !workspaceId) return;
    setSaving(true);
    try {
      let suggested_publish_at: string | null = null;
      if (scheduledDate) {
        suggested_publish_at = `${scheduledDate}T${scheduledTime || "00:00"}:00`;
      }
      await postsService(workspaceId).patchPost(post.id, {
        body_blocks: bodyJson,
        suggested_publish_at,
        ...(imageRemoved ? { image_url: "" } : {}),
        ...(videoRemoved ? { video_url: "" } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
      toast.success("Post saved.");
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Failed to save post.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !post) return;
    setNewImagePreview(URL.createObjectURL(file));
    setImageRemoved(false);
    setIsUploading(true);
    try {
      await postsService(workspaceId).uploadImage(post.id, file);
      queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setNewImagePreview(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !post) return;
    setNewVideoPreview(URL.createObjectURL(file));
    setVideoRemoved(false);
    setIsUploading(true);
    try {
      await postsService(workspaceId).uploadVideo(post.id, file);
      queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
      toast.success("Video uploaded.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setNewVideoPreview(null);
    } finally {
      setIsUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  if (!isOpen || !post) return null;

  const showExistingImage = !!post.image_url && !imageRemoved && !newImagePreview;
  const showNewImagePreview = !!newImagePreview;
  const showImageUpload = (imageRemoved || !post.image_url) && !newImagePreview;
  const showExistingVideo = !!post.video_url && !videoRemoved && !newVideoPreview;
  const showNewVideoPreview = !!newVideoPreview;
  const showVideoUpload = (videoRemoved || !post.video_url) && !newVideoPreview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative mx-4 flex w-full max-w-[700px] flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <LuPencil className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Edit post</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title — only shown when the post has a headline */}
          {post.headline && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500">
                {post.headline}
              </p>
            </div>
          )}

          {/* Body — Tiptap rich text editor */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Body</label>
            <TiptapEditor
              key={editorKey}
              content={bodyJson}
              onChange={setBodyJson}
              minHeight="240px"
              placeholder="Write your LinkedIn post…"
            />
          </div>

          {/* Mini composer — ask for changes (disabled, coming soon) */}
          <div className="relative">
            <div className="rounded-xl border border-gray-200 px-4 py-3 opacity-50 pointer-events-none select-none">
              <textarea
                value={changeMsg}
                onChange={(e) => setChangeMsg(e.target.value)}
                placeholder={`Ask for changes, or "show all drafts"...`}
                rows={2}
                disabled
                className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none disabled:cursor-not-allowed"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                  Using your knowledge base
                  <button disabled className="text-teal-400">
                    <LuX className="h-3 w-3" />
                  </button>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400"
                  >
                    <LuPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400"
                  >
                    <LuSettings className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white opacity-50"
                  >
                    Send
                    <LuSend className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
            <span className="absolute -top-2 -right-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600">
              Soon
            </span>
          </div>

          {/* Media — Image + Video tabs */}
          <div>
            <p className="mb-2.5 text-sm font-medium text-gray-700">Media</p>

            {/* Tabs */}
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setMediaTab("image")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mediaTab === "image"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <LuImage className="h-3.5 w-3.5" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setMediaTab("video")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mediaTab === "video"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <LuVideo className="h-3.5 w-3.5" />
                Video
              </button>
            </div>

            {/* Image tab */}
            {mediaTab === "image" && (
              <>
                {showExistingImage && (
                  <div className="relative overflow-hidden rounded-xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="w-full object-cover"
                      style={{ maxHeight: 220 }}
                    />
                    <button
                      onClick={() => setImageRemoved(true)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <LuX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {showNewImagePreview && (
                  <div className="relative overflow-hidden rounded-xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={newImagePreview!}
                      alt="New post image"
                      className="w-full object-cover"
                      style={{ maxHeight: 220 }}
                    />
                    {isUploading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <LuLoader className="h-6 w-6 animate-spin text-white" />
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setNewImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {showImageUpload && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 text-gray-400 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 disabled:opacity-50"
                  >
                    <LuUpload className="h-5 w-5" />
                    <span className="text-sm font-medium">Click to upload an image</span>
                    <span className="text-xs">PNG, JPG, WEBP</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {imageRemoved && !newImagePreview && post.image_url && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Original image removed.{" "}
                    <button
                      onClick={() => setImageRemoved(false)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Undo
                    </button>
                  </p>
                )}
              </>
            )}

            {/* Video tab */}
            {mediaTab === "video" && (
              <>
                {showExistingVideo && (
                  <div className="relative overflow-hidden rounded-xl border border-gray-200">
                    <video
                      src={post.video_url}
                      controls
                      className="w-full"
                      style={{ maxHeight: 220 }}
                    />
                    <button
                      onClick={() => setVideoRemoved(true)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <LuX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {showNewVideoPreview && (
                  <div className="relative overflow-hidden rounded-xl border border-gray-200">
                    <video
                      src={newVideoPreview!}
                      controls
                      className="w-full"
                      style={{ maxHeight: 220 }}
                    />
                    {isUploading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <LuLoader className="h-6 w-6 animate-spin text-white" />
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setNewVideoPreview(null);
                          if (videoInputRef.current) videoInputRef.current.value = "";
                        }}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {showVideoUpload && (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 text-gray-400 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 disabled:opacity-50"
                  >
                    <LuUpload className="h-5 w-5" />
                    <span className="text-sm font-medium">Click to upload a video</span>
                    <span className="text-xs">MP4, MOV, M4V, WEBM · up to 500 MB</span>
                  </button>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
                  className="hidden"
                  onChange={handleVideoChange}
                />

                {videoRemoved && !newVideoPreview && post.video_url && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Original video removed.{" "}
                    <button
                      onClick={() => setVideoRemoved(false)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Undo
                    </button>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Scheduled time */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Scheduled time</label>
            <p className="mb-2 text-xs text-gray-400">(agent-suggested, editable)</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isUploading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
