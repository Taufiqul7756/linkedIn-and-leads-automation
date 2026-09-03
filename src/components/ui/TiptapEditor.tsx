"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  LuBold,
  LuItalic,
  LuStrikethrough,
  LuList,
  LuListOrdered,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuQuote,
  LuCode,
  LuMinus,
  LuEraser,
  LuUndo2,
  LuRedo2,
} from "react-icons/lu";
import { cn } from "@/utils/cn";

interface Props {
  content: object | string;
  onChange: (json: object) => void;
  minHeight?: string;
  placeholder?: string;
}

export default function TiptapEditor({
  content,
  onChange,
  minHeight = "280px",
  placeholder = "Write something…",
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: content || "",
    onUpdate({ editor }) {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        "data-placeholder": placeholder,
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-gray-200 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-2 py-1.5">
        {/* History */}
        <Btn onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo">
          <LuUndo2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo">
          <LuRedo2 className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Text formatting */}
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <LuBold className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <LuItalic className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <LuStrikethrough className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Headings */}
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <LuHeading1 className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <LuHeading2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <LuHeading3 className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Lists */}
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <LuList className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <LuListOrdered className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Block */}
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <LuQuote className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          <LuCode className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Insert */}
        <Btn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          active={false}
          title="Horizontal rule"
        >
          <LuMinus className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Clear formatting */}
        <Btn
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          active={false}
          title="Clear formatting"
        >
          <LuEraser className="h-3.5 w-3.5" />
        </Btn>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="tiptap-body px-3.5 py-2.5 text-sm leading-relaxed text-gray-900"
      />
    </div>
  );
}

function Btn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100",
        active && "bg-blue-50 text-blue-600"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-4 w-px bg-gray-200" />;
}
