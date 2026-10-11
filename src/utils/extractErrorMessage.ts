import { AxiosError } from "axios";

export function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (data?.detail && typeof data.detail === "string") return data.detail;
    if (data?.message && typeof data.message === "string") return data.message;
    if (data?.non_field_errors && Array.isArray(data.non_field_errors)) {
      return (data.non_field_errors as string[])[0];
    }
    // Field errors, e.g. {"image_url": ["This post is already on LinkedIn — …"]}
    const fieldError = data && Object.values(data).find((v) => Array.isArray(v) && v.length > 0);
    if (Array.isArray(fieldError) && typeof fieldError[0] === "string") return fieldError[0];
    return error.message;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
