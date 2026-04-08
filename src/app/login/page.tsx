"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("비밀번호가 맞지 않습니다.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1280px] lg:grid-cols-[1fr_1fr]">
        <section className="hidden px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="font-data text-[11px] uppercase tracking-[0.22em] text-[#4a9fd8]">
              Career Worker
            </p>
            <h1 className="font-heading mt-4 text-[56px] font-semibold tracking-[-0.04em]">
              채용 작업실
            </h1>
            <p className="mt-5 max-w-[520px] text-[16px] leading-8 text-[#b5b5b5]">
              공고를 모으고, 판단하고, 초안을 남기는 개인 워크스페이스.
              필요한 순간에만 실행하고, 나머지는 차분하게 쌓아 둡니다.
            </p>
          </div>

          <div className="max-w-[380px] space-y-3">
            <div className="rounded-[18px] border border-white/8 bg-[#121821] px-5 py-4">
              <p className="text-sm font-medium text-white">공고를 한 흐름으로 관리</p>
              <p className="mt-2 text-sm leading-6 text-[#8f98a3]">
                수집, 판정, 초안 생성을 하나의 작업 흐름으로 묶었습니다.
              </p>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-[#121821] px-5 py-4">
              <p className="text-sm font-medium text-white">프로필 문서를 그대로 재사용</p>
              <p className="mt-2 text-sm leading-6 text-[#8f98a3]">
                프로필 YAML과 Markdown을 그대로 참조해 답변과 이력서를 만듭니다.
              </p>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-[#121821] px-5 py-4">
              <p className="text-sm font-medium text-white">단일 사용자 기준</p>
              <p className="mt-2 text-sm leading-6 text-[#8f98a3]">
                빠르게 들어가서 보고, 필요한 작업만 실행하고, 결과만 남깁니다.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-[360px] overflow-hidden rounded-[4px] bg-white text-[var(--foreground)]"
          >
            <div className="flex h-[4px]">
              <div className="w-1/3 bg-[var(--accent)]" />
              <div className="w-1/3 bg-[#0a0a0a]" />
              <div className="w-1/3 bg-[var(--accent-soft)]" />
            </div>
            <div className="px-9 py-10">
              <h1 className="font-heading text-center text-[22px] font-semibold text-[var(--foreground)]">
                채용 작업실
              </h1>
              <p className="mt-3 text-center text-[14px] text-[var(--muted-foreground)]">
                작업실 잠금 해제
              </p>

              <label className="mt-10 block text-sm text-[var(--muted-foreground)]">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="mt-3 h-10 w-full rounded-[4px] border border-[var(--border)] px-4 text-[14px] outline-none placeholder:text-[#c0c0c0] focus:border-[var(--accent)]"
                autoFocus
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-4 h-10 w-full rounded-[4px] bg-[var(--accent)] text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "작업실 여는 중" : "작업실 열기"}
              </button>

              {error ? (
                <p className="mt-4 text-center text-sm text-rose-500">{error}</p>
              ) : null}

              <p className="mt-10 text-center text-[12px] text-[var(--muted-foreground)]">
                접근 권한이 필요하면 관리자에게 문의하세요.
              </p>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
