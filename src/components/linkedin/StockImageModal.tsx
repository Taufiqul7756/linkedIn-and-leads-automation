"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  LuArrowLeft,
  LuExternalLink,
  LuLoader,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuX,
} from "react-icons/lu";
import Modal from "@/components/ui/Modal";
import { useQueryWithTokenRefresh } from "@/hooks/useQueryWithTokenRefresh";
import { imageChatService } from "@/service/imageChatService";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { cn } from "@/utils/cn";
import type { StockPhoto } from "@/types/ImageChat";

// Search as the user types, after this pause
const SEARCH_DEBOUNCE_MS = 400;
// Backend limits for stock/search/
const SEARCH_MAX_LENGTH = 200;
const SEARCH_MAX_PAGE = 100;
const SKELETON_COUNT = 9;

interface StockImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  chatId: string;
  // PATCHes the post; the parent closes the modal on success
  onAdd: (photo: StockPhoto) => Promise<void>;
}

// Closes only via the ✕ button — no backdrop click, no ESC.
// The browser mounts only while open, so every open starts with a fresh search.
export default function StockImageModal({
  isOpen,
  onClose,
  workspaceId,
  chatId,
  onAdd,
}: StockImageModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stock images" width="4xl" disableBackdropClose>
      <StockImageBrowser workspaceId={workspaceId} chatId={chatId} onAdd={onAdd} />
    </Modal>
  );
}

// ─── Browser (search + grid + preview) ────────────────────────────────────────

function StockImageBrowser({
  workspaceId,
  chatId,
  onAdd,
}: Omit<StockImageModalProps, "isOpen" | "onClose">) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState(""); // debounced, trimmed — "" shows the recommended grid
  const [previewPhoto, setPreviewPhoto] = useState<StockPhoto | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const isSearching = query !== "";

  const recommended = useQueryWithTokenRefresh(
    ["stock-recommended", workspaceId, chatId],
    () => imageChatService(workspaceId).getStockRecommended(chatId),
    // backend caches 24h and re-searches when hashtags change — always ask it
    { enabled: !!chatId, staleTime: 0, retry: false }
  );

  const search = useInfiniteQuery({
    queryKey: ["stock-search", workspaceId, chatId, query],
    queryFn: ({ pageParam }) => imageChatService(workspaceId).searchStock(chatId, query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.has_more && last.page < SEARCH_MAX_PAGE ? last.page + 1 : undefined,
    enabled: isSearching && !!chatId,
    retry: false,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = search;

  // Infinite scroll — load the next page when the sentinel below the grid comes into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !isSearching || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSearching, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const photos = isSearching
    ? (search.data?.pages.flatMap((p) => p.photos) ?? [])
    : (recommended.data?.photos ?? []);
  const isLoading = isSearching ? search.isLoading : recommended.isLoading;
  const error = isSearching ? search.error : recommended.error;
  const recommendedQuery = recommended.data?.query ?? "";

  async function handleAdd(photo: StockPhoto) {
    if (addingId !== null) return;
    setAddingId(photo.id);
    try {
      await onAdd(photo);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          value={input}
          maxLength={SEARCH_MAX_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter searches right away instead of waiting for the debounce
            if (e.key === "Enter") setQuery(input.trim());
          }}
          placeholder={recommendedQuery || "Search for a photo"}
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
        />
        {input && (
          <button
            onClick={() => {
              setInput("");
              setQuery("");
            }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Section label */}
      {!error && (isSearching || recommendedQuery) && (
        <p className="text-xs font-medium text-gray-500">
          {isSearching ? (
            <>
              Results for <span className="text-gray-800">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            <>
              Recommended for this post ·{" "}
              <span className="text-gray-800">&ldquo;{recommendedQuery}&rdquo;</span>
            </>
          )}
        </p>
      )}

      {/* Grid / states */}
      {error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="max-w-sm text-sm text-gray-600">{extractErrorMessage(error)}</p>
          <button
            onClick={() => void (isSearching ? search.refetch() : recommended.refetch())}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <LuRefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {isSearching
            ? `No photos found for '${query}'.`
            : "Search for a photo to add to your post."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <StockPhotoCard
                key={photo.id}
                photo={photo}
                isAdding={addingId === photo.id}
                disabled={addingId !== null}
                onPreview={() => setPreviewPhoto(photo)}
                onAdd={() => void handleAdd(photo)}
              />
            ))}
          </div>
          {isSearching && (
            <div ref={sentinelRef} className="flex justify-center py-2">
              {isFetchingNextPage && <LuLoader className="h-5 w-5 animate-spin text-gray-400" />}
            </div>
          )}
        </>
      )}

      {/* Large preview — closes only via ✕ / Back, like the modal itself */}
      {previewPhoto && (
        <StockPhotoPreview
          photo={previewPhoto}
          isAdding={addingId === previewPhoto.id}
          disabled={addingId !== null}
          onClose={() => setPreviewPhoto(null)}
          onAdd={() => void handleAdd(previewPhoto)}
        />
      )}
    </div>
  );
}

// ─── Grid card — click to preview, hover shows Add to post ────────────────────

function StockPhotoCard({
  photo,
  isAdding,
  disabled,
  onPreview,
  onAdd,
}: {
  photo: StockPhoto;
  isAdding: boolean;
  disabled: boolean;
  onPreview: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      title={photo.alt || undefined}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter") onPreview();
      }}
      className="group relative aspect-video cursor-zoom-in overflow-hidden rounded-xl bg-gray-100"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnail_url}
        alt={photo.alt || "Stock photo"}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between bg-black/40 p-2 transition-opacity",
          isAdding ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <span className="truncate text-xs text-white/90">{photo.photographer}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          disabled={disabled}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-sidebar-dark shadow-md transition hover:bg-white/90 disabled:opacity-60"
        >
          {isAdding ? (
            <LuLoader className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LuPlus className="h-3.5 w-3.5" />
          )}
          Add to post
        </button>
      </div>
    </div>
  );
}

// ─── Large preview ────────────────────────────────────────────────────────────

function StockPhotoPreview({
  photo,
  isAdding,
  disabled,
  onClose,
  onAdd,
}: {
  photo: StockPhoto;
  isAdding: boolean;
  disabled: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    // fixed inside the modal's stacking context, painted above the panel
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative flex items-center justify-center bg-gray-900">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LuLoader className="h-6 w-6 animate-spin text-white/60" />
            </div>
          )}
          {/* thumbnail shows instantly; the full-size url replaces it once loaded */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={loaded ? photo.url : photo.thumbnail_url}
            alt={photo.alt || "Stock photo"}
            className="block h-auto max-h-(--lightbox-image-max-h) w-auto max-w-full"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" onLoad={() => setLoaded(true)} className="hidden" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 shadow-md transition hover:bg-gray-100"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            {photo.alt && <p className="truncate text-sm text-gray-800">{photo.alt}</p>}
            <p className="flex items-center gap-1 text-xs text-gray-500">
              Photo by {photo.photographer} on{" "}
              <a
                href={photo.pexels_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-violet-600 hover:underline"
              >
                Pexels
                <LuExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <LuArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <button
              onClick={onAdd}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              {isAdding ? (
                <LuLoader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LuPlus className="h-3.5 w-3.5" />
              )}
              Add to post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
