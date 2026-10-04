"use client";

import { useState } from "react";
import { LuImage } from "react-icons/lu";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import type { ImageRatioOption } from "@/types/ImageChat";

interface ImageRatioModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ImageRatioOption[];
  onSelect: (ratio: string) => void;
}

// Fallback preview when the API sends no image — a frame drawn in the option's ratio ("16:9" → 16/9)
function RatioFrame({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const isLandscape = (w || 1) >= (h || 1);
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded border border-gray-300 text-gray-300",
        isLandscape ? "w-3/4" : "h-3/4"
      )}
      style={{ aspectRatio: `${w || 1} / ${h || 1}` }}
    >
      <LuImage className="h-5 w-5" />
    </div>
  );
}

// API image shown whole (object-contain — a 16:9 image is not cropped by the square tile);
// falls back to the drawn frame when there is no image or it fails to load
function RatioPreview({ option }: { option: ImageRatioOption }) {
  const [failed, setFailed] = useState(false);
  if (!option.image || failed) return <RatioFrame ratio={option.ratio} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={option.image}
      alt={option.title}
      onError={() => setFailed(true)}
      className="h-full w-full object-contain"
    />
  );
}

export default function ImageRatioModal({
  isOpen,
  onClose,
  options,
  onSelect,
}: ImageRatioModalProps) {
  const active = options.find((o) => o.is_active);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Media Size" width="2xl">
      <p className="-mt-2 mb-5 text-sm text-gray-500">
        Choose the perfect dimensions for your image
      </p>

      <div className="mb-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-violet-700" />
        <h3 className="text-base font-semibold text-gray-900">LinkedIn Media Sizes</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {options.length} options
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.ratio}
            onClick={() => onSelect(o.ratio)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors",
              o.is_active
                ? "border-violet-700 bg-violet-50"
                : "border-gray-200 bg-white hover:border-violet-300"
            )}
          >
            <div className="mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-gray-700">
              <RatioPreview option={o} />
            </div>
            <span className="text-sm font-medium text-gray-800">{o.title}</span>
            <span className="text-xs text-gray-500">{o.size}</span>
            <span className="text-xs font-medium text-violet-700">{o.ratio}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-xs text-gray-500">
          {active ? `• Selected: ${active.title}` : "• No size selected"}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
