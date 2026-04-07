"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: "홈" },
  { href: "/jobs", label: "공고", icon: "공고" },
  { href: "/sources", label: "수집원", icon: "수집" },
  { href: "/profile", label: "프로필", icon: "문서" },
  { href: "/outputs", label: "산출물", icon: "출력" },
];

export function Nav() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="border-r border-slate-200 bg-slate-950 text-slate-50 lg:w-64">
      <div className="sticky top-0 flex min-h-screen flex-col px-4 py-6">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            Career Worker
          </p>
          <h1 className="mt-2 text-xl font-semibold">채용 작업실</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            수집, 평가, 초안 생성을 한 화면에서 이어갑니다.
          </p>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl px-3 py-3 text-sm transition ${
                  active
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {item.icon}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
          <p className="font-medium text-slate-200">상태</p>
          <p className="mt-2">수집 파이프라인과 AI 액션을 순차적으로 확인하세요.</p>
        </div>
      </div>
    </aside>
  );
}
