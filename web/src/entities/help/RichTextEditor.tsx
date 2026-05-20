// entities/help/RichTextEditor.tsx
"use client";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={[
        "px-2 py-1 rounded text-sm leading-none select-none transition-colors",
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const Divider = () => <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-0.5 self-center" />;

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export function RichTextEditor({ value, onChange }: Props) {
  const [sourceMode, setSourceMode] = React.useState(false);
  const [sourceHtml, setSourceHtml] = React.useState(value);

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      setSourceHtml(html);
      onChange(html);
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", false);
      setSourceHtml(value || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commitSource = () => {
    if (!editor) return;
    editor.commands.setContent(sourceHtml, false);
    onChange(sourceHtml);
  };

  if (!editor) return <div className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />;

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 dark:border-slate-700 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/60">
        {!sourceMode && (
          <>
            <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
              <strong>B</strong>
            </Btn>
            <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
              <em>I</em>
            </Btn>
            <Divider />
            <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">H1</Btn>
            <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">H2</Btn>
            <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">H3</Btn>
            <Divider />
            <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">• —</Btn>
            <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered list">1.</Btn>
            <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">"</Btn>
            <Divider />
            <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</Btn>
          </>
        )}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            if (sourceMode) commitSource();
            setSourceMode((x) => !x);
          }}
          title={sourceMode ? "Apply HTML and return to editor" : "View/edit raw HTML source"}
          className={[
            "ml-auto px-2 py-1 rounded text-xs font-mono select-none transition-colors",
            sourceMode
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700",
          ].join(" ")}
        >
          {sourceMode ? "Apply HTML" : "</>"}
        </button>
      </div>

      {/* Content */}
      {sourceMode ? (
        <textarea
          className="w-full flex-1 px-4 py-3 text-sm font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
          rows={13}
          value={sourceHtml}
          onChange={(e) => setSourceHtml(e.currentTarget.value)}
          spellCheck={false}
        />
      ) : (
        <EditorContent
          editor={editor}
          className={[
            "bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200",
            "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[220px]",
            "[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h1]:mb-1",
            "[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1",
            "[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-0.5",
            "[&_.ProseMirror_p]:my-1.5",
            "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:my-1.5",
            "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:my-1.5",
            "[&_.ProseMirror_li]:my-0.5",
            "[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:dark:border-slate-600 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-slate-500 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:my-2",
            "[&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_em]:italic",
            "[&_.ProseMirror_code]:bg-slate-100 [&_.ProseMirror_code]:dark:bg-slate-800 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-xs",
          ].join(" ")}
        />
      )}
    </div>
  );
}

export default RichTextEditor;
