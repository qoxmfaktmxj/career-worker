"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Nav } from "@/components/nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <Nav />
      <main className="min-w-0 bg-white">{children}</main>
    </div>
  );
}
