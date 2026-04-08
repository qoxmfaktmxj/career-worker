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
      className={`focus-accent font-data min-h-[560px] w-full resize-y rounded-[4px] border border-[var(--border)] bg-white p-6 text-[14px] leading-7 text-[var(--foreground)] outline-none ${className}`}
      spellCheck={false}
    />
  );
}
