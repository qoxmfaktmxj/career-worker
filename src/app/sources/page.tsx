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

  const sourceRows = sources.map((source, index) => ({
    id: source.id,
    order: index + 1,
    name: source.name,
    period: source.last_scan || "없음",
    review: "완료",
    enabled: source.enabled ? "ON" : "OFF",
  }));

  return (
    <div className="min-h-screen bg-white">
      <section className="flex items-center gap-4 bg-[#0a0a0a] px-10 py-8 text-white">
        <div>
          <h1 className="font-heading text-[28px] font-bold">키워드 소스</h1>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd((current) => !current)}
          className="bg-accent rounded-[4px] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          {showAdd ? "닫기" : "수집원 추가"}
        </button>
      </section>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,10,0.28)] px-6">
          <section className="w-full max-w-[560px] rounded-[4px] border border-[var(--border)] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
            <div className="border-b border-[var(--border)] px-8 py-5">
              <h2 className="font-heading text-[20px] font-semibold text-[var(--foreground)]">
                수집원 추가
              </h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                채널과 키워드를 등록합니다.
              </p>
            </div>
            <div className="grid gap-4 px-8 py-6">
              <select
                value={form.channel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, channel: event.target.value }))
                }
                className="focus-accent h-10 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none"
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
                className="focus-accent h-10 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none"
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
                className="focus-accent h-10 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--border)] px-8 py-4">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-[4px] border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)]"
              >
                닫기
              </button>
              <button
                onClick={() => void addSource()}
                className="bg-accent rounded-[4px] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                저장
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="space-y-8 px-10 py-6">
        <section>
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
              <tr>
                <th className="w-[60px] px-0 py-3 font-medium">#</th>
                <th className="px-0 py-3 font-medium">소스명</th>
                <th className="w-[200px] px-0 py-3 font-medium">시행기간</th>
                <th className="w-[100px] px-0 py-3 font-medium">교정</th>
                <th className="w-[80px] px-0 py-3 font-medium">활성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sourceRows.map((source) => (
                <tr key={source.id}>
                  <td className="font-data py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {source.order}
                  </td>
                  <td className="py-[14px] text-[14px] font-medium text-[var(--foreground)]">
                    {source.name}
                  </td>
                  <td className="font-data py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {source.period}
                  </td>
                  <td className="py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {source.review}
                  </td>
                  <td className="text-accent font-data py-[14px] text-[13px]">
                    {source.enabled}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <div>
            <h2 className="font-heading text-[20px] font-semibold text-[var(--foreground)]">
            최근 스캔 이력
            </h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              스캔 실행 결과를 확인합니다.
            </p>
          </div>

          <div className="mt-6">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
              <tr>
                <th className="w-[140px] px-0 py-3 font-medium">날짜</th>
                <th className="px-0 py-3 font-medium">소스명</th>
                <th className="w-[80px] px-0 py-3 font-medium">건수</th>
                <th className="w-[80px] px-0 py-3 font-medium">신규</th>
                <th className="w-[80px] px-0 py-3 font-medium">에러</th>
                <th className="w-[120px] px-0 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="font-data py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {item.started_at.split("T")[0] ?? item.started_at}
                  </td>
                  <td className="py-[14px] text-[14px] font-medium text-[var(--foreground)]">
                    {item.source_name}
                  </td>
                  <td className="font-data py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {item.total_found}
                  </td>
                  <td className="text-accent font-data py-[14px] text-[13px]">{item.new_count}</td>
                  <td className="font-data py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {item.status === "failed" ? "1" : "0"}
                  </td>
                  <td className="text-accent py-[14px] text-[13px]">상세 보기</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      </div>
    </div>
  );
}
