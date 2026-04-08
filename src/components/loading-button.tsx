"use client";

import { useState } from "react";

interface LoadingButtonProps {
  onClick: () => Promise<void>;
  label: string;
  loadingLabel: string;
  className?: string;
}

export function LoadingButton({
  onClick,
  label,
  loadingLabel,
  className = "",
}: LoadingButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);

    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`h-10 rounded-[4px] border border-transparent px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
