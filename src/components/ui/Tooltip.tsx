"use client";
import { LuInfo } from "react-icons/lu";
import { cn } from "@/utils/cn";

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
  width?: string;
  position?: "top" | "bottom";
  /** "center" (default) centers on icon · "left" expands rightward · "right" expands leftward */
  align?: "center" | "left" | "right";
}

export default function Tooltip({
  text,
  children,
  width = "w-56",
  position = "top",
  align = "center",
}: TooltipProps) {
  const horizontal =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  const arrowHorizontal =
    align === "left" ? "left-3" : align === "right" ? "right-3" : "left-1/2 -translate-x-1/2";

  return (
    <span className="group relative inline-flex cursor-help items-center">
      {children ?? (
        <LuInfo className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-gray-600" />
      )}
      <span
        className={cn(
          "pointer-events-none absolute z-50 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100",
          width,
          horizontal,
          position === "top" && "bottom-full mb-2",
          position === "bottom" && "top-full mt-2"
        )}
      >
        {text}
        {position === "top" ? (
          <span
            className={cn(
              "absolute top-full border-4 border-transparent border-t-gray-900",
              arrowHorizontal
            )}
          />
        ) : (
          <span
            className={cn(
              "absolute bottom-full border-4 border-transparent border-b-gray-900",
              arrowHorizontal
            )}
          />
        )}
      </span>
    </span>
  );
}
