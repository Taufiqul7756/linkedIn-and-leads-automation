import { get } from "@/lib/api";
import { AIModel } from "@/types/AIModel";

export const aiModelService = () => ({
  getModels: () => get<AIModel[]>("/ai-models/"),
});
