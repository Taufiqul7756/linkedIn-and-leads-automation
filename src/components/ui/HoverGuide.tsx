import { LuInfo } from "react-icons/lu";
import { cn } from "@/utils/cn";

interface HoverGuideProps {
  children: React.ReactNode;
  // On a dark header (e.g. `bg-sidebar-bg` card headers) — light icon
  onDark?: boolean;
  // Popover width when anchored to the icon (ignored with anchor="parent")
  width?: string;
  // "bottom" (default) opens below · "top" opens above
  position?: "top" | "bottom";
  // "icon" (default): popover starts at the icon.
  // "parent": popover spans the nearest `relative` ancestor edge to edge — use inside narrow
  // panels so it can't run past the panel's side.
  anchor?: "icon" | "parent";
}

// ⓘ info icon that opens an amber hover guide (multi-line content, unlike Tooltip)
export default function HoverGuide({
  children,
  onDark = false,
  width = "w-80",
  position = "bottom",
  anchor = "icon",
}: HoverGuideProps) {
  return (
    <span
      className={cn("group inline-flex cursor-help items-center", anchor === "icon" && "relative")}
    >
      <LuInfo
        className={cn(
          "h-4 w-4 transition-colors",
          onDark
            ? "text-white/70 group-hover:text-white"
            : "text-blue-500 group-hover:text-blue-600"
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute z-50 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-normal leading-relaxed text-amber-900 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100",
          anchor === "icon" ? cn("left-0", width) : "inset-x-0",
          position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
        )}
      >
        {children}
      </span>
    </span>
  );
}
