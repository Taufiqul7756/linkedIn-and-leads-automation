"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface LinkedInAvatarProps {
  pictureUrl?: string | null;
  name?: string;
  /** Size + shape classes, e.g. "h-11 w-11 rounded-full" */
  className?: string;
  /** Shown when there's no picture or it fails to load */
  fallback: ReactNode;
}

// The connected LinkedIn account's profile picture (`picture_url`), falling back
// to the caller's placeholder when the account has no picture or the URL breaks.
export default function LinkedInAvatar({
  pictureUrl,
  name,
  className,
  fallback,
}: LinkedInAvatarProps) {
  // Remember which URL failed so a new URL (reconnect) gets tried again
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!pictureUrl && pictureUrl !== failedSrc;

  return (
    <div className={cn("shrink-0 overflow-hidden", className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pictureUrl}
          alt={name ? `${name}'s LinkedIn photo` : "LinkedIn photo"}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(pictureUrl)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
