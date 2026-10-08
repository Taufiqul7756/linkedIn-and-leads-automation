"use client";

import { useEffect, useRef, useState } from "react";
import { LuCheck, LuInfo, LuLoader } from "react-icons/lu";
import { cn } from "@/utils/cn";
import HoverGuide from "@/components/ui/HoverGuide";
import { useAgentSettings } from "@/hooks/useAgentSettings";
import type { AgentSettings } from "@/types/LinkedInAgent";

// post_length values the backend expects — "" lets the agent decide
const POST_LENGTH_OPTIONS = [
  { label: "Short", value: "100 words" },
  { label: "Medium", value: "200 words" },
  { label: "Long", value: "300 words" },
  { label: "Let agent decide", value: "" },
];

const isPresetLength = (value: string) => POST_LENGTH_OPTIONS.some((o) => o.value === value);

const AUTOSAVE_DELAY_MS = 600;

type SaveFn = (patch: Partial<AgentSettings>) => Promise<boolean>;
type TextField = "target_audience" | "post_length";
type SaveStatus = "idle" | "saving" | "saved";

// Debounced autosave for one text setting — flushes on blur, Enter, and unmount (modal close)
function useAutosaveText(field: TextField, initial: string, savedValue: string, onSave: SaveFn) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last value sent (or loaded) — skips PATCHes that would change nothing
  const lastSavedRef = useRef(savedValue);
  const pendingRef = useRef<string | null>(null);

  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
  };

  const flush = () => {
    const next = pendingRef.current;
    cancel();
    if (next === null || next === lastSavedRef.current) return;
    const previous = lastSavedRef.current;
    lastSavedRef.current = next;
    setStatus("saving");
    onSave({ [field]: next }).then((ok) => {
      // Failed → allow the same value to be retried
      if (!ok) lastSavedRef.current = previous;
      setStatus(ok ? "saved" : "idle");
    });
  };

  const change = (next: string) => {
    setValue(next);
    pendingRef.current = next.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  // Value saved from elsewhere (e.g. a preset pill) — clear the box without sending a PATCH
  const reset = (saved: string) => {
    cancel();
    lastSavedRef.current = saved;
    setValue("");
    setStatus("idle");
  };

  // Closing the modal mid-typing still saves the last value
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const next = pendingRef.current;
      if (next !== null && next !== lastSavedRef.current) onSave({ [field]: next });
    },
    [onSave, field]
  );

  return { value, status, change, flush, reset };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <LuLoader className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <LuCheck className="h-3 w-3" />
        Saved
      </span>
    );
  return null;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-60";

interface Props {
  workspaceId: string;
}

export default function AudienceLengthSection({ workspaceId }: Props) {
  const { settings, settingsLoaded, saveSettings } = useAgentSettings(workspaceId);

  // Remount once settings arrive so the inputs start from the saved values
  return (
    <AudienceLengthCard
      key={settingsLoaded ? "loaded" : "loading"}
      disabled={!settingsLoaded}
      savedAudience={settings.target_audience ?? ""}
      postLength={settings.post_length ?? ""}
      useAudience={settings.use_target_audience}
      usePostLength={settings.use_post_length}
      onSave={saveSettings}
    />
  );
}

interface CardProps {
  disabled: boolean;
  savedAudience: string;
  postLength: string;
  useAudience: boolean;
  usePostLength: boolean;
  // Stable (useCallback in useAgentSettings)
  onSave: SaveFn;
}

function AudienceLengthCard({
  disabled,
  savedAudience,
  postLength,
  useAudience,
  usePostLength,
  onSave,
}: CardProps) {
  const audience = useAutosaveText("target_audience", savedAudience, savedAudience, onSave);
  // Custom length box shows only a non-preset value — presets are shown by the pills
  const customLength = useAutosaveText(
    "post_length",
    isPresetLength(postLength) ? "" : postLength,
    postLength,
    onSave
  );

  // Frontend-only mapping: the selected pill is derived from the saved post_length string.
  // While a custom value is being typed, no pill is highlighted.
  const activeLength =
    customLength.value.trim() !== ""
      ? undefined
      : POST_LENGTH_OPTIONS.find((o) => o.value === postLength)?.value;

  const handlePresetClick = (value: string) => {
    if (activeLength === value) return;
    customLength.reset(value);
    onSave({ post_length: value });
  };

  return (
    <div className="mb-6 rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl bg-sidebar-bg px-4 py-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white">Audience & Length</p>
          <HoverGuide onDark>
            <span className="block font-semibold">What is Audience & Length?</span>
            <span className="mt-1.5 block">
              Tell the agent who you&apos;re writing for and how long your posts should be.
            </span>
          </HoverGuide>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Target audience */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="kb-target-audience" className="text-sm font-medium text-gray-800">
              Target audience
            </label>
            <SaveIndicator status={audience.status} />
          </div>
          <input
            id="kb-target-audience"
            type="text"
            placeholder="e.g. Startup founders and CTOs in SaaS"
            value={audience.value}
            disabled={disabled}
            onChange={(e) => audience.change(e.target.value)}
            onBlur={audience.flush}
            onKeyDown={(e) => e.key === "Enter" && audience.flush()}
            className={INPUT_CLASS}
          />
          {!useAudience && (
            <p className="mt-1.5 text-xs text-gray-400">
              Off — turn on &quot;Use target audience&quot; in composer settings.
            </p>
          )}
        </div>

        {/* Post length */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-800">Post length</p>
            <SaveIndicator status={customLength.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {POST_LENGTH_OPTIONS.map((o) => {
              const isActive = activeLength === o.value;
              return (
                <button
                  key={o.label}
                  onClick={() => handlePresetClick(o.value)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                    isActive
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {isActive && <LuCheck className="h-3.5 w-3.5" />}
                  {o.label}
                  {o.value && <span className="text-xs text-gray-400">~{o.value}</span>}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            aria-label="Custom post length"
            placeholder="Or write your own — e.g. 150 words"
            value={customLength.value}
            disabled={disabled}
            onChange={(e) => customLength.change(e.target.value)}
            onBlur={customLength.flush}
            onKeyDown={(e) => e.key === "Enter" && customLength.flush()}
            className={cn(INPUT_CLASS, "mt-2")}
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-blue-600">
            <LuInfo className="mt-px h-3.5 w-3.5 shrink-0" />
            Tip: LinkedIn allows up to 3,000 characters per post (about 450–550 words), so keep your
            length within that.
          </p>
          {!usePostLength && (
            <p className="mt-1.5 text-xs text-gray-400">
              Off — turn on &quot;Use post length&quot; in composer settings.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
