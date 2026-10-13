"use client";

import { useEffect, useRef, useState } from "react";
import { LuLoader, LuTrash2, LuUpload, LuX, LuFileText, LuPencil } from "react-icons/lu";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import Modal from "@/components/ui/Modal";
import HoverGuide from "@/components/ui/HoverGuide";
import { imageChatService } from "@/service/imageChatService";
import { refreshImageKnowledge, useImageKnowledgeList } from "@/hooks/useImageKnowledge";
import { cn } from "@/utils/cn";
import SourceIcon from "./SourceIcon";
import {
  isValidUrl,
  URL_ERROR,
  SourceLink,
  noteOrMessage,
  NoteInput,
  EditableNote,
  StatusBadge,
  SubsectionHeader,
  LoadingRow,
} from "./KnowledgeSourceParts";
import type { ImageKnowledgeSource } from "@/types/ImageChat";

// Backend cap for one free-hand text source. All sources switched on share 8,000 characters
// in the image prompt (oldest first — the newest is cut when over)
const TEXT_MAX = 8000;

// Display name for a source — PDF filename, URL, or the start of the text
function sourceTitle(s: ImageKnowledgeSource): string {
  if (s.kind === "pdf") return s.filename || s.name;
  if (s.kind === "url") return s.url || s.name;
  return s.text || s.name;
}

// ─── hover guides ─────────────────────────────────────────────────────────────

function ImageKnowledgeGuide() {
  return (
    <>
      <span className="block font-semibold">What is Image knowledge?</span>
      <span className="mt-1.5 block">
        Your brand guide for pictures — brand colours, fonts for text on images, logo rules and
        visual style. Every image the workspace makes follows the sources switched on — any number
        can be on at once.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Limit:</span> all sources switched on share 8,000 characters,
        oldest first — when over, the newest ones are cut off.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Tip:</span> switch sources on or off in the Image Agent
        chatbox → settings. A change applies to the next image; your own message always wins.
      </span>
    </>
  );
}

function LinkPdfGuide() {
  return (
    <>
      <span className="block font-semibold">Links and PDFs</span>
      <span className="mt-1.5 block">
        Paste the brand-guide page itself — a link is read as one page, the whole site is not
        crawled. PDFs must have real text: a scanned PDF reads empty.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Note for the agent:</span> e.g. &ldquo;Only use the colour
        palette&rdquo; or &ldquo;Follow the logo placement rules&rdquo;.
      </span>
    </>
  );
}

function TextGuide() {
  return (
    <>
      <span className="block font-semibold">Write it yourself</span>
      <span className="mt-1.5 block">
        Describe the look in your own words, e.g. &ldquo;Use only orange #FF6B00 and charcoal
        #1A1A1A, bold sans-serif headlines, lots of white space&rdquo;. Up to 8,000 characters.
      </span>
      <span className="mt-1.5 block">
        <span className="font-medium">Edit:</span> click the pencil on a text in Your sources — it
        opens here. Its on/off switch stays as it is.
      </span>
    </>
  );
}

// ─── row ──────────────────────────────────────────────────────────────────────

interface SourceRowProps {
  source: ImageKnowledgeSource;
  deleting: boolean;
  onRequestDelete: (source: ImageKnowledgeSource) => void;
  onSaveNote: (id: string, note: string) => Promise<boolean>;
  // Text sources only — this row's text is open in the Write it yourself box
  editing: boolean;
  onEditText: (source: ImageKnowledgeSource) => void;
}

function SourceRow({
  source,
  deleting,
  onRequestDelete,
  onSaveNote,
  editing,
  onEditText,
}: SourceRowProps) {
  const pending = source.status === "pending";
  const failed = source.status === "failed";
  const title = sourceTitle(source);
  return (
    <div
      className={cn(
        "border-b border-gray-100 py-3 last:border-0",
        pending && "animate-sweep -mx-2 rounded-lg bg-purple-50/60 px-2",
        editing && "-mx-2 rounded-lg bg-blue-50/60 px-2"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-12 shrink-0 items-center justify-center">
          <SourceIcon
            kind={source.kind === "url" ? "website" : source.kind}
            url={source.url}
            className="h-8 w-8"
          />
        </span>
        <div className="min-w-0 flex-1">
          {source.kind === "url" ? (
            <SourceLink
              href={source.url}
              className="text-sm font-medium text-gray-900 hover:text-blue-600"
            >
              {title}
            </SourceLink>
          ) : source.kind === "text" ? (
            <p className="line-clamp-2 whitespace-pre-line text-sm text-gray-900" title={title}>
              {title}
            </p>
          ) : (
            <p className="truncate text-sm font-medium text-gray-900" title={title}>
              {title}
            </p>
          )}
          {/* Free-hand text has no note — only links and PDFs */}
          {source.kind !== "text" && (
            <EditableNote note={source.label} onSave={(note) => onSaveNote(source.id, note)} />
          )}
        </div>
        {source.enabled && (
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">
            On
          </span>
        )}
        {pending && <LuLoader className="h-4 w-4 shrink-0 animate-spin text-purple-500" />}
        <StatusBadge status={source.status} />
        {source.kind === "text" && (
          <button
            onClick={() => onEditText(source)}
            disabled={editing}
            className="shrink-0 text-gray-300 transition-colors hover:text-blue-500 disabled:text-blue-500"
            title="Edit text"
          >
            <LuPencil className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onRequestDelete(source)}
          disabled={deleting}
          className="shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
          title="Remove"
        >
          {deleting ? (
            <LuLoader className="h-4 w-4 animate-spin" />
          ) : (
            <LuTrash2 className="h-4 w-4" />
          )}
        </button>
      </div>
      {failed && source.error && <p className="mt-1.5 text-xs text-red-500">{source.error}</p>}
    </div>
  );
}

// ─── add forms ────────────────────────────────────────────────────────────────

interface AddFormProps {
  workspaceId: string;
  onAdded: () => void;
}

// Link + ↳ note (appears once a link is typed), staged PDF + ↳ note — same as the Knowledge base
function AddLinkOrPdf({ workspaceId, onAdded }: AddFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  // Show the invalid-link message only after blur / an Add attempt, not while typing
  const [urlTouched, setUrlTouched] = useState(false);
  const [urlNote, setUrlNote] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<File | null>(null);
  const [docNote, setDocNote] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const urlError = urlTouched && !!url.trim() && !isValidUrl(url);

  const handleAddUrl = async () => {
    const value = url.trim();
    if (!value || !workspaceId) return;
    if (!isValidUrl(value)) {
      setUrlTouched(true);
      return;
    }
    setAddingUrl(true);
    try {
      await imageChatService(workspaceId).addImageKnowledge({
        url: value,
        label: urlNote.trim(),
      });
      setUrl("");
      setUrlTouched(false);
      setUrlNote("");
      onAdded();
      toast.success("Link added.");
    } catch (err) {
      toast.error(noteOrMessage(err));
    } finally {
      setAddingUrl(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported.");
      return;
    }
    setPendingDoc(file);
    setDocNote("");
  };

  const handleUploadPendingDoc = async () => {
    if (!pendingDoc || !workspaceId) return;
    setUploadingDoc(true);
    try {
      await imageChatService(workspaceId).uploadImageKnowledgePdf(pendingDoc, docNote.trim());
      setPendingDoc(null);
      setDocNote("");
      onAdded();
      toast.success("PDF uploaded.");
    } catch (err) {
      toast.error(noteOrMessage(err));
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <>
      <div className="space-y-2 rounded-lg border border-gray-200 p-3">
        <div>
          <input
            type="url"
            placeholder="Brand-guide page URL, e.g. acme.com/brand"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => url.trim() && setUrlTouched(true)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            aria-invalid={urlError}
            className={cn(
              "w-full rounded-lg border px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2",
              urlError
                ? "border-red-300 focus:border-red-400 focus:ring-red-400/20"
                : "border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
            )}
          />
          {urlError && <p className="mt-1 text-xs text-red-500">{URL_ERROR}</p>}
        </div>
        {url.trim() && (
          <>
            <NoteInput
              value={urlNote}
              onChange={setUrlNote}
              placeholder="How should images use this link? (optional)"
              onEnter={handleAddUrl}
            />
            <div className="flex animate-fade-in-up justify-end">
              <button
                onClick={handleAddUrl}
                disabled={!isValidUrl(url) || addingUrl}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {addingUrl && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
                Add link
              </button>
            </div>
          </>
        )}
      </div>

      {pendingDoc ? (
        // Staged PDF — add a note, then upload
        <div
          className={cn(
            "space-y-2 rounded-lg border border-purple-200 bg-purple-50/60 p-3",
            uploadingDoc && "animate-sweep"
          )}
        >
          <div className="flex items-center gap-2">
            <LuFileText className="h-4 w-4 shrink-0 text-purple-600" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
              {pendingDoc.name}
            </p>
            <button
              onClick={() => setPendingDoc(null)}
              disabled={uploadingDoc}
              className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
              title="Remove"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
          <NoteInput
            value={docNote}
            onChange={setDocNote}
            placeholder="How should images use this PDF? (optional)"
            onEnter={handleUploadPendingDoc}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingDoc(null)}
              disabled={uploadingDoc}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadPendingDoc}
              disabled={uploadingDoc}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadingDoc ? (
                <LuLoader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LuUpload className="h-3.5 w-3.5" />
              )}
              Upload
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 py-3 text-sm font-medium text-purple-700 transition-colors hover:border-purple-400 hover:bg-purple-100"
        >
          <LuUpload className="h-4 w-4 text-purple-600" />
          <span>Upload PDF</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

interface TextFormProps extends AddFormProps {
  // Text source being edited — the parent remounts this form (key) when it changes
  editing: ImageKnowledgeSource | null;
  onDoneEditing: () => void;
}

// Free-hand text — no note (the text itself says how to use it). Add a new one, or edit one
// picked from Your sources (PATCH { text }, its switch stays as it is).
function TextForm({ workspaceId, onAdded, editing, onDoneEditing }: TextFormProps) {
  const [text, setText] = useState(editing?.text ?? "");
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Opened for editing → bring the box into view, caret at the end
  useEffect(() => {
    if (!editing) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const el = textareaRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  const unchanged = !!editing && text.trim() === editing.text.trim();

  const handleSave = async () => {
    const value = text.trim();
    if (!value || !workspaceId || unchanged) return;
    setSaving(true);
    try {
      const svc = imageChatService(workspaceId);
      if (editing) {
        await svc.patchImageKnowledgeText(editing.id, value);
        onAdded();
        onDoneEditing();
        toast.success("Text updated.");
      } else {
        await svc.addImageKnowledge({ text: value });
        setText("");
        onAdded();
        toast.success("Text added.");
      }
    } catch (err) {
      toast.error(noteOrMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "space-y-2 rounded-lg border p-3",
        editing ? "border-blue-200 bg-blue-50/60" : "border-gray-200"
      )}
    >
      {editing && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
          <LuPencil className="h-3 w-3" />
          Editing a text source
        </p>
      )}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={4}
          placeholder="Describe your brand's look — colours, fonts, logo rules, visual style…"
          value={text}
          maxLength={TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3.5 py-2 pb-6 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
        {text && (
          <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-gray-400">
            {text.length.toLocaleString()}/{TEXT_MAX.toLocaleString()}
          </span>
        )}
      </div>
      {(text.trim() || editing) && (
        <div className="flex animate-fade-in-up justify-end gap-2">
          {editing && (
            <button
              onClick={onDoneEditing}
              disabled={saving}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !text.trim() || unchanged}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Save changes" : "Add text"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export default function ImageKnowledgeModal({ isOpen, onClose, workspaceId }: Props) {
  const queryClient = useQueryClient();
  const { sources, isLoading } = useImageKnowledgeList(workspaceId, isOpen);
  const [confirmTarget, setConfirmTarget] = useState<ImageKnowledgeSource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<ImageKnowledgeSource | null>(null);

  const refresh = () => refreshImageKnowledge(queryClient, workspaceId);

  // Note = backend `label` — the only field a source can change
  const saveNote = async (id: string, note: string): Promise<boolean> => {
    try {
      await imageChatService(workspaceId).patchImageKnowledgeLabel(id, note);
      refresh();
      return true;
    } catch (err) {
      toast.error(noteOrMessage(err));
      return false;
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    setConfirmTarget(null);
    setDeletingId(id);
    // Deleting the text that is open for editing closes the edit
    if (editingText?.id === id) setEditingText(null);
    try {
      await imageChatService(workspaceId).deleteImageKnowledge(id);
      refresh();
      toast.success("Source removed.");
    } catch (err) {
      toast.error(noteOrMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Image knowledge base" width="4xl">
      <div className="mb-4 rounded-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-sidebar-bg px-4 py-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white">Brand guide for images</p>
            <HoverGuide onDark>
              <ImageKnowledgeGuide />
            </HoverGuide>
          </div>
          {sources.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-800">
              {sources.length}
            </span>
          )}
        </div>

        {/* ── Link / PDF, each with an optional note ── */}
        <div className="space-y-2 border-b border-gray-100 p-4">
          <SubsectionHeader title="Link or PDF" tip={<LinkPdfGuide />} />
          <AddLinkOrPdf workspaceId={workspaceId} onAdded={refresh} />
        </div>

        {/* ── Free-hand text (no note) ── */}
        <div className="space-y-2 border-b border-gray-100 p-4">
          <SubsectionHeader title="Write it yourself" tip={<TextGuide />} />
          <TextForm
            key={editingText?.id ?? "new"}
            workspaceId={workspaceId}
            onAdded={refresh}
            editing={editingText}
            onDoneEditing={() => setEditingText(null)}
          />
        </div>

        {/* ── Sources, oldest first ── */}
        <div className="space-y-2 p-4">
          <SubsectionHeader title="Your sources" />
          {isLoading ? (
            <LoadingRow />
          ) : sources.length > 0 ? (
            <div>
              {sources.map((s) => (
                <SourceRow
                  key={s.id}
                  source={s}
                  deleting={deletingId === s.id}
                  onRequestDelete={setConfirmTarget}
                  onSaveNote={saveNote}
                  editing={editingText?.id === s.id}
                  onEditText={setEditingText}
                />
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-gray-400">
              Nothing added yet — add a link, a PDF or write it yourself.
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          {sources.length} {sources.length === 1 ? "source" : "sources"} ·{" "}
          {sources.filter((s) => s.enabled).length} on
        </p>
        <button
          onClick={onClose}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Done
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Remove source"
        width="sm"
        disableBackdropClose
      >
        <p className="text-sm text-gray-600">Are you sure you want to remove</p>
        <p className="mt-1.5 line-clamp-3 break-all text-sm font-medium text-red-600">
          {confirmTarget ? sourceTitle(confirmTarget) : ""}
        </p>
        <p className="mt-2 text-sm text-gray-600">This cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={() => setConfirmTarget(null)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Remove
          </button>
        </div>
      </Modal>
    </Modal>
  );
}
