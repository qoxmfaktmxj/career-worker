"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-[4px] border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[#fafbfc]"
    >
      {copied ? "\uBCF5\uC0AC\uB428" : "\uBCF5\uC0AC"}
    </button>
  );
}
