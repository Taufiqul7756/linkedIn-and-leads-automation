"use client";
import { useState, useEffect, useRef } from "react";
import {
  LuLink,
  LuGlobe,
  LuFileText,
  LuLoader,
  LuUpload,
  LuX,
  LuSparkles,
  LuTriangleAlert,
  LuChevronDown,
} from "react-icons/lu";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { websiteService } from "@/service/websiteService";
import { documentService } from "@/service/documentService";
import { postsService } from "@/service/postsService";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import Tooltip from "@/components/ui/Tooltip";
import ModelSwitcher, { useSelectedModel } from "./ModelSwitcher";

type Length = "Short" | "Medium" | "Long";
const LENGTH_OPTIONS: Length[] = ["Short", "Medium", "Long"];

const isTerminal = (s: string) => s === "ready" || s === "error" || s === "failed";

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <LuChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="border-t border-gray-200 bg-white px-4 py-4">{children}</div>}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ManualModeSection({ open, onClose }: Props) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personaFileInputRef = useRef<HTMLInputElement>(null);
  const selectedModelId = useSelectedModel();

  // Accordion open state
  const [personaOpen, setPersonaOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  // Persona section
  const [personaUrl, setPersonaUrl] = useState("");
  const [personaUrlAdding, setPersonaUrlAdding] = useState(false);
  const [personaDoc, setPersonaDoc] = useState<File | null>(null);
  const [personaDocUploading, setPersonaDocUploading] = useState(false);

  // Knowledge sources
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [websiteInput, setWebsiteInput] = useState("");
  const [websiteAdding, setWebsiteAdding] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);

  // Post settings
  const [postCount, setPostCount] = useState<number | "">("");
  const [postCountError, setPostCountError] = useState("");
  const [useEmoji, setUseEmoji] = useState(false);
  const [length, setLength] = useState<Length>("Medium");

  // Instruction
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [promptError, setPromptError] = useState<{
    prompt: string;
    suggested_topics: string[];
  } | null>(null);

  const handleClose = () => {
    setPersonaOpen(true);
    setKnowledgeOpen(false);
    setPersonaUrl("");
    setPersonaDoc(null);
    setWebsiteInput("");
    setPendingDoc(null);
    setPostCount("");
    setPostCountError("");
    setUseEmoji(false);
    setLength("Medium");
    setPrompt("");
    setSuggestions([]);
    setPromptError(null);
    onClose();
  };

  // Queries
  const { data: websitesData } = useQueryWithTokenRefresh(
    ["websites", workspaceId],
    () => websiteService(workspaceId).getWebsites(),
    {
      enabled: !!workspaceId && open,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        return results.some((s) => !isTerminal(s.status)) ? 3000 : false;
      },
    }
  );

  const { data: allDocs } = useQueryWithTokenRefresh(
    ["documents", workspaceId],
    () => documentService(workspaceId).getDocuments(),
    {
      enabled: !!workspaceId && open,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        return results.some((d) => !isTerminal(d.status)) ? 3000 : false;
      },
    }
  );

  const websitesList = websitesData?.results ?? [];
  const docsList = allDocs?.results ?? [];

  const personaDocs = docsList.filter((d) => d.purpose === "tone" || d.purpose === "style");
  const knowledgeDocs = docsList.filter((d) => d.purpose === "knowledge");

  useEffect(() => {
    if (!docsList.length) return;
    setTimeout(
      () =>
        setSelectedDocIds(new Set(docsList.filter((d) => d.status === "ready").map((d) => d.id))),
      0
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsList.length]);

  // Mutations
  const suggestMutation = useMutationWithTokenRefresh(
    (websiteId: string) => postsService(workspaceId).suggestPrompts({ website_profile: websiteId }),
    {
      onSuccess: (data) => {
        if (data?.prompts?.length) {
          setSuggestions(data.prompts);
        } else {
          toast.error("No suggestions returned.");
        }
      },
      onError: (error: unknown) => toast.error(extractErrorMessage(error)),
    }
  );

  const generateMutation = useMutationWithTokenRefresh(
    () => {
      const selectedDocs = docsList.filter((d) => selectedDocIds.has(d.id));
      const toneDoc = selectedDocs.find((d) => d.purpose === "tone");
      const styleDoc = selectedDocs.find((d) => d.purpose === "style");

      const body = {
        prompt,
        tone: "professional",
        length: length.toLowerCase(),
        content_style: "thought_leadership",
        use_emoji: useEmoji,
        use_ai_image: true,
        count: postCount as number,
        ...(selectedModelId ? { writer_model: selectedModelId } : {}),
        ...(toneDoc ? { tone_document: toneDoc.id } : {}),
        ...(styleDoc ? { style_document: styleDoc.id } : {}),
      };
      return postsService(workspaceId).generatePosts(body);
    },
    {
      onSuccess: () => {
        queryClient.setQueryData(["posts-text-generating"], null);
        const draftQueries = queryClient.getQueriesData<{ count?: number }>({
          queryKey: ["posts", "draft", workspaceId, "manual"],
        });
        const baseline = draftQueries.reduce((max, [, data]) => Math.max(max, data?.count ?? 0), 0);
        queryClient.setQueryData(["posts-generating"], baseline);
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
        toast.success("Posts are being generated.");
        handleClose();
      },
      onError: (error: unknown) => {
        queryClient.setQueryData(["posts-text-generating"], null);
        if (error instanceof AxiosError) {
          const data = error.response?.data as Record<string, unknown> | undefined;
          if (data?.suggested_topics && Array.isArray(data.suggested_topics)) {
            setPromptError({
              prompt: typeof data.prompt === "string" ? data.prompt : "Prompt not covered.",
              suggested_topics: data.suggested_topics as string[],
            });
            return;
          }
        }
        toast.error(extractErrorMessage(error));
      },
    }
  );

  // Handlers
  const handleAddPersonaUrl = async () => {
    const trimmed = personaUrl.trim();
    if (!trimmed || !workspaceId) return;
    setPersonaUrlAdding(true);
    try {
      await websiteService(workspaceId).addWebsite(trimmed);
      setPersonaUrl("");
      queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setPersonaUrlAdding(false);
    }
  };

  const handleAddWebsite = async () => {
    const trimmed = websiteInput.trim();
    if (!trimmed || !workspaceId) return;
    setWebsiteAdding(true);
    try {
      await websiteService(workspaceId).addWebsite(trimmed);
      setWebsiteInput("");
      queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setWebsiteAdding(false);
    }
  };

  const handleDeleteWebsite = async (id: string) => {
    try {
      await websiteService(workspaceId).deleteWebsite(id);
      queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleAddDoc = async () => {
    if (!pendingDoc || !workspaceId) return;
    setDocUploading(true);
    try {
      const doc = await documentService(workspaceId).uploadDocument(pendingDoc, "knowledge");
      setPendingDoc(null);
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      if (doc?.id) setSelectedDocIds((prev) => new Set([...prev, doc.id]));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await documentService(workspaceId).deleteDocument(id);
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleAddPersonaDoc = async () => {
    if (!personaDoc || !workspaceId) return;
    setPersonaDocUploading(true);
    try {
      const doc = await documentService(workspaceId).uploadDocument(personaDoc, "tone");
      setPersonaDoc(null);
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      if (doc?.id) setSelectedDocIds((prev) => new Set([...prev, doc.id]));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setPersonaDocUploading(false);
    }
  };

  const handleGenerate = () => {
    if (postCount === "" || postCount < 1) {
      setPostCountError("Enter how many posts to generate.");
      return;
    }
    setPostCountError("");
    queryClient.setQueryData(["posts-text-generating"], Date.now());
    generateMutation.mutate(undefined);
  };

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Manual Mode"
      width="2xl"
      disableBackdropClose
      minHeight="480px"
    >
      <div className="space-y-3">
        {/* ── Accordion 1: Persona ── */}
        <Accordion title="Persona" open={personaOpen} onToggle={() => setPersonaOpen((v) => !v)}>
          {/* Profile link */}
          <div className="mb-4">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
              <LuLink className="h-3.5 w-3.5 text-blue-500" />
              Profile Link
            </p>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <LuLink className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={personaUrl}
                  onChange={(e) => setPersonaUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddPersonaUrl();
                  }}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleAddPersonaUrl}
                disabled={!personaUrl.trim() || personaUrlAdding}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {personaUrlAdding ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </button>
            </div>
          </div>

          {/* Persona documents (tone + style) */}
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
              <LuFileText className="h-3.5 w-3.5 text-blue-500" />
              Documents
            </p>
            {personaDocs.length > 0 && (
              <ul className="mb-1.5 space-y-1">
                {personaDocs.map((doc) => {
                  const processing = !isTerminal(doc.status);
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
                          onClick={() => handleDeleteDoc(doc.id)}
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
            <input
              ref={personaFileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPersonaDoc(file);
                e.target.value = "";
              }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => personaFileInputRef.current?.click()}
                disabled={personaDocUploading}
                className="flex flex-1 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-blue-400 disabled:opacity-50"
              >
                <LuUpload className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span
                  className={cn(
                    "truncate",
                    personaDoc ? "text-gray-800" : "text-gray-400 hover:text-blue-600"
                  )}
                >
                  {personaDoc ? personaDoc.name : "Choose PDF…"}
                </span>
              </button>
              <button
                onClick={handleAddPersonaDoc}
                disabled={!personaDoc || personaDocUploading}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {personaDocUploading ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </button>
            </div>
          </div>
        </Accordion>

        {/* ── Accordion 2: Knowledge Sources ── */}
        <Accordion
          title="Knowledge Sources"
          open={knowledgeOpen}
          onToggle={() => setKnowledgeOpen((v) => !v)}
        >
          {/* Websites */}
          <div className="mb-4">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
              <LuGlobe className="h-3.5 w-3.5 text-blue-500" />
              Websites
            </p>
            {websitesList.length > 0 && (
              <ul className="mb-1.5 space-y-1">
                {websitesList.map((site) => {
                  const crawling = !isTerminal(site.status);
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
                            site.status === "ready"
                              ? "bg-teal-100 text-teal-700"
                              : site.status === "error"
                                ? "bg-red-100 text-red-600"
                                : "bg-blue-100 text-blue-600"
                          )}
                        >
                          {site.status}
                        </span>
                        <button
                          onClick={() => handleDeleteWebsite(site.id)}
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
              <button
                onClick={handleAddWebsite}
                disabled={!websiteInput.trim() || websiteAdding}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {websiteAdding ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </button>
            </div>
          </div>

          {/* Knowledge documents */}
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
              <LuFileText className="h-3.5 w-3.5 text-blue-500" />
              Documents
            </p>
            {knowledgeDocs.length > 0 && (
              <ul className="mb-1.5 space-y-1">
                {knowledgeDocs.map((doc) => {
                  const processing = !isTerminal(doc.status);
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
                          onClick={() => handleDeleteDoc(doc.id)}
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPendingDoc(file);
                e.target.value = "";
              }}
            />
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
                  {pendingDoc ? pendingDoc.name : "Choose PDF…"}
                </span>
              </button>
              <button
                onClick={handleAddDoc}
                disabled={!pendingDoc || docUploading}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {docUploading ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </button>
            </div>
          </div>
        </Accordion>

        {/* ── Post settings (between accordion 2 and 3) ── */}
        <div className="grid grid-cols-3 gap-4 px-1 pt-1">
          {/* No. of posts */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              No. of posts <span className="text-red-400">*</span>
              <Tooltip
                text="How many LinkedIn posts to generate in one batch. Max 50."
                position="bottom"
              />
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={postCount}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setPostCount(val);
                if (val !== "" && (val as number) >= 1) setPostCountError("");
              }}
              placeholder="e.g. 5"
              className={cn(
                "h-9 w-full rounded-lg border bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1",
                postCountError
                  ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              )}
            />
            {postCountError && <p className="mt-1 text-xs text-red-500">{postCountError}</p>}
          </div>

          {/* Use Emoji */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Use Emoji
            </label>
            <div className="flex gap-1.5">
              {(["No", "Yes"] as const).map((opt) => {
                const active = opt === "Yes" ? useEmoji : !useEmoji;
                return (
                  <button
                    key={opt}
                    onClick={() => setUseEmoji(opt === "Yes")}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Length */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Length
            </label>
            <div className="flex gap-1.5">
              {LENGTH_OPTIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className={cn(
                    "flex h-9 w-full items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                    length === l
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Instruction ── */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Instruction <span className="font-normal normal-case text-gray-400">optional</span>
            <Tooltip
              text="Steer the AI towards a specific topic or angle. Leave blank to let it pick from your knowledge base."
              width="w-64"
            />
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Write about our new feature and tie it to customer wins. Avoid buzzwords."
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Prompt error */}
        {promptError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-sm text-amber-800">{promptError.prompt}</p>
              </div>
              <button
                onClick={() => setPromptError(null)}
                className="shrink-0 text-amber-400 hover:text-amber-600"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
            {promptError.suggested_topics.length > 0 && (
              <div className="ml-6 flex flex-wrap gap-2">
                {promptError.suggested_topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => {
                      setPrompt(topic);
                      setPromptError(null);
                    }}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(s);
                  setSuggestions([]);
                }}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-xs text-violet-700 hover:bg-violet-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => {
              if (!websitesList[0]) return;
              setSuggestions([]);
              suggestMutation.mutate(websitesList[0].id);
            }}
            disabled={suggestMutation.isPending || !websitesList.length}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-100 disabled:opacity-40"
          >
            <LuSparkles
              className={cn("h-3.5 w-3.5", suggestMutation.isPending && "animate-spin")}
            />
            {suggestMutation.isPending ? "Suggesting…" : "Suggest prompts"}
          </button>

          <div className="flex items-center gap-2">
            <ModelSwitcher dropUp />
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || postCount === ""}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <LuLoader className="h-4 w-4 animate-spin" />
              ) : (
                <LuSparkles className="h-4 w-4" />
              )}
              {generateMutation.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
