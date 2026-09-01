"use client";

import { useEffect, useRef, useState } from "react";
import {
  LuPlus,
  LuHistory,
  LuSend,
  LuSettings,
  LuZap,
  LuDatabase,
  LuUpload,
  LuX,
  LuPaperclip,
  LuLink,
} from "react-icons/lu";
import { cn } from "@/utils/cn";
import KnowledgeBaseModal from "./KnowledgeBaseModal";

// ─── prompt suggestions ───────────────────────────────────────────────────────

const PROMPT_SUGGESTIONS = [
  { text: "Give me 5 drafts for LinkedIn", tag: null },
  { text: "Write a launch announcement", tag: null },
  { text: "Draft a hiring post", tag: null },
  {
    text: `5 thought-leadership posts for SaaS, confident & punchy tone, 3 hashtags, spread over 2 weeks — hook: "Cold outreach isn't dead"`,
    tag: "All details included · skips questions",
  },
];

// ─── small shared components ──────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const KNOWLEDGE_SOURCE_COUNT = 4;

export default function AutomationView() {
  const [message, setMessage] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [attachments, setAttachments] = useState<
    { id: string; type: "file" | "url"; name: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // modal
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  // popovers
  const [promptOpen, setPromptOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // settings state
  const [settings, setSettings] = useState({
    useEmoji: false,
    useKnowledgeBase: true,
    useImage: false,
    useHashtags: true,
    defaultPostCount: 5,
  });

  // click-outside refs
  const promptRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!promptOpen) return;
    const h = (e: MouseEvent) => {
      if (promptRef.current && !promptRef.current.contains(e.target as Node)) setPromptOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [promptOpen]);

  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [settingsOpen]);

  const handleSuggestionClick = (text: string) => {
    setMessage(text);
    setPromptOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Page header */}
      <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn Agent</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate post drafts, approve them, and let Relay schedule &amp; publish.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-5">
        {/* Knowledge base pill */}
        <div className="shrink-0">
          <button
            onClick={() => setKnowledgeOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            <LuDatabase className="h-3.5 w-3.5 text-gray-400" />
            Knowledge base
            <span className="text-gray-300">·</span>
            <span className="font-medium text-blue-600">{KNOWLEDGE_SOURCE_COUNT} sources</span>
          </button>
        </div>

        {/* Agent composer card */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200">
          {/* Composer header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <LuPlus className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">Agent composer</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-gray-400 lg:block">
                Everything happens in chat — drafts appear here for approval
              </span>
              <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50">
                <LuHistory className="h-3.5 w-3.5" />
                History
              </button>
              <button className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-100">
                <LuPlus className="h-3.5 w-3.5" />
                New chat
              </button>
            </div>
          </div>

          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <LuPlus className="h-4 w-4 text-white" />
              </div>
              <div className="max-w-xl rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                Tell me what you want and I&apos;ll research your brand, ask a couple of quick
                questions, then draft posts right here for you to approve.
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-gray-100 px-5 py-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Give me 5 LinkedIn drafts about our brand..."
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
            />

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                  >
                    {a.type === "file" ? (
                      <LuPaperclip className="h-3 w-3 shrink-0" />
                    ) : (
                      <LuLink className="h-3 w-3 shrink-0" />
                    )}
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      className="shrink-0 text-blue-400 hover:text-blue-600"
                    >
                      <LuX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              {/* Prompt suggestions */}
              <div ref={promptRef} className="relative">
                <button
                  onClick={() => setPromptOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
                >
                  <LuZap className="h-3.5 w-3.5" />
                  Prompt suggestions
                </button>

                {promptOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                    <div className="divide-y divide-gray-100">
                      {PROMPT_SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(s.text)}
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <p className="text-sm text-gray-800">{s.text}</p>
                          {s.tag && (
                            <span className="mt-1 inline-block text-xs font-medium text-teal-600">
                              {s.tag}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right-side action buttons */}
              <div className="flex items-center gap-2">
                {/* Plus — file / URL attach */}
                <div ref={plusRef} className="relative">
                  <button
                    onClick={() => setPlusOpen((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100"
                  >
                    <LuPlus className="h-4 w-4" />
                  </button>

                  {plusOpen && (
                    <div className="absolute bottom-full right-0 z-20 mb-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-lg">
                      {/* Upload file */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-300 hover:bg-gray-50"
                      >
                        <LuUpload className="h-4 w-4 text-gray-400" />
                        Upload a file
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAttachments((prev) => [
                            ...prev,
                            { id: crypto.randomUUID(), type: "file", name: file.name },
                          ]);
                          e.target.value = "";
                          setPlusOpen(false);
                        }}
                      />
                      {/* URL input */}
                      <div className="mt-2 flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste a URL"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" || !urlInput.trim()) return;
                            setAttachments((prev) => [
                              ...prev,
                              { id: crypto.randomUUID(), type: "url", name: urlInput.trim() },
                            ]);
                            setUrlInput("");
                            setPlusOpen(false);
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                        />
                        <button
                          disabled={!urlInput.trim()}
                          onClick={() => {
                            if (!urlInput.trim()) return;
                            setAttachments((prev) => [
                              ...prev,
                              { id: crypto.randomUUID(), type: "url", name: urlInput.trim() },
                            ]);
                            setUrlInput("");
                            setPlusOpen(false);
                          }}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Settings */}
                <div ref={settingsRef} className="relative">
                  <button
                    onClick={() => setSettingsOpen((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-100"
                  >
                    <LuSettings className="h-4 w-4" />
                  </button>

                  {settingsOpen && (
                    <div className="absolute bottom-full right-0 z-20 mb-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900">
                          Composer settings
                        </span>
                        <button
                          onClick={() => setSettingsOpen(false)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                        >
                          <LuX className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="divide-y divide-gray-100 px-4 pb-4">
                        {/* Use emoji */}
                        <div className="flex items-start justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Use emoji</p>
                            <p className="text-xs text-gray-400">
                              Let the agent sprinkle emoji into drafts
                            </p>
                          </div>
                          <Toggle
                            checked={settings.useEmoji}
                            onChange={(v) => setSettings((s) => ({ ...s, useEmoji: v }))}
                          />
                        </div>

                        {/* Use knowledge base */}
                        <div className="flex items-start justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Use knowledge base</p>
                            <p className="text-xs text-gray-400">
                              Ground drafts in your connected sources
                            </p>
                          </div>
                          <Toggle
                            checked={settings.useKnowledgeBase}
                            onChange={(v) => setSettings((s) => ({ ...s, useKnowledgeBase: v }))}
                          />
                        </div>

                        {/* Use image */}
                        <div className="flex items-start justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Use image</p>
                            <p className="text-xs text-gray-400">Suggest a visual for each draft</p>
                          </div>
                          <Toggle
                            checked={settings.useImage}
                            onChange={(v) => setSettings((s) => ({ ...s, useImage: v }))}
                          />
                        </div>

                        {/* Use hashtags */}
                        <div className="flex items-start justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Use hashtags</p>
                            <p className="text-xs text-gray-400">
                              Include relevant hashtags in every draft
                            </p>
                          </div>
                          <Toggle
                            checked={settings.useHashtags}
                            onChange={(v) => setSettings((s) => ({ ...s, useHashtags: v }))}
                          />
                        </div>

                        {/* Default number of posts */}
                        <div className="flex items-start justify-between gap-3 pt-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              Default number of posts
                            </p>
                            <p className="text-xs text-gray-400">
                              Used when a request doesn&apos;t specify a count
                            </p>
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={settings.defaultPostCount}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                defaultPostCount: Number(e.target.value),
                              }))
                            }
                            className="h-8 w-14 shrink-0 rounded-lg border border-gray-200 text-center text-sm font-medium text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Send */}
                <button
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
                    message.trim() ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600 opacity-60"
                  )}
                >
                  Send
                  <LuSend className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <KnowledgeBaseModal isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
    </div>
  );
}
