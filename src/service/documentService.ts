import { get, post, del } from "@/lib/api";
import { DocumentType, PaginatedDocuments } from "@/types/Document";

export const documentService = (workspaceId: string) => ({
  getDocuments: (purpose?: string) => {
    const q = purpose ? `?purpose=${purpose}` : "";
    return get<PaginatedDocuments>(`/workspaces/${workspaceId}/documents/${q}`);
  },
  uploadDocument: (file: File, purpose: "knowledge" | "tone" | "style") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", purpose);
    return post<DocumentType>(`/workspaces/${workspaceId}/documents/`, formData);
  },
  deleteDocument: (id: string) => del<void>(`/workspaces/${workspaceId}/documents/${id}/`),
});
