"use client";

import Image from "next/image";
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
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 py-12 text-white">
      <div className="w-full max-w-[400px]">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[4px] bg-white text-[var(--foreground)] shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
        >
          <div className="flex h-[4px]">
            <div className="bg-accent w-1/3" />
            <div className="w-1/3 bg-[#0a0a0a]" />
            <div className="bg-accent-soft w-1/3" />
          </div>
          <div className="px-9 pb-4 pt-10">
            <div className="flex items-center justify-center gap-3">
              <Image
                src="/duck-mark.png"
                alt="오리 아이콘"
                width={28}
                height={28}
                className="h-7 w-7"
                priority
              />
              <h1 className="font-heading text-center text-[24px] font-bold text-[var(--foreground)]">
                채용 작업실
              </h1>
            </div>
          </div>

          <div className="px-9 pb-9 pt-2">
            <label className="block text-sm text-[var(--muted-foreground)]">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="focus-accent mt-3 h-11 w-full rounded-[4px] border border-[var(--border)] px-4 text-[14px] outline-none placeholder:text-[#c0c0c0]"
              autoFocus
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-accent mt-4 h-11 w-full rounded-[4px] border border-transparent text-sm font-medium text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "작업실 여는 중" : "작업실 열기"}
            </button>

            {error ? (
              <p className="mt-4 text-center text-sm text-rose-500">{error}</p>
            ) : null}
          </div>
        </form>
        <p className="mt-2 text-center text-[12px] text-[#555555]">
          접근 권한이 필요하면 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
