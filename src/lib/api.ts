import axios from "axios";
import { Config } from "@/config/config";

const AUTH_KEY = "auth";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    return (JSON.parse(stored) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: Config.API_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("auth");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export async function get<T>(url: string): Promise<T | undefined> {
  try {
    const response = await api.get<T>(url);
    return response.data;
  } catch {
    return undefined;
  }
}

export async function post<T>(url: string, data?: unknown): Promise<T | undefined> {
  try {
    const response = await api.post<T>(url, data);
    return response.data;
  } catch {
    return undefined;
  }
}

/** Like `post` but re-throws on error — use when onError handling is needed. */
export async function postRaw<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

export async function patch<T>(url: string, data?: unknown): Promise<T | undefined> {
  try {
    const response = await api.patch<T>(url, data);
    return response.data;
  } catch {
    return undefined;
  }
}

export async function del<T>(url: string): Promise<T | undefined> {
  try {
    const response = await api.delete<T>(url);
    return response.data;
  } catch {
    return undefined;
  }
}
