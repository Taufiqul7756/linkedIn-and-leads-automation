"use client";

import HoverGuide from "@/components/ui/HoverGuide";
import { useImageKnowledgeList, useImageKnowledgeSwitches } from "@/hooks/useImageKnowledge";
import { cn } from "@/utils/cn";
import SourceIcon from "./SourceIcon";
import type { ImageKnowledgeSource, ImageKnowledgeSwitch } from "@/types/ImageChat";

interface Props {
  workspaceId: string;
  onOpenKnowledgeBase: () => void;
}

function SourceStatus({ status }: { status: string }) {
  if (status === "failed")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500">
        Failed
      </span>
    );
  if (status === "pending")
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
        Processing
      </span>
    );
  return null;
}

function SmallSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// Title line: URL (clickable), PDF filename, or the start of the text. Falls back to `name`
// until the full source list has loaded.
function SwitchTitle({
  item,
  source,
}: {
  item: ImageKnowledgeSwitch;
  source?: ImageKnowledgeSource;
}) {
  if (item.kind === "url") {
    const href = source?.url || item.name;
    return (
      <a
        href={/^https?:\/\//i.test(href) ? href : `https://${href}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block truncate text-xs text-gray-700 hover:text-blue-600 hover:underline"
      >
        {href}
      </a>
    );
  }
  const text = item.kind === "pdf" ? source?.filename : source?.text;
  return <p className="truncate text-xs text-gray-700">{text || item.name}</p>;
}

// Image agent settings → one switch per image knowledge source (workspace-wide)
export default function ImageKnowledgeSwitches({ workspaceId, onOpenKnowledgeBase }: Props) {
  const { switches, isLoading, toggle } = useImageKnowledgeSwitches(workspaceId);
  // Full sources — filename / URL / text for the title line
  const { sources } = useImageKnowledgeList(workspaceId);
  const byId = new Map(sources.map((s) => [s.id, s]));
  const onCount = switches.filter((s) => s.enabled).length;

  return (
    <div className="relative py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
          Image knowledge
          <HoverGuide anchor="parent" position="top">
            Brand guide for images. Sources switched on shape every new image — colours, fonts, logo
            rules, style. All off = images as usual.
          </HoverGuide>
        </span>
        <span className="shrink-0 text-xs text-gray-400">
          {switches.length ? `${onCount} of ${switches.length} on` : "None"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : switches.length === 0 ? (
        <p className="text-xs text-gray-500">
          Nothing added yet —{" "}
          <button
            onClick={onOpenKnowledgeBase}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Add in Image knowledge base
          </button>
        </p>
      ) : (
        // More than 5 sources → list scrolls (about 5 rows tall)
        <div className={cn("space-y-1", switches.length > 5 && "max-h-64 overflow-y-auto pr-1")}>
          {switches.map((item) => {
            const source = byId.get(item.id);
            return (
              <div key={item.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                <SourceIcon
                  kind={item.kind === "url" ? "website" : item.kind}
                  url={source?.url}
                  className="h-5 w-5"
                />
                <div
                  className="min-w-0 flex-1"
                  title={item.label ? `${item.name}\nNote: ${item.label}` : item.name}
                >
                  <SwitchTitle item={item} source={source} />
                  {item.label && item.kind !== "text" && (
                    <p className="truncate text-[11px] text-gray-700">
                      <span className="font-semibold">Note:</span> {item.label}
                    </p>
                  )}
                </div>
                <SourceStatus status={item.status} />
                <SmallSwitch checked={item.enabled} onChange={(v) => void toggle(item.id, v)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
