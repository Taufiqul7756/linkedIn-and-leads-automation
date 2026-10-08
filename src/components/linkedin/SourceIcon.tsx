import { LuFileText, LuGlobe } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import { cn } from "@/utils/cn";

export type SourceIconKind = "pdf" | "website" | "linkedin";

// Rounded tile + glyph per source kind
const STYLE: Record<SourceIconKind, { Icon: React.ElementType; tile: string; label: string }> = {
  pdf: { Icon: LuFileText, tile: "bg-red-50 text-red-500 ring-red-100", label: "PDF" },
  website: { Icon: LuGlobe, tile: "bg-sky-50 text-sky-600 ring-sky-100", label: "Website" },
  linkedin: { Icon: FaLinkedinIn, tile: "bg-linkedin text-white ring-linkedin", label: "LinkedIn" },
};

interface SourceIconProps {
  kind: SourceIconKind;
  // Tailwind size classes for the tile, e.g. "h-5 w-5" or "h-8 w-8" — the glyph scales with it
  className?: string;
  // Source URL — a "website" on linkedin.com (e.g. a LinkedIn post) gets the LinkedIn icon
  url?: string;
}

const isLinkedInUrl = (url: string) => /(^|\/\/|\.)linkedin\.com\b/i.test(url);

// Knowledge / tone source icon (PDF, website, LinkedIn)
export default function SourceIcon({ kind: rawKind, className = "h-5 w-5", url }: SourceIconProps) {
  const kind: SourceIconKind =
    rawKind === "website" && url && isLinkedInUrl(url) ? "linkedin" : rawKind;
  const { Icon, tile, label } = STYLE[kind];
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
        tile,
        className
      )}
    >
      <Icon className="h-3/5 w-3/5" />
    </span>
  );
}
