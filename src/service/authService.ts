import axios from "axios";
import { get, post } from "@/lib/api";
import { AuthUser, LoginResponse } from "@/types/Auth";
import { Config } from "@/config/config";

// Dedicated axios instance for auth — throws on error so callers get real error messages
const authApi = axios.create({
  baseURL: Config.API_URL,
});

export const authService = () => ({
  getMe: () => get<AuthUser>("/auth/me/"),
  login: async (data: { email: string; password: string }): Promise<LoginResponse> => {
    const response = await authApi.post<LoginResponse>("/auth/login/", data);
    return response.data;
  },
  register: async (data: {
    email: string;
    username: string;
    password: string;
    linkedin_profile_url?: string;
  }): Promise<LoginResponse> => {
    const response = await authApi.post<LoginResponse>("/auth/register/", data);
    return response.data;
  },
  logout: () => post("/auth/logout/"),
  refresh: () => post("/auth/refresh/"),
});
