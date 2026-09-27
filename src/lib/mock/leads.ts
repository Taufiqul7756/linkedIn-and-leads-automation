// ── Types ─────────────────────────────────────────────────────────────────────

export type LeadStatus = "Valid" | "Invalid" | "Risky";

export type OutreachStatus =
  "Replied" | "Email sent" | "WhatsApp sent" | "LinkedIn sent" | "Not contacted";

export interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  outreach: OutreachStatus;
  lastActivity: string;
  avatarColor: "violet" | "blue" | "green" | "amber" | "pink" | "teal";
}

export type StageType = "stage" | "gate";
export type StageStatus = "complete" | "signed-off" | "comments-actioned" | "in-progress";

export interface PipelineStage {
  id: number;
  type: StageType;
  stageNumber?: number;
  label: string;
  status: StageStatus;
  statusLabel: string;
  statusDetail?: string;
  isActive?: boolean;
}

export interface SalesforceItem {
  id: number;
  label: string;
  detail: string;
  status: "done" | "in-progress";
}

export type SwarmAgentStatus = "Working" | "Waiting";

export interface SwarmAgent {
  id: number;
  name: string;
  subtitle: string;
  status: SwarmAgentStatus;
  task: string;
  stat: string;
  iconType: "search" | "shield" | "sparkle" | "pencil" | "whatsapp" | "mail" | "linkedin" | "chart";
  color: "blue" | "green" | "purple" | "pink" | "teal" | "amber" | "indigo" | "rose";
}

// ── Mock leads ────────────────────────────────────────────────────────────────

export const mockLeads: Lead[] = [
  {
    id: 1,
    name: "Marcus Chen",
    company: "Northwave Inc.",
    email: "m.chen@northwave.inc",
    phone: "+1 (415) 555-3182",
    status: "Valid",
    outreach: "Replied",
    lastActivity: "2m ago",
    avatarColor: "violet",
  },
  {
    id: 2,
    name: "Sofia Reyes",
    company: "Brightpath Co.",
    email: "sofia@brightpath.co",
    phone: "+1 (332) 555-8147",
    status: "Valid",
    outreach: "Email sent",
    lastActivity: "9m ago",
    avatarColor: "blue",
  },
  {
    id: 3,
    name: "David Okafor",
    company: "Ironlead Capital",
    email: "d.okafor@ironlead.com",
    phone: "+1 (28) 7946-9958",
    status: "Valid",
    outreach: "WhatsApp sent",
    lastActivity: "1h ago",
    avatarColor: "green",
  },
  {
    id: 4,
    name: "Priya Nair",
    company: "Vertx Analytics",
    email: "priya.nair@vertx.io",
    phone: "+1 (503) 555-1237",
    status: "Risky",
    outreach: "LinkedIn sent",
    lastActivity: "1h ago",
    avatarColor: "amber",
  },
  {
    id: 5,
    name: "Tom Bauer",
    company: "Stord Logistics",
    email: "t.bauer@stord.com",
    phone: "+49 40 113 456",
    status: "Invalid",
    outreach: "Not contacted",
    lastActivity: "3h ago",
    avatarColor: "pink",
  },
  {
    id: 6,
    name: "Aisha Khan",
    company: "Pulseflow.io",
    email: "aisha@pulseflow.io",
    phone: "+1 (386) 555-9878",
    status: "Valid",
    outreach: "Email sent",
    lastActivity: "4m ago",
    avatarColor: "teal",
  },
  {
    id: 7,
    name: "Liam Walsh",
    company: "Creative genie",
    email: "liam.walsh@creativegenie.io",
    phone: "+353 1 437 2906",
    status: "Valid",
    outreach: "Replied",
    lastActivity: "12m ago",
    avatarColor: "violet",
  },
  {
    id: 8,
    name: "Yuki Tanaka",
    company: "Kanahara Corp.",
    email: "y.tanaka@kanahara.jp",
    phone: "+81 3 1234 5678",
    status: "Valid",
    outreach: "WhatsApp sent",
    lastActivity: "20m ago",
    avatarColor: "blue",
  },
];

// ── Pipeline stages ───────────────────────────────────────────────────────────

export const mockPipelineStages: PipelineStage[] = [
  {
    id: 1,
    type: "stage",
    stageNumber: 1,
    label: "ICP Build",
    status: "complete",
    statusLabel: "Complete",
  },
  {
    id: 2,
    type: "gate",
    label: "Client Sign-off",
    status: "signed-off",
    statusLabel: "Signed off",
    statusDetail: "Jun 28, 14:32",
  },
  {
    id: 3,
    type: "stage",
    stageNumber: 2,
    label: "Data Build",
    status: "complete",
    statusLabel: "Complete",
  },
  {
    id: 4,
    type: "gate",
    label: "Client Review",
    status: "comments-actioned",
    statusLabel: "Comments actioned",
    statusDetail: "6 of 7 resolved",
  },
  {
    id: 5,
    type: "stage",
    stageNumber: 3,
    label: "Agentic Approach",
    status: "complete",
    statusLabel: "Complete",
  },
  {
    id: 6,
    type: "stage",
    stageNumber: 4,
    label: "Review & Load",
    status: "in-progress",
    statusLabel: "In progress",
    isActive: true,
  },
];

export const mockSalesforceItems: SalesforceItem[] = [
  { id: 1, label: "Accounts loaded", detail: "1,204 accounts", status: "done" },
  { id: 2, label: "Contacts loaded", detail: "912 of 2,481", status: "in-progress" },
  { id: 3, label: "Errors fixed", detail: "2 errors fixed", status: "done" },
];

// ── Leads stats ───────────────────────────────────────────────────────────────

export const mockLeadStats = [
  { label: "Total Leads", value: "2,481", note: "+184 this week", noteColor: "green" as const },
  { label: "Validated", value: "1,936", note: "78% of total", noteColor: "gray" as const },
  { label: "Contacted", value: "1,204", note: "62% of validated", noteColor: "gray" as const },
  { label: "Replies", value: "312", note: "25.9% reply rate", noteColor: "green" as const },
  { label: "Bounce Rate", value: "2.4%", note: "-0.3% vs last batch", noteColor: "green" as const },
];

// ── Agentic swarm ─────────────────────────────────────────────────────────────

export const mockSwarmAgents: SwarmAgent[] = [
  {
    id: 1,
    name: "Prospector",
    subtitle: "Sources & dedupes leads",
    status: "Working",
    task: "Pulling 184 new prospects from Apollo",
    stat: "2,481 sourced",
    iconType: "search",
    color: "blue",
  },
  {
    id: 2,
    name: "Validator",
    subtitle: "Verifies deliverability",
    status: "Working",
    task: "Checking 62 emails · 3 flagged risky",
    stat: "1,936 valid",
    iconType: "shield",
    color: "green",
  },
  {
    id: 3,
    name: "Enricher",
    subtitle: "Claude context builder",
    status: "Working",
    task: "Enriching Vela Robotics · role + firmographics",
    stat: "1,936 enriched",
    iconType: "sparkle",
    color: "purple",
  },
  {
    id: 4,
    name: "Copywriter",
    subtitle: "Drafts personalized copy",
    status: "Working",
    task: "Writing 5 WhatsApp openers + 2 posts",
    stat: "840 variants",
    iconType: "pencil",
    color: "pink",
  },
  {
    id: 5,
    name: "WhatsApp Agent",
    subtitle: "First-touch channel",
    status: "Working",
    task: "Sending to 184 · 30-min timers armed",
    stat: "612 sent today",
    iconType: "whatsapp",
    color: "green",
  },
  {
    id: 6,
    name: "Email Agent",
    subtitle: "Follow-up channel",
    status: "Waiting",
    task: "Holding for follow-up window · 2h 40m",
    stat: "248 queued",
    iconType: "mail",
    color: "blue",
  },
  {
    id: 7,
    name: "LinkedIn Agent",
    subtitle: "Autopilot posting",
    status: "Working",
    task: "Scheduling 9 posts · 2 awaiting approval",
    stat: "48 published",
    iconType: "linkedin",
    color: "indigo",
  },
  {
    id: 8,
    name: "Analyst",
    subtitle: "Tracks & attributes replies",
    status: "Working",
    task: "Watching 312 threads · 81 replies parsed",
    stat: "25.9% reply rate",
    iconType: "chart",
    color: "rose",
  },
];
