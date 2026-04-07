"use client";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  className = "",
}: MarkdownEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`min-h-[420px] w-full resize-y rounded-3xl border border-slate-200 bg-white p-5 font-mono text-sm leading-7 text-slate-800 shadow-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 ${className}`}
      spellCheck={false}
    />
  );
}
