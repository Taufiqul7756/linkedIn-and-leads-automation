"use client";

import { useState } from "react";
import { LuPlus, LuHistory, LuSend, LuSettings, LuZap, LuDatabase, LuPencil } from "react-icons/lu";
import { cn } from "@/utils/cn";

const KNOWLEDGE_SOURCE_COUNT = 4;

export default function AutomationView() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      {/* Page header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn Agent</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate post drafts, approve them, and let Relay schedule &amp; publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
            <LuPlus className="h-4 w-4" />
            Post
          </button>
          <button
            disabled
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
          >
            <LuPencil className="h-3.5 w-3.5" />
            Campaign
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
              Soon
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-8 py-5">
        {/* Knowledge base pill */}
        <div>
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50">
            <LuDatabase className="h-3.5 w-3.5 text-gray-400" />
            Knowledge base
            <span className="text-gray-300">·</span>
            <span className="font-medium text-blue-600">{KNOWLEDGE_SOURCE_COUNT} sources</span>
          </button>
        </div>

        {/* Agent composer card */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200">
          {/* Composer header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
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
          <div className="flex-1 px-5 py-6">
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
          <div className="border-t border-gray-100 px-5 py-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Give me 5 LinkedIn drafts about our brand..."
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <button className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50">
                <LuZap className="h-3.5 w-3.5" />
                Prompt suggestions
              </button>
              <div className="flex items-center gap-2">
                <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100">
                  <LuPlus className="h-4 w-4" />
                </button>
                <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100">
                  <LuSettings className="h-4 w-4" />
                </button>
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
    </div>
  );
}
