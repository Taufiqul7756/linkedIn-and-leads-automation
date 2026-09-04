import { get, post, postRaw, patch, del } from "@/lib/api";
import {
  PostStatsType,
  PostType,
  PaginatedPosts,
  GeneratePostsBody,
  GeneratePostsResponse,
  RegeneratePostBody,
  SuggestPromptsBody,
  SuggestPromptsResponse,
} from "@/types/Post";

export const postsService = (workspaceId: string) => ({
  getPostStats: (state?: "agent" | "manual") =>
    get<PostStatsType>(
      `/workspaces/${workspaceId}/content/posts/stats/${state ? `?state=${state}` : ""}`
    ),
  getDraftPosts: (state?: "agent" | "manual", page?: number, pageSize = 10) =>
    get<PaginatedPosts>(
      `/workspaces/${workspaceId}/content/posts/?status=draft${state ? `&state=${state}` : ""}${page && page > 1 ? `&page=${page}` : ""}&page_size=${pageSize}`
    ),
  getAllPosts: (status?: string, page?: number, pageSize = 10, state?: "agent" | "manual") => {
    const q = new URLSearchParams();
    if (status && status !== "all") {
      q.set("status", status);
    } else {
      q.set("exclude_status", "draft");
    }
    if (state) q.set("state", state);
    if (page && page > 1) q.set("page", String(page));
    q.set("page_size", String(pageSize));
    return get<PaginatedPosts>(`/workspaces/${workspaceId}/content/posts/?${q.toString()}`);
  },
  schedulePost: (id: string, scheduled_at: string) =>
    post<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/schedule/`, {
      scheduled_at,
    }),
  getPost: (id: string) => get<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/`),
  patchPost: (
    id: string,
    data:
      | {
          body?: string;
          body_blocks?: object;
          hashtags?: string[];
          image_url?: string;
          video_url?: string;
          suggested_publish_at?: string | null;
        }
      | FormData
  ) => patch<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/`, data),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return post<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/upload_image/`, form);
  },
  uploadVideo: (id: string, file: File) => {
    const form = new FormData();
    form.append("video", file);
    return post<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/upload_video/`, form);
  },
  approvePost: (id: string) =>
    post<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/approve/`),
  rejectPost: (id: string) => del<void>(`/workspaces/${workspaceId}/content/posts/${id}/`),
  generateImage: (id: string, image_prompt: string) =>
    post<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/generate_image/`, {
      image_prompt,
    }),
  regeneratePost: (id: string, body: RegeneratePostBody) =>
    post<PostType>(`/workspaces/${workspaceId}/content/posts/${id}/regenerate/`, body),
  generatePosts: (body: GeneratePostsBody) =>
    postRaw<GeneratePostsResponse>(`/workspaces/${workspaceId}/content/posts/generate/`, body),
  generatePostsFromLink: (body: GeneratePostsBody & { url: string }) =>
    postRaw<GeneratePostsResponse>(
      `/workspaces/${workspaceId}/content/posts/generate_from_link/`,
      body
    ),
  getDraftsByPlan: (planId: string) =>
    get<PaginatedPosts>(`/workspaces/${workspaceId}/content/posts/?plan=${planId}&state=agent`),
  suggestPrompts: (body: SuggestPromptsBody) =>
    post<SuggestPromptsResponse>(`/workspaces/${workspaceId}/content/posts/suggest_prompts/`, body),
});
