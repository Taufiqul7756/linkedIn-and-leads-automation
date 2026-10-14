export type LinkedInConnectResponse = {
  authorize_url: string;
};

export type LinkedInCallbackResponse = {
  id: string;
  member_urn: string;
  name: string;
  scope: string;
  expires_at: string;
  created_at: string;
};

export type LinkedInAccountResponse = {
  connected: boolean;
  id: string;
  member_urn: string;
  name: string;
  /** Profile photo from LinkedIn; empty / null when the member has none */
  picture_url?: string | null;
  scope: string;
  expires_at: string;
  created_at: string;
};
