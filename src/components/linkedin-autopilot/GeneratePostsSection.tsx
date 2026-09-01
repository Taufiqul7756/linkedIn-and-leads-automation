"use client";
import { useState, useEffect, useRef } from "react";
import {
  LuSparkles,
  LuArrowRight,
  LuX,
  LuTriangleAlert,
  LuLink,
  LuGlobe,
  LuFileText,
  LuLoader,
  LuUpload,
} from "react-icons/lu";
import Tooltip from "@/components/ui/Tooltip";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { cn } from "@/utils/cn";
import { postsService } from "@/service/postsService";
import { websiteService } from "@/service/websiteService";
import { documentService } from "@/service/documentService";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import ModelSwitcher, { useSelectedModel } from "./ModelSwitcher";

const LENGTH_OPTIONS = ["Short", "Medium", "Long"] as const;
type Length = (typeof LENGTH_OPTIONS)[number];

const PURPOSE_COLORS: Record<string, string> = {
  knowledge: "bg-gray-100 text-gray-600",
  tone: "bg-purple-100 text-purple-700",
  style: "bg-orange-100 text-orange-700",
};
const PURPOSE_LABELS: Record<string, string> = {
  knowledge: "Knowledge",
  tone: "Tone",
  style: "Style",
};

const isTerminal = (s: string) => s === "ready" || s === "error" || s === "failed";

export default function GeneratePostsSection() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [url, setUrl] = useState("");
  const [postCount, setPostCount] = useState<number | "">("");
  const [postCountError, setPostCountError] = useState("");
  const [useEmoji, setUseEmoji] = useState(false);
  const [length, setLength] = useState<Length>("Medium");
  const [prompt, setPrompt] = useState("");
  const selectedModelId = useSelectedModel();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [promptError, setPromptError] = useState<{
    prompt: string;
    suggested_topics: string[];
  } | null>(null);

  // Knowledge sources state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<Set<string>>(new Set());
  const [websiteInput, setWebsiteInput] = useState("");
  const [websiteAdding, setWebsiteAdding] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);

  // Queries
  const { data: websitesData } = useQueryWithTokenRefresh(
    ["websites", workspaceId],
    () => websiteService(workspaceId).getWebsites(),
    {
      enabled: !!workspaceId,
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
      enabled: !!workspaceId,
      refetchInterval: (query) => {
        const results = query.state.data?.results ?? [];
        return results.some((d) => !isTerminal(d.status)) ? 3000 : false;
      },
    }
  );

  const websitesList = websitesData?.results ?? [];
  const docsList = allDocs?.results ?? [];

  // Auto-select all ready items on first load
  useEffect(() => {
    if (!websitesList.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedWebsiteIds(
      new Set(websitesList.filter((s) => s.status === "ready").map((s) => s.id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websitesList.length]);

  useEffect(() => {
    if (!docsList.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDocIds(new Set(docsList.filter((d) => d.status === "ready").map((d) => d.id)));
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
      const trimmedUrl = url.trim();
      return trimmedUrl
        ? postsService(workspaceId).generatePostsFromLink({ ...body, url: trimmedUrl })
        : postsService(workspaceId).generatePosts(body);
    },
    {
      onSuccess: () => {
        queryClient.setQueryData(["posts-text-generating"], null);
        toast.success("Posts created — generating images in the background.");
        setUrl("");
        setPrompt("");
        setSuggestions([]);
        setPromptError(null);
        const draftQueries = queryClient.getQueriesData<{ count?: number }>({
          queryKey: ["posts", "draft", workspaceId, "manual"],
        });
        const baseline = draftQueries.reduce((max, [, data]) => Math.max(max, data?.count ?? 0), 0);
        queryClient.setQueryData(["posts-generating"], baseline);
        queryClient.invalidateQueries({ queryKey: ["posts", "draft", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["post-stats", workspaceId] });
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
  const handleAddWebsite = async () => {
    const trimmed = websiteInput.trim();
    if (!trimmed || !workspaceId) return;
    setWebsiteAdding(true);
    try {
      const site = await websiteService(workspaceId).addWebsite(trimmed);
      setWebsiteInput("");
      queryClient.invalidateQueries({ queryKey: ["websites", workspaceId] });
      if (site?.id) setSelectedWebsiteIds((prev) => new Set([...prev, site.id]));
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
      setSelectedWebsiteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  const handleSuggest = () => {
    if (!websitesList[0]) return;
    setSuggestions([]);
    suggestMutation.mutate(websitesList[0].id);
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

  const canAct = !!workspaceId;

  return (
    <div className="rounded-xl border border-[#D8DCF0] bg-gradient-to-b from-[#ECEEF8] to-white px-6 py-5">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
          <LuSparkles className="h-4 w-4 text-blue-600" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900">
          Generate posts from your knowledge base
        </h2>
      </div>

      {/* Knowledge Sources — inline, mirrors agent modal */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Knowledge Sources
          </p>
          <Tooltip
            text="Select which websites and documents to use when generating posts. Tone and Style documents shape the writing voice and format."
            width="w-72"
            position="bottom"
          />
        </div>

        {/* Websites */}
        <div className="mb-3">
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
                      crawling ? "animate-shimmer-card border-blue-200" : "border-gray-200 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedWebsiteIds.has(site.id)}
                        onChange={(e) => {
                          setSelectedWebsiteIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(site.id);
                            else next.delete(site.id);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 shrink-0 rounded accent-blue-600"
                      />
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

        {/* Documents */}
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-600">
            <LuFileText className="h-3.5 w-3.5 text-blue-500" />
            Documents
          </p>
          {docsList.length > 0 && (
            <ul className="mb-1.5 space-y-1">
              {docsList.map((doc) => {
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
                      <input
                        type="checkbox"
                        checked={selectedDocIds.has(doc.id)}
                        onChange={(e) => {
                          setSelectedDocIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(doc.id);
                            else next.delete(doc.id);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 shrink-0 rounded accent-blue-600"
                      />
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
      </div>

      {/* Generation options */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Number of posts */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Number of posts <span className="text-red-400">*</span>
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
            <Tooltip text="Whether to include emojis in the generated posts." position="bottom" />
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
            <Tooltip
              text="Target post length. Short ≈ 150 words, Medium ≈ 300 words, Long ≈ 500 words."
              position="bottom"
            />
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

      {/* Source URL */}
      <div className="mt-4">
        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Source URL <span className="font-normal normal-case text-gray-400">optional</span>
          <Tooltip text="Generate posts specifically about this URL — e.g. a blog post, product page, or case study. Leave blank to use your full knowledge base." />
        </label>
        <div className="relative">
          <LuLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Custom prompt */}
      <div className="mt-4">
        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Custom prompt <span className="font-normal normal-case text-gray-400">optional</span>
          <Tooltip
            text="Steer the AI towards a specific topic, angle, or message. Leave blank to let it pick from your knowledge base."
            width="w-64"
          />
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. Write about our new WhatsApp auto-send feature and tie it to reply-rate wins. Mention our 30-minute follow-up window. Avoid buzzwords."
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Prompt not covered error */}
      {promptError && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-800">{promptError.prompt}</p>
            </div>
            <button
              onClick={() => setPromptError(null)}
              className="shrink-0 text-amber-400 transition-colors hover:text-amber-600"
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
                  className="rounded-lg border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
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
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setPrompt(s);
                setSuggestions([]);
              }}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-xs text-violet-700 transition-colors hover:bg-violet-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={handleSuggest}
          disabled={suggestMutation.isPending}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-100 disabled:opacity-40",
            !canAct && "opacity-40"
          )}
        >
          <LuSparkles className={cn("h-3.5 w-3.5", suggestMutation.isPending && "animate-spin")} />
          {suggestMutation.isPending ? "Suggesting…" : "Suggest prompts"}
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <p className="text-xs text-gray-400">
            Posts are generated as drafts and won&apos;t publish until you approve them.
          </p>
          <div className="flex items-center gap-2">
            <ModelSwitcher />
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || postCount === ""}
              className={cn(
                "flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:self-auto",
                !canAct && "opacity-50"
              )}
            >
              <LuArrowRight className="h-4 w-4" />
              {generateMutation.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
