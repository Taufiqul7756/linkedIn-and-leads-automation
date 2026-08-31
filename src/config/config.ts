export const Config = {
  API_URL: process.env.NEXT_PUBLIC_API_URL!,
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL!,
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL!,
  LEADS_API_URL: process.env.NEXT_PUBLIC_LEADS_API_URL!,
} as const;
