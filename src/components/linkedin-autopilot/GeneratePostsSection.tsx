"use client";
import { useState } from "react";
import { LuSparkles, LuArrowRight, LuX, LuTriangleAlert, LuLink } from "react-icons/lu";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { cn } from "@/utils/cn";
import { postsService } from "@/service/postsService";
import { websiteService } from "@/service/websiteService";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { useMutationWithTokenRefresh } from "@/hooks/useMutationWithTokenRefresh";
import { useWorkspace } from "@/context/WorkspaceContext";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import AddUrlModal from "./AddUrlModal";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "bold", label: "Bold / Contrarian" },
  { value: "storytelling", label: "Storytelling" },
];
const LENGTH_OPTIONS = ["Short", "Medium", "Long"] as const;
const CONTENT_STYLES = [
  "Thought leadership",
  "Case study",
  "How-to",
  "Bold take",
  "Storytelling",
  "Product update",
];

type Length = (typeof LENGTH_OPTIONS)[number];

export default function GeneratePostsSection() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const [addUrlOpen, setAddUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [postCount, setPostCount] = useState<number | "">("");
  const [postCountError, setPostCountError] = useState("");
  const [tone, setTone] = useState("professional");
  const [useEmoji, setUseEmoji] = useState(false);
  const [length, setLength] = useState<Length>("Medium");
  const [contentStyle, setContentStyle] = useState("Thought leadership");
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [promptError, setPromptError] = useState<{
    prompt: string;
    suggested_topics: string[];
  } | null>(null);

  const { data: websites } = useQueryWithTokenRefresh(
    ["websites", workspaceId],
    () => websiteService(workspaceId).getWebsites(),
    { enabled: !!workspaceId }
  );
  const website = websites?.results?.[0];

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
      const body = {
        prompt,
        tone,
        length: length.toLowerCase(),
        content_style: contentStyle.toLowerCase().replace(/\s+/g, "_"),
        use_emoji: useEmoji,
        use_ai_image: true,
        count: postCount as number,
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
        const cached = queryClient.getQueryData(["posts", "draft", workspaceId]) as
          { count?: number } | undefined;
        queryClient.setQueryData(["posts-generating"], cached?.count ?? 0);
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

  const handleSuggest = () => {
    if (!website) {
      toast("Please add a website or document to your knowledge base first.", { icon: "📚" });
      setAddUrlOpen(true);
      return;
    }
    setSuggestions([]);
    suggestMutation.mutate(website.id);
  };

  const handleGenerate = () => {
    if (!website) {
      toast("Please add a website or document to your knowledge base first.", { icon: "📚" });
      setAddUrlOpen(true);
      return;
    }
    if (postCount === "" || postCount < 1) {
      setPostCountError("Enter how many posts to generate.");
      return;
    }
    setPostCountError("");
    queryClient.setQueryData(["posts-text-generating"], Date.now());
    generateMutation.mutate(undefined);
  };

  const canAct = !!website && !!workspaceId;

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-5">
        {/* Number of posts */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Number of posts <span className="text-red-400">*</span>
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

        {/* Tone */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Use Emoji */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
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
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
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

        {/* Content style */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Content style
          </label>
          <select
            value={contentStyle}
            onChange={(e) => setContentStyle(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {CONTENT_STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Source URL */}
      <div className="mt-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Source URL{" "}
          <span className="font-normal normal-case text-gray-400">
            optional — generate posts from a specific page or article
          </span>
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
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Custom prompt{" "}
          <span className="font-normal normal-case text-gray-400">
            optional — steer the angle, topic, or offer to feature
          </span>
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

      <AddUrlModal isOpen={addUrlOpen} onClose={() => setAddUrlOpen(false)} />
    </div>
  );
}
