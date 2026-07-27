"use client";
import { useEffect } from "react";
import { LuX } from "react-icons/lu";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  disableBackdropClose?: boolean;
  minHeight?: string;
  bodyClassName?: string;
}

const widthClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  width = "md",
  disableBackdropClose = false,
  minHeight,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || disableBackdropClose) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, disableBackdropClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
      />

      {/* Panel */}
      <div
        className={`relative flex w-full flex-col ${widthClass[width]} mx-4 max-h-[90vh] rounded-2xl bg-white shadow-xl`}
      >
        {/* Header — fixed */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div
          className={`overflow-y-auto px-6 py-5${bodyClassName ? ` ${bodyClassName}` : ""}`}
          style={minHeight ? { minHeight } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
