export interface WorkspaceType {
  id: string;
  name: string;
  type: "corporate" | "personal";
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}
