"use client";
import { useState, useEffect, useRef } from "react";
import {
  LuZap,
  LuLink,
  LuLoader,
  LuCheck,
  LuTriangleAlert,
  LuRefreshCw,
  LuSparkles,
  LuArrowRight,
  LuArrowLeft,
  LuUser,
  LuX,
  LuTrash2,
  LuPencil,
  LuSave,
  LuGlobe,
  LuFileText,
  LuUpload,
  LuPlus,
  LuCalendarDays,
} from "react-icons/lu";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { agentService } from "@/service/agentService";
import { postsService } from "@/service/postsService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { LinkedInProfile, MarketingPlan, ProfileDocument, ProfileWebsite } from "@/types/Agent";
import ModelSwitcher, { useSelectedModel } from "./ModelSwitcher";
import Tooltip from "@/components/ui/Tooltip";

type Phase =
  | "a-loading"
  | "a-submit"
  | "a-polling"
  | "a-ready"
  | "a-error"
  | "b-brief"
  | "b-generating"
  | "b-select"
  | "b-headlines"
  | "c-generating"
  | "c-polling"
  | "c-done";

const COMMON_TIMEZONES = [
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Buenos_Aires",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Baku",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Kiev",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Honolulu",
  "UTC",
];

function StepBar({ current }: { current: "a" | "b" | "c" | "d" }) {
  const steps = [
    { key: "a", label: "Base" },
    { key: "b", label: "Marketing Plans" },
    { key: "c", label: "Headlines" },
    { key: "d", label: "Generate Posts" },
  ] as const;
  const order = ["a", "b", "c", "d"] as const;
  const currentIdx = order.indexOf(current);

  return (
    <div className="mb-5 flex items-start">
      {steps.map((step, i) => {
        const idx = order.indexOf(step.key);
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done
                    ? "border-teal-500 bg-teal-500 text-white"
                    : active
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-white text-gray-400"
                )}
              >
                {done ? <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] font-medium",
                  done ? "text-teal-600" : active ? "text-blue-600" : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mt-3.5 h-0.5 flex-1 mx-3 rounded-full",
                  done ? "bg-teal-400" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AgentModeSection() {
  const [open, setOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();

  const selectedModelId = useSelectedModel();
  const [phase, setPhase] = useState<Phase>("a-loading");
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [profileUrl, setProfileUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LinkedInProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [plans, setPlans] = useState<MarketingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MarketingPlan | null>(null);
  const [generatedPlanId, setGeneratedPlanId] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<MarketingPlan>>({});
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [profileDocs, setProfileDocs] = useState<ProfileDocument[]>([]);
  const [profileWebsites, setProfileWebsites] = useState<ProfileWebsite[]>([]);
  const [deleteDocTarget, setDeleteDocTarget] = useState<ProfileDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [deleteWebsiteTarget, setDeleteWebsiteTarget] = useState<ProfileWebsite | null>(null);
  const [isDeletingWebsite, setIsDeletingWebsite] = useState(false);
  const [recrawlingWebsiteId, setRecrawlingWebsiteId] = useState<string | null>(null);
  const [reextractingDocId, setReextractingDocId] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docPurpose, setDocPurpose] = useState("knowledge");
  const [websiteInput, setWebsiteInput] = useState("");
  const [websitePurpose, setWebsitePurpose] = useState("knowledge");
  const [websiteAdding, setWebsiteAdding] = useState(false);
  // Pre-profile queue — collected in a-submit, uploaded once profile is ready
  const [queuedWebsiteInput, setQueuedWebsiteInput] = useState("");
  const [queuedWebsitePurpose, setQueuedWebsitePurpose] = useState("knowledge");
  const [queuedDocPurpose, setQueuedDocPurpose] = useState("knowledge");
  const [queuedWebsites, setQueuedWebsites] = useState<{ url: string; purpose: string }[]>([]);
  const [queuedDocs, setQueuedDocs] = useState<{ file: File; name: string; purpose: string }[]>([]);
  const queuedWebsitesRef = useRef<{ url: string; purpose: string }[]>([]);
  const queuedDocsRef = useRef<{ file: File; name: string; purpose: string }[]>([]);
  // Pending doc files (selected but not yet uploaded)
  const [pendingQueuedDoc, setPendingQueuedDoc] = useState<File | null>(null);
  const [pendingDoc, setPendingDoc] = useState<File | null>(null);
  // Brief form (Step B)
  const [briefAudience, setBriefAudience] = useState("");
  const [briefRegion, setBriefRegion] = useState("");
  const [briefDays, setBriefDays] = useState(7);
  // Headlines (Step C)
  type HeadlineItem = { id: string; text: string; selected: boolean };
  const [headlineItems, setHeadlineItems] = useState<HeadlineItem[]>([]);
  const [headlinesLoading, setHeadlinesLoading] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [headlinesSentCount, setHeadlinesSentCount] = useState(0);
  const [showPostRateWarning, setShowPostRateWarning] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resourcePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queuedFileInputRef = useRef<HTMLInputElement>(null);

  const headlinesSentCountRef = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const stopPostPolling = () => {
    if (postPollRef.current) {
      clearInterval(postPollRef.current);
      postPollRef.current = null;
    }
  };

  const stopResourcePolling = () => {
    if (resourcePollRef.current) {
      clearInterval(resourcePollRef.current);
      resourcePollRef.current = null;
    }
  };

  const startResourcePolling = () => {
    if (resourcePollRef.current) return; // already polling
    resourcePollRef.current = setInterval(async () => {
      try {
        const [docsData, sitesData] = await Promise.all([
          agentService(workspaceId).getAgentDocuments(),
          agentService(workspaceId).getAgentWebsites(),
        ]);
        const docs = docsData?.results ?? [];
        const sites = sitesData?.results ?? [];
        setProfileDocs(docs);
        setProfileWebsites(sites);
        const isTerminal = (s: string) => s === "ready" || s === "error" || s === "failed";
        const stillPending =
          docs.some((d) => !isTerminal(d.status)) || sites.some((s) => !isTerminal(s.status));
        if (!stillPending) stopResourcePolling();
      } catch {
        stopResourcePolling();
      }
    }, 3000);
  };

  useEffect(
    () => () => {
      stopPolling();
      stopPostPolling();
      stopResourcePolling();
    },

    []
  );

  const startProfilePolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const p = await agentService(workspaceId).getProfile(id);
      if (!p) return;
      setProfile(p);
      if (p.status === "ready") {
        stopPolling();
        setPhase("a-ready");
        loadAgentResources();
        uploadQueuedResources();
      } else if (p.status === "error") {
        stopPolling();
        setPhase("a-error");
      }
    }, 3000);
  };

  const startPostPolling = (planId: string, baselineDraftCount: number) => {
    stopPostPolling();
    let attempts = 0;
    postPollRef.current = setInterval(async () => {
      attempts++;
      const data = await postsService(workspaceId).getDraftsByPlan(planId);
      const expected = headlinesSentCountRef.current;
      if (data && expected > 0 && data.results.length >= expected) {
        stopPostPolling();
        // Hand off image polling to ReviewApprovalSection via the same flag software mode uses
        queryClient.setQueryData(["posts-generating"], baselineDraftCount);
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        setPhase("c-done");
        setTimeout(() => setOpen(false), 2000);
      } else if (attempts >= 40) {
        stopPostPolling();
        toast.error("Post generation is taking longer than expected. Check your drafts later.");
        setPhase("b-headlines");
      }
    }, 2500);
  };

  const checkProfile = async () => {
    setPhase("a-loading");
    try {
      const data = await agentService(workspaceId).getProfiles();
      const all = data?.results ?? [];
      setProfiles(all);
      const latest = all[0] ?? null;
      if (!latest) {
        setPhase("a-submit");
      } else if (latest.status === "ready") {
        setProfile(latest);
        setPhase("a-ready");
        loadAgentResources();
        uploadQueuedResources();
      } else if (latest.status === "error") {
        setProfile(latest);
        setPhase("a-error");
      } else {
        setProfile(latest);
        setPhase("a-polling");
        startProfilePolling(latest.id);
      }
    } catch {
      setPhase("a-submit");
    }
  };

  const loadAgentResources = async () => {
    try {
      const [docsData, sitesData] = await Promise.all([
        agentService(workspaceId).getAgentDocuments(),
        agentService(workspaceId).getAgentWebsites(),
      ]);
      setProfileDocs(docsData?.results ?? []);
      setProfileWebsites(sitesData?.results ?? []);
    } catch {
      // silently ignore — resources are optional
    }
  };

  const uploadQueuedResources = async () => {
    const websites = queuedWebsitesRef.current;
    const docs = queuedDocsRef.current;
    if (websites.length === 0 && docs.length === 0) return;
    try {
      await Promise.allSettled([
        ...websites.map(({ url, purpose }) =>
          agentService(workspaceId).addAgentWebsite(url, purpose)
        ),
        ...docs.map(({ file, purpose }) =>
          agentService(workspaceId).uploadAgentDocument(file, purpose)
        ),
      ]);
      queuedWebsitesRef.current = [];
      queuedDocsRef.current = [];
      setQueuedWebsites([]);
      setQueuedDocs([]);
      await loadAgentResources();
      startResourcePolling();
    } catch {
      // silently ignore — queued uploads are best-effort
    }
  };

  const handleAddQueuedWebsite = async () => {
    const url = queuedWebsiteInput.trim();
    if (!url) return;
    setWebsiteAdding(true);
    try {
      const site = await agentService(workspaceId).addAgentWebsite(url, queuedWebsitePurpose);
      if (site) {
        setProfileWebsites((prev) => [site, ...prev]);
        startResourcePolling();
      }
      setQueuedWebsiteInput("");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setWebsiteAdding(false);
    }
  };

  const handleQueueDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPendingQueuedDoc(file);
  };

  const handleAddQueuedDoc = async () => {
    if (!pendingQueuedDoc) return;
    setDocUploading(true);
    try {
      const doc = await agentService(workspaceId).uploadAgentDocument(
        pendingQueuedDoc,
        queuedDocPurpose
      );
      if (doc) {
        setProfileDocs((prev) => [doc, ...prev]);
        startResourcePolling();
      }
      setPendingQueuedDoc(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDocUploading(false);
    }
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPendingDoc(file);
  };

  const handleAddDoc = async () => {
    if (!pendingDoc) return;
    setDocUploading(true);
    try {
      const doc = await agentService(workspaceId).uploadAgentDocument(pendingDoc, docPurpose);
      if (doc) {
        setProfileDocs((prev) => [doc, ...prev]);
        startResourcePolling();
      }
      setPendingDoc(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    setIsDeletingDoc(true);
    try {
      await agentService(workspaceId).deleteAgentDocument(deleteDocTarget.id);
      setProfileDocs((prev) => prev.filter((d) => d.id !== deleteDocTarget.id));
      setDeleteDocTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleAddWebsite = async () => {
    if (!websiteInput.trim()) return;
    setWebsiteAdding(true);
    try {
      const site = await agentService(workspaceId).addAgentWebsite(
        websiteInput.trim(),
        websitePurpose
      );
      if (site) {
        setProfileWebsites((prev) => [site, ...prev]);
        startResourcePolling();
      }
      setWebsiteInput("");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setWebsiteAdding(false);
    }
  };

  const handleDeleteWebsite = async () => {
    if (!deleteWebsiteTarget) return;
    setIsDeletingWebsite(true);
    try {
      await agentService(workspaceId).deleteAgentWebsite(deleteWebsiteTarget.id);
      setProfileWebsites((prev) => prev.filter((s) => s.id !== deleteWebsiteTarget.id));
      setDeleteWebsiteTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsDeletingWebsite(false);
    }
  };

  const handleReextractDoc = async (id: string) => {
    setReextractingDocId(id);
    try {
      await agentService(workspaceId).reextractAgentDocument(id);
      toast.success("Re-extraction started!");
      startResourcePolling();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setReextractingDocId(null);
    }
  };

  const handleRecrawlWebsite = async (id: string) => {
    setRecrawlingWebsiteId(id);
    try {
      await agentService(workspaceId).recrawlAgentWebsite(id);
      toast.success("Re-crawl started!");
      startResourcePolling();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setRecrawlingWebsiteId(null);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setProfile(null);
    setProfiles([]);
    setProfileUrl("");
    setDeleteTarget(null);
    setIsDeleting(false);
    setPlans([]);
    setSelectedPlan(null);
    setGeneratedPlanId("");
    setEditingPlanId(null);
    setEditDraft({});
    setProfileDocs([]);
    setProfileWebsites([]);
    setWebsiteInput("");
    setWebsitePurpose("knowledge");
    setDocPurpose("knowledge");
    setQueuedWebsiteInput("");
    setQueuedWebsitePurpose("knowledge");
    setQueuedDocPurpose("knowledge");
    setQueuedWebsites([]);
    setQueuedDocs([]);
    queuedWebsitesRef.current = [];
    queuedDocsRef.current = [];
    setPendingQueuedDoc(null);
    setPendingDoc(null);
    setBriefAudience("");
    setBriefRegion("");
    setBriefDays(7);
    setHeadlineItems([]);
    setHeadlinesSentCount(0);
    headlinesSentCountRef.current = 0;
    if (workspaceId) {
      checkProfile();
      loadAgentResources();
    }
  };

  const handleClose = () => {
    stopPolling();
    stopPostPolling();
    stopResourcePolling();
    setOpen(false);
  };

  const handleSubmitProfile = async () => {
    if (!profileUrl.trim()) return;
    setProfileLoading(true);
    try {
      const p = await agentService(workspaceId).createProfile(profileUrl.trim());
      setProfile(p);
      setProfiles((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
      setProfileUrl("");
      if (p.status === "ready") {
        setPhase("a-ready");
      } else if (p.status === "error") {
        setPhase("a-error");
      } else {
        setPhase("a-polling");
        startProfilePolling(p.id);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await agentService(workspaceId).deleteProfile(deleteTarget.id);
      const remaining = profiles.filter((p) => p.id !== deleteTarget.id);
      setProfiles(remaining);
      setDeleteTarget(null);
      if (remaining.length === 0) {
        setProfile(null);
        setPhase("a-submit");
      } else {
        setProfile(remaining[0]);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryProfile = async () => {
    if (!profile) return;
    try {
      const p = await agentService(workspaceId).refetchProfile(profile.id);
      setProfile(p);
      if (p.status === "ready") {
        setPhase("a-ready");
      } else {
        setPhase("a-polling");
        startProfilePolling(p.id);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleGeneratePlans = async () => {
    setEditingPlanId(null);
    setEditDraft({});
    setPhase("b-generating");
    try {
      const body: Parameters<ReturnType<typeof agentService>["generatePlans"]>[0] = {};
      if (briefAudience.trim()) body.target_audience = briefAudience.trim();
      if (briefRegion.trim()) body.region = briefRegion.trim();
      if (briefDays >= 1 && briefDays <= 90) body.days = briefDays;
      if (selectedModelId) body.writer_model = selectedModelId;
      const data = await agentService(workspaceId).generatePlans(body);
      const planList = Array.isArray(data)
        ? data
        : ((data as { results?: MarketingPlan[] }).results ??
          (data ? [data as MarketingPlan] : []));
      if (planList.length === 0) {
        toast.error("No plans were generated. Please try again.");
        setPhase("b-brief");
        return;
      }
      setPlans(planList);
      setSelectedPlan(planList[0]);
      setPhase("b-select");
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setPhase("b-brief");
    }
  };

  const handleFetchHeadlines = async (plan: MarketingPlan, extra?: { more: true }) => {
    if (!extra) {
      setHeadlineItems([]);
      setHeadlinesLoading(true);
    } else {
      setGeneratingMore(true);
    }
    try {
      const currentTexts = headlineItems.map((h) => h.text);
      const req = extra ? { count: 5, exclude: currentTexts.slice(0, 50) } : {};
      const data = await agentService(workspaceId).getHeadlines(plan.id, req);
      const newLines = (data?.headlines ?? []).map((text, i) => ({
        id: `${Date.now()}-${i}`,
        text,
        selected: !extra, // auto-select first batch, don't auto-select "more"
      }));
      if (extra) {
        setHeadlineItems((prev) => [...prev, ...newLines]);
      } else {
        setHeadlineItems(newLines);
        setPhase("b-headlines");
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
      if (!extra) setPhase("b-select");
    } finally {
      setHeadlinesLoading(false);
      setGeneratingMore(false);
    }
  };

  const handleEditPlan = (plan: MarketingPlan) => {
    setEditingPlanId(plan.id);
    setEditDraft({
      title: plan.title,
      angle: plan.angle,
      target_audience: plan.target_audience,
      pillars: plan.pillars,
      sample_hooks: plan.sample_hooks,
    });
  };

  const handleSavePlan = async (planId: string) => {
    setIsSavingPlan(true);
    try {
      const updated = await agentService(workspaceId).updatePlan(planId, editDraft);
      if (updated) {
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        if (selectedPlan?.id === planId) setSelectedPlan(updated);
      }
      setEditingPlanId(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleGenerateFromPlan = async () => {
    if (!selectedPlan) return;
    const selected = headlineItems.filter((h) => h.selected).map((h) => h.text);
    // De-duplicate client-side
    const deduped = [...new Set(selected)];
    if (deduped.length === 0) {
      toast.error("Select at least one headline before generating.");
      return;
    }
    // Capture baseline draft count before generation so ReviewApprovalSection
    // knows when new posts have appeared and images are done
    const cached = queryClient.getQueryData(["posts", "draft", workspaceId]) as
      { count?: number } | undefined;
    const baselineDraftCount = cached?.count ?? 0;

    headlinesSentCountRef.current = deduped.length;
    setHeadlinesSentCount(deduped.length);
    setPhase("c-generating");
    try {
      await agentService(workspaceId).generateFromPlan(selectedPlan.id, {
        headlines: deduped,
        writer_model: selectedModelId ?? undefined,
      });
      // 202 queued — poll until the plan's draft posts appear
      setGeneratedPlanId(selectedPlan.id);
      setPhase("c-polling");
      startPostPolling(selectedPlan.id, baselineDraftCount);
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setPhase("b-headlines");
    }
  };

  const PURPOSE_LABELS: Record<string, string> = {
    knowledge: "Knowledge",
    tone: "Tone",
    style: "Style",
  };
  const PURPOSE_COLORS: Record<string, string> = {
    knowledge: "bg-gray-100 text-gray-600",
    tone: "bg-purple-100 text-purple-700",
    style: "bg-orange-100 text-orange-700",
  };
  const purposeSelect = (value: string, onChange: (v: string) => void) => (
    <span className="relative inline-flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        title="Knowledge = facts · Tone = voice · Style = formatting"
      >
        <option value="knowledge">Knowledge</option>
        <option value="tone">Tone</option>
        <option value="style">Style</option>
      </select>
      <Tooltip
        text="Knowledge — facts about your business. Tone — writing voice & style samples. Style — post structure & formatting guides."
        width="w-60"
        position="top"
        align="right"
      />
    </span>
  );

  const currentStep = phase.startsWith("a")
    ? "a"
    : phase === "b-brief" || phase === "b-generating" || phase === "b-select"
      ? "b"
      : phase === "b-headlines"
        ? "c"
        : "d";

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <LuZap className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Agent Mode</p>
          <p className="text-xs text-gray-500">
            Analyze your LinkedIn profile, build a content plan, and generate posts automatically.
          </p>
        </div>
        <button
          onClick={handleOpen}
          disabled={!workspaceId}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <LuSparkles className="h-3.5 w-3.5" />
          Run Agent
        </button>
      </div>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title="Agent Mode"
        width="4xl"
        disableBackdropClose
        minHeight="480px"
        bodyClassName="flex flex-col"
      >
        <StepBar current={currentStep as "a" | "b" | "c" | "d"} />

        {/* ── Phase A: Loading ── */}
        {phase === "a-loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Checking LinkedIn profile…</p>
          </div>
        )}

        {/* ── Phase A: Submit URL ── */}
        {phase === "a-submit" && (
          <div className="space-y-4">
            {/* Hidden file input for queued docs */}
            <input
              ref={queuedFileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleQueueDoc}
            />

            {/* LinkedIn Profile URL */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <LuUser className="h-3.5 w-3.5 text-blue-500" />
                LinkedIn Profile URL
                <Tooltip
                  text="The AI analyses your recent posts, writing style, and expertise to make generated content sound like you."
                  position="bottom"
                />
              </p>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <LuLink className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitProfile();
                    }}
                    placeholder="https://linkedin.com/in/your-profile"
                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSubmitProfile}
                  disabled={!profileUrl.trim() || profileLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {profileLoading ? (
                    <LuLoader className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LuArrowRight className="h-3.5 w-3.5" />
                  )}
                  {profileLoading ? "Submitting…" : "Analyze Profile"}
                </button>
              </div>
            </div>

            {/* Websites */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <LuGlobe className="h-3.5 w-3.5 text-blue-500" />
                Websites
                <span className="font-normal text-gray-400">(optional)</span>
                <Tooltip
                  text="Add URLs for the AI to crawl as context. Knowledge = facts about your business. Tone = voice/style references. Style = formatting examples."
                  position="bottom"
                  width="w-64"
                />
              </p>
              {profileWebsites.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {profileWebsites.map((site) => {
                    const crawling =
                      site.status !== "ready" &&
                      site.status !== "error" &&
                      site.status !== "failed";
                    return (
                      <li
                        key={site.id}
                        className={cn(
                          "overflow-hidden rounded-lg border",
                          crawling
                            ? "animate-shimmer-card border-blue-200"
                            : "border-gray-200 bg-white"
                        )}
                      >
                        <div className="flex items-center gap-2 px-2.5 py-1.5">
                          <LuGlobe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                            {site.url}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              PURPOSE_COLORS[site.purpose] ?? PURPOSE_COLORS.knowledge
                            )}
                          >
                            {PURPOSE_LABELS[site.purpose] ?? site.purpose}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              site.status === "ready"
                                ? "bg-teal-100 text-teal-700"
                                : site.status === "error" || site.status === "failed"
                                  ? "bg-red-100 text-red-600"
                                  : "bg-blue-100 text-blue-600"
                            )}
                          >
                            {site.status}
                          </span>
                          <button
                            onClick={() => handleRecrawlWebsite(site.id)}
                            disabled={recrawlingWebsiteId === site.id}
                            title="Re-crawl"
                            className="shrink-0 text-gray-300 hover:text-blue-500 disabled:opacity-40"
                          >
                            <LuRefreshCw
                              className={cn(
                                "h-3.5 w-3.5",
                                recrawlingWebsiteId === site.id && "animate-spin"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => setDeleteWebsiteTarget(site)}
                            className="shrink-0 text-gray-300 hover:text-red-500"
                          >
                            <LuX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {queuedWebsites.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {queuedWebsites.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
                    >
                      <LuGlobe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                        {item.url}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          PURPOSE_COLORS[item.purpose] ?? PURPOSE_COLORS.knowledge
                        )}
                      >
                        {PURPOSE_LABELS[item.purpose] ?? item.purpose}
                      </span>
                      <button
                        onClick={() => {
                          const next = queuedWebsites.filter((_, i) => i !== idx);
                          queuedWebsitesRef.current = next;
                          setQueuedWebsites(next);
                        }}
                        className="shrink-0 text-gray-300 hover:text-red-500"
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <LuLink className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={queuedWebsiteInput}
                    onChange={(e) => setQueuedWebsiteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddQueuedWebsite();
                    }}
                    placeholder="https://yoursite.com"
                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {purposeSelect(queuedWebsitePurpose, setQueuedWebsitePurpose)}
                <button
                  onClick={handleAddQueuedWebsite}
                  disabled={!queuedWebsiteInput.trim() || websiteAdding}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {websiteAdding ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                </button>
              </div>
            </div>

            {/* Documents */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <LuFileText className="h-3.5 w-3.5 text-blue-500" />
                Documents
                <span className="font-normal text-gray-400">(optional)</span>
                <Tooltip
                  text="Upload PDFs as context. Knowledge = product docs or case studies. Tone = brand voice guides. Style = formatting or structure templates."
                  position="bottom"
                  width="w-64"
                />
              </p>
              {profileDocs.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {profileDocs.map((doc) => {
                    const processing =
                      doc.status !== "ready" && doc.status !== "error" && doc.status !== "failed";
                    return (
                      <li
                        key={doc.id}
                        className={cn(
                          "overflow-hidden rounded-lg border",
                          processing
                            ? "animate-shimmer-card border-blue-200"
                            : "border-gray-200 bg-white"
                        )}
                      >
                        <div className="flex items-center gap-2 px-2.5 py-1.5">
                          <LuFileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                            {doc.filename}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              PURPOSE_COLORS[doc.purpose] ?? PURPOSE_COLORS.knowledge
                            )}
                          >
                            {PURPOSE_LABELS[doc.purpose] ?? doc.purpose}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              doc.status === "ready"
                                ? "bg-teal-100 text-teal-700"
                                : doc.status === "error" || doc.status === "failed"
                                  ? "bg-red-100 text-red-600"
                                  : "bg-blue-100 text-blue-600"
                            )}
                          >
                            {doc.status}
                          </span>
                          <button
                            onClick={() => handleReextractDoc(doc.id)}
                            disabled={reextractingDocId === doc.id}
                            title="Re-extract"
                            className="shrink-0 text-gray-300 hover:text-blue-500 disabled:opacity-40"
                          >
                            <LuRefreshCw
                              className={cn(
                                "h-3.5 w-3.5",
                                reextractingDocId === doc.id && "animate-spin"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => setDeleteDocTarget(doc)}
                            className="shrink-0 text-gray-300 hover:text-red-500"
                          >
                            <LuX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {queuedDocs.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {queuedDocs.map((d, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
                    >
                      <LuFileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                        {d.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          PURPOSE_COLORS[d.purpose] ?? PURPOSE_COLORS.knowledge
                        )}
                      >
                        {PURPOSE_LABELS[d.purpose] ?? d.purpose}
                      </span>
                      <button
                        onClick={() => {
                          const next = queuedDocs.filter((_, i) => i !== idx);
                          queuedDocsRef.current = next;
                          setQueuedDocs(next);
                        }}
                        className="shrink-0 text-gray-300 hover:text-red-500"
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={() => queuedFileInputRef.current?.click()}
                  disabled={docUploading}
                  className="flex flex-1 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-blue-400 disabled:opacity-50"
                >
                  <LuUpload className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span
                    className={cn(
                      "truncate",
                      pendingQueuedDoc ? "text-gray-800" : "text-gray-400 hover:text-blue-600"
                    )}
                  >
                    {pendingQueuedDoc ? pendingQueuedDoc.name : "Choose file…"}
                  </span>
                </button>
                {purposeSelect(queuedDocPurpose, setQueuedDocPurpose)}
                <button
                  onClick={handleAddQueuedDoc}
                  disabled={!pendingQueuedDoc || docUploading}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {docUploading ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                </button>
              </div>
            </div>

            {/* Generate Marketing Plans */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setPhase("b-brief")}
                disabled={
                  !profileUrl.trim() &&
                  queuedWebsites.length === 0 &&
                  queuedDocs.length === 0 &&
                  profileWebsites.length === 0 &&
                  profileDocs.length === 0
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <LuSparkles className="h-4 w-4" />
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Phase B: Brief form ── */}
        {phase === "b-brief" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase(profile?.status === "ready" ? "a-ready" : "a-submit")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <LuArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <p className="text-sm text-gray-500">
                Help the AI plan better posts for your audience.
              </p>
            </div>

            {/* Target Audience */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                Target Audience
                <span className="font-normal text-gray-400">— optional</span>
                <Tooltip text="Who are you writing for? Helps the AI focus on topics that resonate with your specific readers — e.g. B2B SaaS founders, early-stage startups." />
              </label>
              <input
                type="text"
                value={briefAudience}
                onChange={(e) => setBriefAudience(e.target.value)}
                placeholder="e.g. B2B SaaS founders, early-stage startups"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Region / Timezone */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                Audience Timezone
                <span className="font-normal text-gray-400">— optional</span>
                <Tooltip
                  text="Sets suggested publish times for your audience. Pick their timezone, not yours — e.g. someone in Dhaka selling to US buyers picks America/New_York. Must be an IANA name, not a country or city."
                  width="w-72"
                />
              </label>
              <input
                type="text"
                list="iana-timezones"
                value={briefRegion}
                onChange={(e) => setBriefRegion(e.target.value)}
                placeholder="e.g. Europe/London, America/New_York"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <datalist id="iana-timezones">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </div>

            {/* Days */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                Planning Window
                <span className="font-normal text-gray-400">— days</span>
                <Tooltip text="How many days ahead to plan content. Also controls how many headline options you'll see in the next step. Range: 1–90. Default: 7." />
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={briefDays}
                onChange={(e) =>
                  setBriefDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))
                }
                className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <ModelSwitcher dropUp />
              <button
                onClick={handleGeneratePlans}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <LuSparkles className="h-4 w-4" />
                Generate Marketing Plans
              </button>
            </div>
          </div>
        )}

        {/* ── Phase A: Polling ── */}
        {phase === "a-polling" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-blue-50 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-700">
              {profile?.status === "fetching"
                ? "Fetching your LinkedIn data…"
                : "Processing your profile…"}
            </p>
            <p className="text-xs text-gray-400">{profile?.profile_url}</p>
            <p className="text-xs text-gray-400">This usually takes 15–30 seconds.</p>
          </div>
        )}

        {/* ── Phase A: Error ── */}
        {phase === "a-error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
              <LuTriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-800">Profile fetch failed</p>
                <p className="mt-0.5 text-xs text-red-600">
                  {profile?.error || "An unknown error occurred."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setProfile(null);
                  setProfileUrl("");
                  setPhase("a-submit");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LuX className="h-4 w-4" />
                Change URL
              </button>
              <button
                onClick={handleRetryProfile}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <LuRefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Phase A: Ready ── */}
        {phase === "a-ready" && (
          <>
            {/* Spacer pushes controls to the bottom */}
            <div className="flex-1" />

            <div className="space-y-3">
              {/* Profile list */}
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100">
                    <LuUser className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {p.profile_url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? "Profile ready"}
                    </p>
                    {p.facets?.summary && (
                      <p className="truncate text-xs text-gray-500">{p.facets.summary}</p>
                    )}
                    <p className="truncate text-xs text-blue-600">{p.profile_url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LuCheck className="h-4 w-4 text-teal-500" strokeWidth={2.5} />
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LuTrash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Delete website confirm modal */}
              <Modal
                isOpen={!!deleteWebsiteTarget}
                onClose={() => !isDeletingWebsite && setDeleteWebsiteTarget(null)}
                title="Remove Website"
                width="sm"
                disableBackdropClose={isDeletingWebsite}
              >
                <p className="text-sm text-gray-700">
                  Remove <span className="font-semibold">{deleteWebsiteTarget?.url}</span>? This
                  action cannot be undone.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setDeleteWebsiteTarget(null)}
                    disabled={isDeletingWebsite}
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteWebsite}
                    disabled={isDeletingWebsite}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeletingWebsite ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuTrash2 className="h-3.5 w-3.5" />
                    )}
                    {isDeletingWebsite ? "Removing…" : "Yes, remove"}
                  </button>
                </div>
              </Modal>

              {/* Delete doc confirm modal */}
              <Modal
                isOpen={!!deleteDocTarget}
                onClose={() => !isDeletingDoc && setDeleteDocTarget(null)}
                title="Remove Document"
                width="sm"
                disableBackdropClose={isDeletingDoc}
              >
                <p className="text-sm text-gray-700">
                  Remove <span className="font-semibold">{deleteDocTarget?.filename}</span>? This
                  action cannot be undone.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setDeleteDocTarget(null)}
                    disabled={isDeletingDoc}
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteDoc}
                    disabled={isDeletingDoc}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeletingDoc ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuTrash2 className="h-3.5 w-3.5" />
                    )}
                    {isDeletingDoc ? "Removing…" : "Yes, remove"}
                  </button>
                </div>
              </Modal>

              {/* Delete profile confirm modal */}
              <Modal
                isOpen={!!deleteTarget}
                onClose={() => !isDeleting && setDeleteTarget(null)}
                title="Remove Profile"
                width="sm"
                disableBackdropClose={isDeleting}
              >
                <p className="text-sm text-gray-700">
                  Remove{" "}
                  <span className="font-semibold">
                    {deleteTarget?.profile_url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ??
                      deleteTarget?.profile_url}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteProfile}
                    disabled={isDeleting}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuTrash2 className="h-3.5 w-3.5" />
                    )}
                    {isDeleting ? "Removing…" : "Yes, remove"}
                  </button>
                </div>
              </Modal>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleDocUpload}
              />

              {/* Knowledge Sources */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-3 flex items-center gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Knowledge Sources
                  </p>
                  <Tooltip
                    text="Add websites and documents to ground the AI in your business. Each source has a purpose — Knowledge feeds facts, Tone shapes writing voice, Style guides post structure."
                    width="w-72"
                    position="bottom"
                  />
                </div>

                {/* Websites */}
                <div className="mb-3">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
                    <LuGlobe className="h-3.5 w-3.5 text-blue-500" />
                    Websites
                    <Tooltip
                      text="Crawled and indexed as context. Set purpose to: Knowledge — product/company pages; Tone — your blog or articles; Style — formatting examples."
                      width="w-64"
                      position="bottom"
                      align="left"
                    />
                  </p>
                  {profileWebsites.length > 0 && (
                    <ul className="mb-1.5 space-y-1">
                      {profileWebsites.map((site) => {
                        const crawling =
                          site.status !== "ready" &&
                          site.status !== "error" &&
                          site.status !== "failed";
                        return (
                          <li
                            key={site.id}
                            className={cn(
                              "overflow-hidden rounded-lg border",
                              crawling
                                ? "animate-shimmer-card border-blue-200"
                                : "border-gray-200 bg-white"
                            )}
                          >
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <LuGlobe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                                {site.url}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                  PURPOSE_COLORS[site.purpose] ?? PURPOSE_COLORS.knowledge
                                )}
                              >
                                {PURPOSE_LABELS[site.purpose] ?? site.purpose}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                  site.status === "ready"
                                    ? "bg-teal-100 text-teal-700"
                                    : site.status === "error" || site.status === "failed"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-blue-100 text-blue-600"
                                )}
                              >
                                {site.status}
                              </span>
                              <button
                                onClick={() => handleRecrawlWebsite(site.id)}
                                disabled={recrawlingWebsiteId === site.id}
                                title="Re-crawl"
                                className="shrink-0 text-gray-300 hover:text-blue-500 disabled:opacity-40"
                              >
                                <LuRefreshCw
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    recrawlingWebsiteId === site.id && "animate-spin"
                                  )}
                                />
                              </button>
                              <button
                                onClick={() => setDeleteWebsiteTarget(site)}
                                className="shrink-0 text-gray-300 hover:text-red-500"
                              >
                                <LuX className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <LuLink className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        value={websiteInput}
                        onChange={(e) => setWebsiteInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddWebsite();
                        }}
                        placeholder="https://yoursite.com"
                        className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    {purposeSelect(websitePurpose, setWebsitePurpose)}
                    <button
                      onClick={handleAddWebsite}
                      disabled={!websiteInput.trim() || websiteAdding}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {websiteAdding ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                    </button>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
                    <LuFileText className="h-3.5 w-3.5 text-blue-500" />
                    Documents
                    <Tooltip
                      text="Upload PDFs. Knowledge — case studies, product docs, FAQs; Tone — past posts or brand voice guide; Style — formatting or structure templates."
                      width="w-64"
                      position="bottom"
                      align="left"
                    />
                  </p>
                  {profileDocs.length > 0 && (
                    <ul className="mb-1.5 space-y-1">
                      {profileDocs.map((doc) => {
                        const crawling =
                          doc.status !== "ready" &&
                          doc.status !== "error" &&
                          doc.status !== "failed";
                        return (
                          <li
                            key={doc.id}
                            className={cn(
                              "overflow-hidden rounded-lg border",
                              crawling
                                ? "animate-shimmer-card border-blue-200"
                                : "border-gray-200 bg-white"
                            )}
                          >
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <LuFileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                                {doc.filename}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                  PURPOSE_COLORS[doc.purpose] ?? PURPOSE_COLORS.knowledge
                                )}
                              >
                                {PURPOSE_LABELS[doc.purpose] ?? doc.purpose}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                  doc.status === "ready"
                                    ? "bg-teal-100 text-teal-700"
                                    : doc.status === "error" || doc.status === "failed"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-blue-100 text-blue-600"
                                )}
                              >
                                {doc.status}
                              </span>
                              <button
                                onClick={() => handleReextractDoc(doc.id)}
                                disabled={reextractingDocId === doc.id}
                                title="Re-extract"
                                className="shrink-0 text-gray-300 hover:text-blue-500 disabled:opacity-40"
                              >
                                <LuRefreshCw
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    reextractingDocId === doc.id && "animate-spin"
                                  )}
                                />
                              </button>
                              <button
                                onClick={() => setDeleteDocTarget(doc)}
                                className="shrink-0 text-gray-300 hover:text-red-500"
                              >
                                <LuX className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={docUploading}
                      className="flex flex-1 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-blue-400 disabled:opacity-50"
                    >
                      <LuUpload className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span
                        className={cn(
                          "truncate",
                          pendingDoc ? "text-gray-800" : "text-gray-400 hover:text-blue-600"
                        )}
                      >
                        {pendingDoc ? pendingDoc.name : "Choose file…"}
                      </span>
                    </button>
                    {purposeSelect(docPurpose, setDocPurpose)}
                    <button
                      onClick={handleAddDoc}
                      disabled={!pendingDoc || docUploading}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {docUploading ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Add another profile URL */}
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <LuLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitProfile();
                    }}
                    placeholder="Add another profile URL (optional)"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {profileUrl.trim() && (
                    <button
                      onClick={handleSubmitProfile}
                      disabled={profileLoading}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      {profileLoading ? (
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LuArrowRight className="h-3.5 w-3.5" />
                      )}
                      Add
                    </button>
                  )}
                  <button
                    onClick={() => setPhase("b-brief")}
                    disabled={profileLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <LuSparkles className="h-4 w-4" />
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Phase B: Generating plans ── */}
        {phase === "b-generating" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <LuLoader className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Building your content marketing plans…</p>
            <p className="text-xs text-gray-400">Analyzing your profile and knowledge base.</p>
          </div>
        )}

        {/* ── Phase B: Select plan ── */}
        {phase === "b-select" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase("a-ready")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <LuArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <p className="text-sm text-gray-600">
                Choose the marketing plan that best fits your goals. The agent will generate posts
                aligned to it.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((plan, i) => {
                const isSelected = selectedPlan?.id === plan.id;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={cn(
                      "relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    )}
                  >
                    {/* Card header */}
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {isSelected ? <LuCheck className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Selected
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlan(plan);
                          }}
                          className="flex items-center justify-center rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Edit plan"
                        >
                          <LuPencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-bold leading-snug text-gray-900">{plan.title}</p>

                    {/* Angle */}
                    {plan.angle && (
                      <div className="mt-2.5">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Angle
                        </p>
                        <p className="text-xs leading-relaxed text-gray-600">{plan.angle}</p>
                      </div>
                    )}

                    {/* Target audience */}
                    {plan.target_audience && (
                      <div className="mt-2.5">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Target Audience
                        </p>
                        <p className="text-xs leading-relaxed text-gray-600">
                          {plan.target_audience}
                        </p>
                      </div>
                    )}

                    {/* Content pillars */}
                    {plan.pillars && plan.pillars.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Content Pillars
                        </p>
                        <ul className="space-y-0.5">
                          {plan.pillars.map((pillar) => (
                            <li key={pillar} className="flex items-start gap-1.5">
                              <span
                                className={cn(
                                  "mt-1.5 h-1 w-1 shrink-0 rounded-full",
                                  isSelected ? "bg-blue-500" : "bg-gray-400"
                                )}
                              />
                              <span className="text-xs leading-relaxed text-gray-600">
                                {pillar}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Sample hook */}
                    {plan.sample_hooks && plan.sample_hooks.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Sample Hook
                        </p>
                        <p className="text-xs italic leading-relaxed text-gray-500">
                          &ldquo;{plan.sample_hooks[0]}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPhase("b-brief")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LuRefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <ModelSwitcher dropUp />
              <button
                onClick={() => selectedPlan && handleFetchHeadlines(selectedPlan)}
                disabled={!selectedPlan || headlinesLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {headlinesLoading ? (
                  <LuLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <LuCalendarDays className="h-4 w-4" />
                )}
                {headlinesLoading ? "Getting headlines…" : "Get Headlines"}
              </button>
            </div>
          </div>
        )}

        {/* ── Phase B: Headlines ── */}
        {phase === "b-headlines" &&
          (() => {
            const selectedCount = headlineItems.filter((h) => h.selected).length;
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPhase("b-select")}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <LuArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                  <p className="flex-1 text-sm text-gray-500">
                    Pick the headlines to turn into posts.{" "}
                    <Tooltip
                      text="Each selected headline becomes exactly one post. The headline is used verbatim as the first line. You can edit any headline before generating."
                      width="w-64"
                    />
                  </p>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {selectedCount} selected
                  </span>
                </div>

                {/* Headline list */}
                <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
                  {headlineItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">No headlines yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {headlineItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) =>
                              setHeadlineItems((prev) =>
                                prev.map((h) =>
                                  h.id === item.id ? { ...h, selected: e.target.checked } : h
                                )
                              )
                            }
                            className="h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-600"
                          />
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) =>
                              setHeadlineItems((prev) =>
                                prev.map((h) =>
                                  h.id === item.id ? { ...h, text: e.target.value } : h
                                )
                              )
                            }
                            className="min-w-0 flex-1 bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400 focus:text-gray-900"
                          />
                          <button
                            onClick={() =>
                              setHeadlineItems((prev) => prev.filter((h) => h.id !== item.id))
                            }
                            className="shrink-0 text-gray-300 hover:text-red-500"
                          >
                            <LuX className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setHeadlineItems((prev) => [
                        ...prev,
                        { id: `custom-${Date.now()}`, text: "", selected: true },
                      ])
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <LuPlus className="h-3.5 w-3.5" />
                    Add custom
                  </button>
                  <span className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        selectedPlan && handleFetchHeadlines(selectedPlan, { more: true })
                      }
                      disabled={generatingMore || !selectedPlan}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      {generatingMore ? (
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LuRefreshCw className="h-3.5 w-3.5" />
                      )}
                      {generatingMore ? "Generating…" : "Generate more"}
                    </button>
                    <Tooltip
                      text="Generates additional headlines while excluding the ones already shown. Append as many as you like before selecting."
                      position="top"
                      width="w-60"
                    />
                  </span>
                  <div className="flex-1" />
                  <ModelSwitcher dropUp />
                  <button
                    onClick={() => {
                      if (selectedCount / briefDays > 2) {
                        setShowPostRateWarning(true);
                      } else {
                        handleGenerateFromPlan();
                      }
                    }}
                    disabled={selectedCount === 0}
                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <LuSparkles className="h-4 w-4" />
                    Generate Posts
                  </button>
                </div>
              </div>
            );
          })()}

        {/* ── Phase C: Queuing ── */}
        {phase === "c-generating" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <LuLoader className="h-7 w-7 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Sending to queue…</p>
          </div>
        )}

        {/* ── Phase C: Polling for posts ── */}
        {phase === "c-polling" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10">
            {/* Ring spinner */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-500" />
              <LuSparkles className="h-7 w-7 text-blue-500" />
            </div>

            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold text-gray-900">
                Creating {headlinesSentCount} post{headlinesSentCount !== 1 ? "s" : ""}…
              </p>
              <p className="text-xs text-gray-400">
                Posts appear one by one as they&apos;re written.
              </p>
            </div>

            {/* Bouncing dots */}
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>

            <p className="text-[11px] text-gray-300">{generatedPlanId}</p>
          </div>
        )}

        {/* ── Phase C: Done ── */}
        {phase === "c-done" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <LuCheck className="h-7 w-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <p className="text-base font-semibold text-gray-900">Posts created!</p>
              <p className="text-center text-sm text-gray-500">
                {headlinesSentCount} draft post{headlinesSentCount !== 1 ? "s" : ""} generated from
                your selected headlines. Review, approve, and schedule them in the section below.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <LuCheck className="h-4 w-4" />
              View Drafts
            </button>
          </div>
        )}
      </Modal>

      {/* ── Post Rate Warning Modal ── */}
      {(() => {
        const selectedCount = headlineItems.filter((h) => h.selected).length;
        const postsPerDay = briefDays > 0 ? (selectedCount / briefDays).toFixed(1) : "—";
        return (
          <Modal
            isOpen={showPostRateWarning}
            onClose={() => setShowPostRateWarning(false)}
            title="High posting frequency"
            width="sm"
            disableBackdropClose
          >
            <p className="text-sm text-gray-600">
              You selected{" "}
              <span className="font-semibold text-gray-900">{selectedCount} posts</span> over{" "}
              <span className="font-semibold text-gray-900">
                {briefDays} day{briefDays !== 1 ? "s" : ""}
              </span>{" "}
              — that&apos;s{" "}
              <span className="font-semibold text-amber-600">{postsPerDay} posts/day</span> on
              average.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Most audiences engage better with{" "}
              <span className="font-medium text-gray-700">≤ 2 posts per day</span>. You can adjust
              your selection or proceed anyway.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowPostRateWarning(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Adjust
              </button>
              <button
                onClick={() => {
                  setShowPostRateWarning(false);
                  handleGenerateFromPlan();
                }}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Proceed anyway
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── Edit Plan Modal ── */}
      <Modal
        isOpen={editingPlanId !== null}
        onClose={() => setEditingPlanId(null)}
        title="Edit Marketing Plan"
        width="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Title
            </label>
            <input
              type="text"
              value={editDraft.title ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Angle
            </label>
            <textarea
              value={editDraft.angle ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, angle: e.target.value }))}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Target Audience
            </label>
            <textarea
              value={editDraft.target_audience ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, target_audience: e.target.value }))}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Content Pillars (one per line)
            </label>
            <textarea
              value={(editDraft.pillars ?? []).join("\n")}
              onChange={(e) =>
                setEditDraft((d) => ({
                  ...d,
                  pillars: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Sample Hook
            </label>
            <textarea
              value={(editDraft.sample_hooks ?? [])[0] ?? ""}
              onChange={(e) =>
                setEditDraft((d) => ({
                  ...d,
                  sample_hooks: [e.target.value, ...(d.sample_hooks ?? []).slice(1)],
                }))
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditingPlanId(null)}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSavePlan(editingPlanId!)}
              disabled={isSavingPlan}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingPlan ? (
                <LuLoader className="h-4 w-4 animate-spin" />
              ) : (
                <LuSave className="h-4 w-4" />
              )}
              {isSavingPlan ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
