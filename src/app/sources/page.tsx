"use client";

import { useEffect, useState } from "react";

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

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    channel: "saramin",
    name: "",
    keywords: "",
  });

  const load = async () => {
    const [sourcesResponse, historyResponse] = await Promise.all([
      fetch("/api/scan/sources"),
      fetch("/api/scan/history"),
    ]);

    setSources((await sourcesResponse.json()) as Source[]);
    setHistory((await historyResponse.json()) as ScanHistory[]);
  };

  useEffect(() => {
    void load();
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
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            수집원 관리
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            채널별 수집 설정과 최근 스캔 결과를 확인합니다.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((current) => !current)}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {showAdd ? "닫기" : "+ 수집원 추가"}
        </button>
      </div>

      {showAdd ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-3">
            <select
              value={form.channel}
              onChange={(event) =>
                setForm((current) => ({ ...current, channel: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
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
              placeholder="예: 사람인 백엔드 서울"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
            />
            <input
              value={form.keywords}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  keywords: event.target.value,
                }))
              }
              placeholder="키워드, 쉼표 구분"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
            />
          </div>
          <button
            onClick={() => void addSource()}
            className="mt-4 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            저장
          </button>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">채널</th>
              <th className="px-4 py-3 font-medium">마지막 스캔</th>
              <th className="px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {source.name}
                </td>
                <td className="px-4 py-3 text-slate-600">{source.channel}</td>
                <td className="px-4 py-3 text-slate-600">
                  {source.last_scan || "없음"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {source.enabled ? "활성" : "비활성"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">최근 스캔 이력</h2>
          <p className="mt-1 text-sm text-slate-500">
            최근 실행된 스캔의 수집 및 필터링 결과입니다.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">시각</th>
                <th className="px-4 py-3 font-medium">수집원</th>
                <th className="px-4 py-3 font-medium">수집</th>
                <th className="px-4 py-3 font-medium">신규</th>
                <th className="px-4 py-3 font-medium">통과</th>
                <th className="px-4 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{item.started_at}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.source_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.total_found}</td>
                  <td className="px-4 py-3 text-slate-600">{item.new_count}</td>
                  <td className="px-4 py-3 text-slate-600">{item.passed_count}</td>
                  <td className="px-4 py-3 text-slate-600">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
