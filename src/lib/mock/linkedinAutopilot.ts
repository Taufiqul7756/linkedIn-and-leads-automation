export type PostStatus = "Draft" | "Approved" | "Scheduled" | "Published" | "Failed";
export type AgentStatus = "Connected" | "Working" | "NeedsYou";

export const mockAccount = {
  linkedin: {
    name: "Jordan Rivera",
    subtitle: "authorized via OAuth · publish enabled",
    status: "Connected" as const,
  },
  knowledgeBase: {
    url: "creativegenie.io",
    subtitle: "8 facets · brand tone, ICP, value props",
    status: "Ready" as const,
  },
};

export const mockStats = [
  { label: "awaiting review", value: "7", note: null },
  { label: "approved", value: "12", note: "next to schedule" },
  { label: "scheduled", value: "9", note: "next in 2h 40m" },
  { label: "published", value: "48", note: "+7 this week", noteColor: "green" },
  { label: "avg. engagement", value: "5.8%", note: "+1.2% vs last mo.", noteColor: "green" },
];

export type DraftPost = {
  id: number;
  author: { name: string; title: string; followers: string; initials: string };
  status: "Draft";
  content: string;
  boldWords: string[];
  italicWords: string[];
  hashtags: string[];
  imagePromptReady: boolean;
  readTime: string;
  cta: string;
};

export const mockDraftPosts: DraftPost[] = [
  {
    id: 1,
    author: {
      name: "Jordan Rivera",
      title: "Founder & CEO at Creative genie",
      followers: "8,204",
      initials: "JR",
    },
    status: "Draft",
    content:
      "Most sales teams don't have a lead problem. They have a follow-up problem.\n\nWe pulled the numbers across 2,400 outbound sequences: 71% of replies came after the second touch — but 4 in 5 reps never send it.\n\nAutomating the second and third touch isn't spam. It's the difference between a list and a pipeline. Here's how we think about cadence at Creative genie 👇",
    boldWords: ["follow-up"],
    italicWords: ["after"],
    hashtags: ["#B2BSales", "#SalesAutomation", "#Outbound"],
    imagePromptReady: true,
    readTime: "0:38",
    cta: "Book a demo",
  },
  {
    id: 2,
    author: {
      name: "Jordan Rivera",
      title: "Founder & CEO at Creative genie",
      followers: "8,204",
      initials: "JR",
    },
    status: "Draft",
    content:
      "A validated email list beats a big one. Every time.\n\nLast quarter we watched a customer cut their bounce rate from 9.4% to 2.1% just by validating before the first send. Their domain reputation recovered in 11 days — and open rates jumped 22%.\n\nDeliverability isn't a growth hack. It's the foundation everything else sits on. 3 checks we run on every lead before it enters a sequence:",
    boldWords: [],
    italicWords: [],
    hashtags: ["#EmailDeliverability", "#GTM", "#RevOps"],
    imagePromptReady: true,
    readTime: "0:31",
    cta: "Try free",
  },
];

export type ManagedPost = {
  id: number;
  excerpt: string;
  tags: string[];
  style: string;
  created: string;
  scheduled: string | null;
  published: string | null;
  status: PostStatus;
  engagement:
    | { type: "metrics"; impressions: string; likes: number; comments: number; rate: string }
    | { type: "queue"; note: string }
    | { type: "text"; note: string };
};

export const mockPosts: ManagedPost[] = [
  {
    id: 1,
    excerpt: "Most sales teams don't have a lead problem — they have a follow-up problem...",
    tags: ["#B2BSales", "#Outbound"],
    style: "Thought leadership",
    created: "Jun 28",
    scheduled: null,
    published: "Jul 1 · 9:15 AM",
    status: "Published",
    engagement: { type: "metrics", impressions: "12.4k", likes: 486, comments: 73, rate: "6.1%" },
  },
  {
    id: 2,
    excerpt: "A validated email list beats a big one. Every time...",
    tags: ["#Deliverability", "#RevOps"],
    style: "Case study",
    created: "Jun 30",
    scheduled: "Jul 1 · 4:00 PM",
    published: null,
    status: "Scheduled",
    engagement: { type: "queue", note: "In queue · 2h 40m" },
  },
  {
    id: 3,
    excerpt: "The 3 metrics we track obsessively as a seed-stage GTM team...",
    tags: ["#Startups", "#GTM"],
    style: "How-to",
    created: "Jun 30",
    scheduled: null,
    published: null,
    status: "Approved",
    engagement: { type: "text", note: "Ready" },
  },
  {
    id: 4,
    excerpt: "Cold outreach is dead? No — lazy outreach is dead. Here's the difference...",
    tags: ["#Sales", "#ColdEmail"],
    style: "Bold take",
    created: "Jul 1",
    scheduled: null,
    published: null,
    status: "Draft",
    engagement: { type: "text", note: "Awaiting review" },
  },
  {
    id: 5,
    excerpt: "We rebuilt our onboarding in 6 weeks. Activation went up 34%...",
    tags: ["#Product", "#SaaS"],
    style: "Product update",
    created: "Jun 27",
    scheduled: "Jun 30 · 10:00 AM",
    published: null,
    status: "Failed",
    engagement: { type: "text", note: "Token expired · retry queued" },
  },
  {
    id: 6,
    excerpt: "Hiring your first SDR? Read this before you write the job post...",
    tags: ["#Hiring", "#SalesTeam"],
    style: "Storytelling",
    created: "Jun 24",
    scheduled: null,
    published: "Jun 25 · 7:45 AM",
    status: "Published",
    engagement: { type: "metrics", impressions: "8.9k", likes: 301, comments: 44, rate: "5.3%" },
  },
];

export type Agent = {
  id: string;
  name: string;
  subtitle: string;
  status: AgentStatus;
  description: string;
  detail: string;
  iconType: "link" | "globe" | "sparkle" | "check-square" | "calendar" | "send" | "chart";
  color: "blue" | "purple" | "amber" | "green" | "pink";
};

export const mockAgents: Agent[] = [
  {
    id: "connector",
    name: "Connector Agent",
    subtitle: "LinkedIn OAuth & tokens",
    status: "Connected",
    description: "Token valid · publish scope granted",
    detail: "Jordan Rivera · 1 account",
    iconType: "link",
    color: "blue",
  },
  {
    id: "knowledge",
    name: "Knowledge Agent",
    subtitle: "Crawls site · builds KB",
    status: "Working",
    description: "Indexed creativegenie.io · 8 facets extracted",
    detail: "tone · ICP · value props",
    iconType: "globe",
    color: "purple",
  },
  {
    id: "generator",
    name: "Generator Agent",
    subtitle: "Drafts posts from KB",
    status: "Working",
    description: "Writing 5 posts · hashtags + CTA + image prompt",
    detail: "7 drafts ready",
    iconType: "sparkle",
    color: "blue",
  },
  {
    id: "review",
    name: "Review Gate",
    subtitle: "Human approval required",
    status: "NeedsYou",
    description: "2 posts awaiting approval before scheduling",
    detail: "12 approved this week",
    iconType: "check-square",
    color: "amber",
  },
  {
    id: "scheduler",
    name: "Scheduler Agent",
    subtitle: "Queue & timezone",
    status: "Working",
    description: "9 posts queued · next in 2h 40m (EST)",
    detail: "optimal-time slotting on",
    iconType: "calendar",
    color: "blue",
  },
  {
    id: "publisher",
    name: "Publisher Agent",
    subtitle: "Auto-publish · retry · log",
    status: "Working",
    description: "Posting at scheduled time · 1 retry logged",
    detail: "48 published · 1 failed",
    iconType: "send",
    color: "green",
  },
  {
    id: "analytics",
    name: "Analytics Agent",
    subtitle: "Pulls post metrics",
    status: "Working",
    description: "Syncing impressions, reactions & engagement",
    detail: "5.8% avg engagement",
    iconType: "chart",
    color: "pink",
  },
];
