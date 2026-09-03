import axios from "axios";
import { del } from "@/lib/api";
import type {
  Attachment,
  Conversation,
  PaginatedConversations,
  AgentSettings,
  PaginatedAgentPosts,
} from "@/types/LinkedInAgent";
import { Config } from "@/config/config";

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

export const linkedinAgentService = (workspaceId: string) => ({
  createConversation: () =>
    axiosPost<Conversation>(`/workspaces/${workspaceId}/agent/conversations/`),

  getConversations: (page = 1, pageSize = 25) =>
    axiosGet<PaginatedConversations>(
      `/workspaces/${workspaceId}/agent/conversations/?page=${page}&page_size=${pageSize}`
    ),

  getConversation: (id: string) =>
    axiosGet<Conversation>(`/workspaces/${workspaceId}/agent/conversations/${id}/`),

  sendMessage: (id: string, text: string) =>
    axiosPost<{ run_id: string }>(
      `/workspaces/${workspaceId}/agent/conversations/${id}/messages/`,
      { text }
    ),

  answerQuestion: (id: string, interruptId: string, answers: Record<string, string | string[]>) =>
    axiosPost<{ run_id: string }>(`/workspaces/${workspaceId}/agent/conversations/${id}/answer/`, {
      interrupt_id: interruptId,
      answers,
    }),

  cancelConversation: (id: string) =>
    axiosPost<Conversation>(`/workspaces/${workspaceId}/agent/conversations/${id}/cancel/`),

  uploadAttachment: (convId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return axios
      .post<Attachment>(
        `${Config.API_URL}/workspaces/${workspaceId}/agent/conversations/${convId}/attachments/`,
        form,
        { headers: getAuthHeaders() }
      )
      .then((r) => r.data);
  },

  addAttachmentUrl: (convId: string, url: string) =>
    axiosPost<Attachment>(`/workspaces/${workspaceId}/agent/conversations/${convId}/attachments/`, {
      url,
    }),

  getAttachments: (convId: string) =>
    axiosGet<Attachment[]>(`/workspaces/${workspaceId}/agent/conversations/${convId}/attachments/`),

  deleteAttachment: (convId: string, aid: string) =>
    axios.delete(
      `${Config.API_URL}/workspaces/${workspaceId}/agent/conversations/${convId}/attachments/${aid}/`,
      { headers: getAuthHeaders() }
    ),

  deleteConversation: (id: string) =>
    del<void>(`/workspaces/${workspaceId}/agent/conversations/${id}/`),

  getSettings: () => axiosGet<AgentSettings>(`/workspaces/${workspaceId}/agent/settings/`),

  patchSettings: (data: Partial<AgentSettings>) =>
    axiosPatch<AgentSettings>(`/workspaces/${workspaceId}/agent/settings/`, data),

  getAgentPosts: (params?: {
    status?: string;
    excludeStatus?: string;
    page?: number;
    pageSize?: number;
    conversationId?: string;
  }) => {
    const q = new URLSearchParams({ state: "agent" });
    if (params?.status) q.set("status", params.status);
    if (params?.excludeStatus) q.set("exclude_status", params.excludeStatus);
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("page_size", String(params.pageSize));
    if (params?.conversationId) q.set("conversation", params.conversationId);
    return axiosGet<PaginatedAgentPosts>(
      `/workspaces/${workspaceId}/content/posts/?${q.toString()}`
    );
  },
});
