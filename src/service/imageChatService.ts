import axios from "axios";
import { Config } from "@/config/config";
import type {
  ImageChat,
  ImageChatSettings,
  ImageChatSettingsPatch,
  StockRecommendedResponse,
  StockSearchResponse,
} from "@/types/ImageChat";

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

async function axiosPatch<T>(path: string, data?: unknown): Promise<T> {
  const res = await axios.patch<T>(`${Config.API_URL}${path}`, data, {
    headers: getAuthHeaders(),
  });
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

  // GET image-chats/{id}/stock/recommended/ — cached 24h by the backend
  getStockRecommended: (chatId: string) =>
    axiosGet<StockRecommendedResponse>(
      `/workspaces/${workspaceId}/image-chats/${chatId}/stock/recommended/`
    ),

  // GET image-chats/{id}/stock/search/?q=&page= — q must be non-blank, page 1–100
  searchStock: (chatId: string, q: string, page: number) =>
    axiosGet<StockSearchResponse>(
      `/workspaces/${workspaceId}/image-chats/${chatId}/stock/search/?q=${encodeURIComponent(q)}&page=${page}`
    ),

  // GET image-chats/settings/{chatId}/
  getSettings: (chatId: string) =>
    axiosGet<ImageChatSettings>(`/workspaces/${workspaceId}/image-chats/settings/${chatId}/`),

  // PATCH image-chats/settings/{chatId}/ — send only the changed field
  patchSettings: (chatId: string, data: ImageChatSettingsPatch) =>
    axiosPatch<ImageChatSettings>(
      `/workspaces/${workspaceId}/image-chats/settings/${chatId}/`,
      data
    ),
});
