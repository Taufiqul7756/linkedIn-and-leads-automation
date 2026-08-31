import axios from "axios";
import { Config } from "@/config/config";

// Separate axios instance for the leads backend — no auth headers
const leadsApi = axios.create({
  baseURL: Config.LEADS_API_URL,
  withCredentials: false,
});

export async function leadsGet<T>(url: string, params?: Record<string, string>): Promise<T> {
  const response = await leadsApi.get<T>(url, { params });
  return response.data;
}

export async function leadsPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await leadsApi.post<T>(url, data);
  return response.data;
}

export async function leadsPostForm<T>(url: string, form: FormData): Promise<T> {
  const response = await leadsApi.post<T>(url, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export default leadsApi;
