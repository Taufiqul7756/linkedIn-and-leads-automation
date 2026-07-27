"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCpu, LuChevronDown } from "react-icons/lu";
import { cn } from "@/utils/cn";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { aiModelService } from "@/service/aiModelService";

/** Read the currently selected model_id from any component. */
export function useSelectedModel(): string | null {
  const { data } = useQuery<string | null>({
    queryKey: ["selected-model"],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  return data ?? null;
}

/** Dropdown that lets the user pick an AI model. Stores choice in React Query cache. */
export default function ModelSwitcher({ dropUp = false }: { dropUp?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: models } = useQueryWithTokenRefresh(["ai-models"], () =>
    aiModelService().getModels()
  );

  const selectedModelId = useSelectedModel();

  // Initialise with the default model on first load
  useEffect(() => {
    if (!models?.length) return;
    const current = queryClient.getQueryData<string>(["selected-model"]);
    if (!current) {
      const def = models.find((m) => m.is_default) ?? models[0];
      if (def) queryClient.setQueryData(["selected-model"], def.model_id);
    }
  }, [models, queryClient]);

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!models?.length) return null;

  const selected =
    models.find((m) => m.model_id === selectedModelId) ??
    models.find((m) => m.is_default) ??
    models[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
      >
        <LuCpu className="h-3.5 w-3.5 text-gray-400" />
        <span className="font-medium text-gray-700">{selected.label}</span>
        <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-20 min-w-[210px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
        >
          <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            AI Model
          </p>
          {models.map((model) => {
            const isSelected = model.model_id === (selectedModelId ?? selected.model_id);
            return (
              <button
                key={model.model_id}
                onClick={() => {
                  queryClient.setQueryData(["selected-model"], model.model_id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                  isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                {/* Radio dot */}
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    isSelected ? "border-blue-500" : "border-gray-300"
                  )}
                >
                  {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                </div>

                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-blue-700" : "text-gray-700"
                    )}
                  >
                    {model.label}
                  </p>
                  <p className="text-[10px] capitalize text-gray-400">{model.provider}</p>
                </div>

                {model.is_default && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    Default
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
