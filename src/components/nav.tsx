"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/jobs", label: "Jobs" },
  { href: "/sources", label: "Sources" },
  { href: "/profile", label: "Profile" },
  { href: "/outputs", label: "Outputs" },
];

export function Nav() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="border-r border-[var(--border)] bg-white text-[var(--foreground)]">
      <div className="sticky top-0 flex min-h-screen flex-col">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <Image
              src="/duck-mark.png"
              alt="오리 아이콘"
              width={20}
              height={20}
              className="h-5 w-5"
            />
            <h1 className="font-heading text-[15px] font-semibold text-[var(--foreground)]">
              채용 작업실
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2">
          {NAV_ITEMS.map((item, index) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex h-9 items-center justify-between rounded-[4px] px-3 text-sm transition ${
                  active
                    ? "bg-[var(--border)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[#fafbfc] hover:text-[var(--foreground)]"
                }`}
              >
                <span className="text-[13px] font-medium">{item.label}</span>
                <span
                  className={`font-data text-[11px] ${
                    active ? "text-[var(--muted-foreground)]" : "text-[#b1b6bd]"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] px-5 py-4">
          <p className="font-caption text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            LOCAL MODE
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
            연결 사용이 기본으로 꺼져
            <br />
            있는 작업 모드입니다.
          </p>
        </div>
      </div>
    </aside>
  );
}
