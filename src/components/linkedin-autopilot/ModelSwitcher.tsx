"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCpu, LuChevronDown } from "react-icons/lu";
import { cn } from "@/utils/cn";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { aiModelService } from "@/service/aiModelService";

type Provider = "gemini" | "anthropic";

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
};

const PROVIDER_COLORS: Record<Provider, string> = {
  gemini: "bg-blue-100 text-blue-700",
  anthropic: "bg-orange-100 text-orange-700",
};

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

/** Dropdown that lets the user pick an AI model, grouped by provider. */
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

  // Derive active provider from the selected model — no state needed
  const activeProvider: Provider = (selected?.provider as Provider) ?? "gemini";

  // Derive available providers from the model list
  const providers = [...new Set(models.map((m) => m.provider as Provider))].filter(
    (p) => p === "gemini" || p === "anthropic"
  );

  const handleProviderSwitch = (p: Provider) => {
    const providerModels = models.filter((m) => m.provider === p);
    const def = providerModels.find((m) => m.is_default) ?? providerModels[0];
    if (def) queryClient.setQueryData(["selected-model"], def.model_id);
  };

  const filteredModels = models.filter((m) => m.provider === activeProvider);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
      >
        <LuCpu className="h-3.5 w-3.5 text-gray-400" />
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            PROVIDER_COLORS[(selected.provider as Provider) ?? "gemini"]
          )}
        >
          {PROVIDER_LABELS[(selected.provider as Provider) ?? "gemini"]}
        </span>
        <span className="font-medium text-gray-700">{selected.label}</span>
        <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-20 min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
        >
          {/* Provider tabs */}
          <div className="flex border-b border-gray-100">
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => handleProviderSwitch(p)}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold transition-colors",
                  activeProvider === p
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Models for active provider */}
          {filteredModels.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">No models available</p>
          ) : (
            filteredModels.map((model) => {
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
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                      isSelected ? "border-blue-500" : "border-gray-300"
                    )}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                  </div>

                  <p
                    className={cn(
                      "flex-1 text-sm font-medium",
                      isSelected ? "text-blue-700" : "text-gray-700"
                    )}
                  >
                    {model.label}
                  </p>

                  {model.is_default && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      Default
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
