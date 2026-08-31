import { Suspense } from "react";
import LeadsGenerateView from "@/components/leads-generate/LeadsGenerateView";

export const metadata = {
  title: "Leads Generate — Relay",
};

export default function LeadsGeneratePage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#E9ECF5]" />}>
      <LeadsGenerateView />
    </Suspense>
  );
}
