"use client";

import { LuBook } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";

const MOCK_ACCOUNT = {
  name: "Taufiqul Islam",
  authMethod: "OAuth",
  publishEnabled: true,
  connected: true,
};

const MOCK_KNOWLEDGE = {
  sourceCount: 4,
};

export default function AccountsView() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      {/* Page header */}
      <div className="border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Accounts &amp; knowledge</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect LinkedIn and manage what the agent knows about your brand.
        </p>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* LinkedIn Account card */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <FaLinkedinIn className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">LinkedIn account</span>
                {MOCK_ACCOUNT.connected && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {MOCK_ACCOUNT.name} &middot; authorized via {MOCK_ACCOUNT.authMethod} &middot;{" "}
                {MOCK_ACCOUNT.publishEnabled ? "publish enabled" : "publish disabled"}
              </p>
            </div>
            <button className="shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              Manage
            </button>
          </div>

          {/* Knowledge base card */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100">
              <LuBook className="h-6 w-6 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">Knowledge base</span>
                <span className="flex items-center gap-1 text-sm">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="font-medium text-green-600">
                    {MOCK_KNOWLEDGE.sourceCount} sources
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                Websites, profiles &amp; documents the agent writes from
              </p>
            </div>
            <button className="shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              Manage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
