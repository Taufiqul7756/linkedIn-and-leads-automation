"use client";
import { useState } from "react";
import { LuRefreshCw, LuLoader, LuArrowDownToLine } from "react-icons/lu";
import { cn } from "@/utils/cn";
import Modal from "@/components/ui/Modal";

export interface RegeneratePostOptions {
  instruction: string;
  makeLonger: boolean;
}

interface RegeneratePostConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfirming?: boolean;
  onConfirm: (opts: RegeneratePostOptions) => void;
}

export default function RegeneratePostConfirmModal({
  isOpen,
  onClose,
  isConfirming = false,
  onConfirm,
}: RegeneratePostConfirmModalProps) {
  const [makeLonger, setMakeLonger] = useState(false);
  const [instruction, setInstruction] = useState("");

  const handleConfirm = () => {
    onConfirm({ instruction, makeLonger });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Regenerate Post" width="sm">
      <div className="space-y-4">
        {/* Make Longer toggle */}
        <button
          onClick={() => setMakeLonger((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
            makeLonger
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <LuArrowDownToLine
            className={cn("h-4 w-4 shrink-0", makeLonger ? "text-blue-500" : "text-gray-400")}
          />
          <div>
            <p className="text-sm font-medium">Make Longer</p>
            <p className="text-xs text-gray-400">Keeps existing content and appends new material</p>
          </div>
          <div
            className={cn(
              "ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
              makeLonger ? "border-blue-500 bg-blue-500" : "border-gray-300"
            )}
          />
        </button>

        {/* Instructions */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Instructions <span className="font-normal normal-case text-gray-400">optional</span>
          </label>
          <textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={
              makeLonger
                ? "e.g. Add a customer example at the end."
                : "e.g. Focus on the cost-saving angle and keep it concise."
            }
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-2.5">
        <button
          onClick={onClose}
          disabled={isConfirming}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={isConfirming}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
        >
          {isConfirming ? (
            <LuLoader className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LuRefreshCw className="h-3.5 w-3.5" />
          )}
          {isConfirming ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </Modal>
  );
}
