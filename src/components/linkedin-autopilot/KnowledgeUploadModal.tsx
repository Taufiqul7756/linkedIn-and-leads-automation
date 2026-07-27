"use client";
import { useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { LuUpload, LuLink, LuX, LuFileText } from "react-icons/lu";

type SourceType = "knowledge" | "tune" | "style";

interface UploadedItem {
  id: string;
  name: string;
  kind: "file" | "url";
  type: SourceType;
}

interface KnowledgeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: SourceType;
}

const TYPE_LABELS: Record<SourceType, string> = {
  knowledge: "Knowledge",
  tune: "Tune",
  style: "Style",
};

const TYPE_STYLES: Record<SourceType, string> = {
  knowledge: "bg-blue-100 text-blue-700",
  tune: "bg-violet-100 text-violet-700",
  style: "bg-teal-100 text-teal-700",
};

export default function KnowledgeUploadModal({
  isOpen,
  onClose,
  initialType = "knowledge",
}: KnowledgeUploadModalProps) {
  const [selectedType, setSelectedType] = useState<SourceType>(initialType);
  const [urlInput, setUrlInput] = useState("");
  const [items, setItems] = useState<UploadedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset initialType when modal opens with a different step
  // (handled via key prop on parent — no useEffect needed)

  const addFile = (file: File) => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: file.name, kind: "file", type: selectedType },
    ]);
    // API will come
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, kind: "url", type: selectedType },
    ]);
    setUrlInput("");
    // API will come
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") addFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addFile(file);
    e.target.value = "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Sources" width="lg">
      {/* Type selector */}
      <div className="mb-5">
        <label className="mb-2 block text-sm font-medium text-gray-700">Source type</label>
        <div className="flex gap-2">
          {(["knowledge", "tune", "style"] as SourceType[]).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                selectedType === t
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          {selectedType === "knowledge" &&
            "Upload documents or URLs that describe your business, products, or expertise."}
          {selectedType === "tune" &&
            "Upload content that defines your writing style and tone of voice."}
          {selectedType === "style" &&
            "Upload style guides, brand guidelines, or formatting references."}
        </p>
      </div>

      {/* PDF upload */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Upload PDF</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
          }`}
        >
          <LuUpload className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500">
            Drag & drop a PDF, or <span className="font-medium text-blue-600">browse</span>
          </p>
          <p className="text-xs text-gray-400">PDF files only</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* URL input */}
      <div className="mb-5">
        <label className="mb-2 block text-sm font-medium text-gray-700">Add URL</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LuLink className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              placeholder="https://example.com/page"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">Added sources</p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                {item.kind === "file" ? (
                  <LuFileText className="h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <LuLink className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{item.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TYPE_STYLES[item.type]}`}
                >
                  {TYPE_LABELS[item.type]}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 text-gray-300 transition-colors hover:text-red-400"
                >
                  <LuX className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onClose}
          disabled={items.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          Save sources
        </button>
      </div>
    </Modal>
  );
}
