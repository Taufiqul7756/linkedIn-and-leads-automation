"use client";

import Link from "next/link";

const STATS: { label: string; value: string | number; sub?: string }[] = [
  { label: "Drafts", value: 0 },
  { label: "Approved", value: 0 },
  { label: "Scheduled", value: 0 },
  { label: "Published", value: 0, sub: "+0 this week" },
  { label: "Failed", value: 0 },
  { label: "Published this week", value: 0 },
  { label: "Next scheduled", value: "—" },
  { label: "Avg. engagement", value: "—" },
];

const TABLE_COLS = ["Post", "Type", "Status", "Scheduled", "Est. Eng."];

export default function PostManagementView() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      {/* Page header */}
      <div className="border-b border-gray-100 px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Post management</h1>
        <p className="mt-1 text-sm text-gray-500">Approvals and the full post pipeline.</p>
      </div>

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
              {sub && <p className="mt-1 text-xs font-medium text-green-600">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Review & Approval */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Review &amp; Approval</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              0 awaiting
            </span>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              No drafts awaiting approval. Generate posts in{" "}
              <Link
                href="/linkedin/automation"
                className="font-semibold text-blue-600 hover:underline"
              >
                LinkedIn Automation
              </Link>{" "}
              — approved posts land in the table below.
            </p>
          </div>
        </div>

        {/* Post Management table */}
        <div>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-gray-900">Post Management table</h2>
            <span className="text-sm text-gray-400">
              Every post and where it is in the pipeline
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {TABLE_COLS.map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={TABLE_COLS.length}
                    className="py-12 text-center text-sm text-gray-400"
                  >
                    No posts yet — approve drafts and they&apos;ll queue here as Scheduled.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
