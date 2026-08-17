import AccountConnectionSection from "@/components/leads/AccountConnectionSection";
import SourceLeadsSection from "@/components/leads/SourceLeadsSection";
import PipelineSection from "@/components/leads/PipelineSection";
import LeadsTableSection from "@/components/leads/LeadsTableSection";
import AgenticSwarmSection from "@/components/leads/AgenticSwarmSection";

export const metadata = {
  title: "Leads Outreach — Relay",
};

export default function LeadsOutreachPage() {
  return (
    <div className="flex-1 space-y-4 bg-[#E9ECF5] px-4 py-4">
      <AccountConnectionSection />
      <SourceLeadsSection />
      <PipelineSection />
      <LeadsTableSection />
      <AgenticSwarmSection />
    </div>
  );
}
