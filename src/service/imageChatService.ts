import axios from "axios";
import { Config } from "@/config/config";
import type { ImageChat } from "@/types/ImageChat";

function getAuthHeaders(): Record<string, string> {
  const stored = typeof window !== "undefined" ? localStorage.getItem("auth") : null;
  const token = stored ? (JSON.parse(stored) as { token?: string }).token : null;
  return token ? { Authorization: `Token ${token}` } : {};
}

async function axiosPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await axios.post<T>(`${Config.API_URL}${path}`, data, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

async function axiosGet<T>(path: string): Promise<T> {
  const res = await axios.get<T>(`${Config.API_URL}${path}`, { headers: getAuthHeaders() });
  return res.data;
}

export const imageChatService = (workspaceId: string) => ({
  // POST image-chats/ {"post": id} — 201 new, 200 existing
  openChat: (postId: string) =>
    axiosPost<ImageChat>(`/workspaces/${workspaceId}/image-chats/`, { post: postId }),

  // GET image-chats/{id}/ — poll while status === "running"
  getChat: (chatId: string) =>
    axiosGet<ImageChat>(`/workspaces/${workspaceId}/image-chats/${chatId}/`),

  // POST image-chats/{id}/messages/ {"prompt": "…"} — 202 generating, 200 text-only
  sendMessage: (chatId: string, prompt: string) =>
    axiosPost<ImageChat>(`/workspaces/${workspaceId}/image-chats/${chatId}/messages/`, { prompt }),

  // POST image-chats/{id}/add_to_post/ {"image": imageId}
  addToPost: (chatId: string, imageId: string) =>
    axiosPost<ImageChat>(`/workspaces/${workspaceId}/image-chats/${chatId}/add_to_post/`, {
      image: imageId,
    }),
});
