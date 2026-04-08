"use client";

import { startTransition, useEffect, useState } from "react";

interface Source {
  id: number;
  channel: string;
  name: string;
  config: string;
  enabled: number;
  last_scan: string | null;
}

interface ScanHistory {
  id: number;
  started_at: string;
  source_name: string;
  total_found: number;
  new_count: number;
  passed_count: number;
  status: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  saramin: "사람인",
  jobkorea: "잡코리아",
  remember: "리멤버",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "완료",
  failed: "실패",
  running: "실행 중",
};

async function fetchSourcesPageData(): Promise<{
  sources: Source[];
  history: ScanHistory[];
}> {
  const [sourcesResponse, historyResponse] = await Promise.all([
    fetch("/api/scan/sources"),
    fetch("/api/scan/history"),
  ]);

  return {
    sources: (await sourcesResponse.json()) as Source[],
    history: (await historyResponse.json()) as ScanHistory[],
  };
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    channel: "saramin",
    name: "",
    keywords: "",
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const data = await fetchSourcesPageData();

      if (!cancelled) {
        startTransition(() => {
          setSources(data.sources);
          setHistory(data.history);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const addSource = async () => {
    await fetch("/api/scan/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: form.channel,
        name: form.name,
        config: {
          keywords: form.keywords
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean),
        },
      }),
    });

    setForm({ channel: "saramin", name: "", keywords: "" });
    setShowAdd(false);
    const data = await fetchSourcesPageData();
    startTransition(() => {
      setSources(data.sources);
      setHistory(data.history);
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="flex items-center gap-4 bg-[#0a0a0a] px-8 py-7 text-white">
        <div>
          <h1 className="font-heading text-[28px] font-semibold">키워드 소스</h1>
          <p className="mt-2 text-sm text-[#999999]">
            수집 대상과 키워드를 관리합니다.
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd((current) => !current)}
          className="rounded-[4px] bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          {showAdd ? "닫기" : "수집원 추가"}
        </button>
      </section>

      {showAdd ? (
        <section className="border-b border-[var(--border)] px-8 py-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <select
              value={form.channel}
              onChange={(event) =>
                setForm((current) => ({ ...current, channel: event.target.value }))
              }
              className="h-9 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="saramin">사람인</option>
              <option value="jobkorea">잡코리아</option>
              <option value="remember">리멤버</option>
            </select>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="예: 백엔드 채용"
              className="h-9 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={form.keywords}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  keywords: event.target.value,
                }))
              }
              placeholder="키워드, 쉼표로 구분"
              className="h-9 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            onClick={() => void addSource()}
            className="mt-4 rounded-[4px] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            저장
          </button>
        </section>
      ) : null}

      <section className="px-8 py-5">
        <div className="overflow-hidden rounded-[4px] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-5 py-3 font-medium">이름</th>
                <th className="px-5 py-3 font-medium">채널</th>
                <th className="px-5 py-3 font-medium">실행기간</th>
                <th className="px-5 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="px-5 py-4 font-medium text-[var(--foreground)]">
                    {source.name}
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {CHANNEL_LABELS[source.channel] ?? source.channel}
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {source.last_scan || "없음"}
                  </td>
                  <td className="px-5 py-4 text-[var(--accent)]">
                    {source.enabled ? "ON" : "OFF"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="px-8 pb-8">
        <div>
          <h2 className="font-heading text-[18px] font-semibold text-[var(--foreground)]">
            최근 스캔 이력
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            스캔 실행 결과를 확인합니다.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[4px] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-5 py-3 font-medium">날짜</th>
                <th className="px-5 py-3 font-medium">소스명</th>
                <th className="px-5 py-3 font-medium">건수</th>
                <th className="px-5 py-3 font-medium">신규</th>
                <th className="px-5 py-3 font-medium">에러</th>
                <th className="px-5 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {item.started_at.split("T")[0] ?? item.started_at}
                  </td>
                  <td className="px-5 py-4 font-medium text-[var(--foreground)]">
                    {item.source_name}
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {item.total_found}
                  </td>
                  <td className="px-5 py-4 text-[var(--accent)]">{item.new_count}</td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {item.status === "failed" ? "1" : "0"}
                  </td>
                  <td className="px-5 py-4 text-[var(--accent)]">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
