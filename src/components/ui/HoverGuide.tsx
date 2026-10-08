import { LuInfo } from "react-icons/lu";
import { cn } from "@/utils/cn";

interface HoverGuideProps {
  children: React.ReactNode;
  // On a dark header (e.g. `bg-sidebar-bg` card headers) — light icon
  onDark?: boolean;
}

// ⓘ info icon that opens an amber hover guide (multi-line content, unlike Tooltip)
export default function HoverGuide({ children, onDark = false }: HoverGuideProps) {
  return (
    <span className="group relative inline-flex cursor-help items-center">
      <LuInfo
        className={cn(
          "h-4 w-4 transition-colors",
          onDark
            ? "text-white/70 group-hover:text-white"
            : "text-blue-500 group-hover:text-blue-600"
        )}
      />
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-normal leading-relaxed text-amber-900 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {children}
      </span>
    </span>
  );
}
