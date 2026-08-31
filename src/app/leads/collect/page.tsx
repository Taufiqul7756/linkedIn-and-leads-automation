import { Suspense } from "react";
import LeadsCollectView from "@/components/leads-collect/LeadsCollectView";

export const metadata = {
  title: "Leads Collect — Relay",
};

export default function LeadsCollectPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#E9ECF5]" />}>
      <LeadsCollectView />
    </Suspense>
  );
}
