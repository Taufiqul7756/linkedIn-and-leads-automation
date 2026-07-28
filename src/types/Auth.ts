export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  workspace?: string;
  linkedin_profile?: string;
}
