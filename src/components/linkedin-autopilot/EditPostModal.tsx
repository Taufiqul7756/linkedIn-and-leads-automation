"use client";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LuX, LuUpload, LuLoader, LuImage, LuVideo } from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { postsService } from "@/service/postsService";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { PostType } from "@/types/Post";

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostType | null;
  accountName?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function EditPostModal({ isOpen, onClose, post, accountName }: EditPostModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [content, setContent] = useState(post?.body ?? "");
  const [hashtags, setHashtags] = useState(() => {
    const raw = post?.hashtags;
    if (!raw) return "";
    if (Array.isArray(raw)) return raw.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
    return raw;
  });
  const [mediaTab, setMediaTab] = useState<"image" | "video">(
    post?.media_type === "video" ? "video" : "image"
  );
  const [imageRemoved, setImageRemoved] = useState(false);
  const [videoRemoved, setVideoRemoved] = useState(false);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const saveMutation = useMutationWithTokenRefresh(
    (id: string) => {
      const hashtagsArray = hashtags
        .split(/[\s,]+/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
      const data: { body: string; hashtags: string[]; image_url?: string; video_url?: string } = {
        body: content,
        hashtags: hashtagsArray,
      };
      if (imageRemoved) data.image_url = "";
      if (videoRemoved) data.video_url = "";
      return postsService(workspaceId).patchPost(id, data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        toast.success("Post saved.");
        onClose();
      },
      onError: (error: unknown) => toast.error(extractErrorMessage(error)),
    }
  );

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

  const handleRemoveNew = () => {
    setNewImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveNewVideo = () => {
    setNewVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  if (!post) return null;

  const displayName = accountName ?? "LinkedIn User";
  const showExistingImage = !!post.image_url && !imageRemoved && !newImagePreview;
  const showNewPreview = !!newImagePreview;
  const showUploadArea = (imageRemoved || !post.image_url) && !newImagePreview;
  const showExistingVideo = !!post.video_url && !videoRemoved && !newVideoPreview;
  const showNewVideoPreview = !!newVideoPreview;
  const showVideoUploadArea = (videoRemoved || !post.video_url) && !newVideoPreview;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Post" width="2xl">
      <div className="space-y-4">
        {/* Author info */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
            {getInitials(displayName)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-400">Draft preview</p>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Post content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{content.length} chars</p>
        </div>

        {/* Media section */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Media</p>

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

              {showNewPreview && (
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
                      onClick={handleRemoveNew}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <LuX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {showUploadArea && (
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
                      onClick={handleRemoveNewVideo}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <LuX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {showVideoUploadArea && (
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

        {/* Hashtags */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Hashtags
          </label>
          <input
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#B2BSales #SalesAutomation"
            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">Separate hashtags with a space</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button
          onClick={onClose}
          disabled={saveMutation.isPending}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => saveMutation.mutate(post.id)}
          disabled={content.trim() === "" || saveMutation.isPending || isUploading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
