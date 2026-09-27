import { Suspense } from "react";
import LeadsGenerateView from "@/components/leads-generate/LeadsGenerateView";

export const metadata = {
  title: "Leads Generate — Creative genie",
};

export default function LeadsGeneratePage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#E9ECF5]" />}>
      <LeadsGenerateView />
    </Suspense>
  );
}
