"use client";

import { useEffect, useState } from "react";

import { CopyButton } from "@/components/copy-button";

interface OutputRow {
  id: number;
  created_at: string;
  company: string;
  position: string;
  type: string;
}

const FILTERS = [
  { key: "", label: "전체" },
  { key: "answer_pack", label: "요약 백" },
  { key: "resume", label: "질문 의견서" },
  { key: "cover_letter", label: "기본 레터" },
  { key: "recruiter_reply", label: "손고침 설정" },
];

const TYPE_LABELS: Record<string, string> = {
  answer_pack: "요약 백",
  resume: "질문 의견서",
  cover_letter: "기본 레터",
  recruiter_reply: "리크루터 답장",
};

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [viewContent, setViewContent] = useState<string | null>(null);

  useEffect(() => {
    const query = typeFilter ? `?type=${typeFilter}` : "";

    void fetch(`/api/outputs${query}`)
      .then((response) => response.json())
      .then((data: OutputRow[]) => setOutputs(data));
  }, [typeFilter]);

  const viewOutput = async (id: number) => {
    const response = await fetch(`/api/outputs/${id}`);
    const data = (await response.json()) as { content: string };
    setViewContent(data.content);
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0a0a0a] px-12 py-10 text-white">
        <h1 className="font-heading text-[28px] font-bold">생성 답변 및 초안 관리</h1>
      </section>

      <div className="border-b border-[var(--border)] px-12">
        <div className="flex flex-wrap gap-0">
          {FILTERS.map((filter) => (
            <button
              key={filter.key || "all"}
              onClick={() => setTypeFilter(filter.key)}
              className={`border-b-2 px-4 py-[14px] text-sm transition ${
                typeFilter === filter.key
                  ? "border-accent text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-12 py-6">
        <div className="bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-0 py-3 font-medium">제목/키워드</th>
                <th className="w-[160px] px-0 py-3 font-medium">기업</th>
                <th className="w-[140px] px-0 py-3 font-medium">작업</th>
                <th className="w-[120px] px-0 py-3 font-medium">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {outputs.map((output) => (
                <tr key={output.id}>
                  <td className="py-[14px] text-[14px] font-medium text-[var(--foreground)]">
                    {output.position}
                  </td>
                  <td className="py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {output.company}
                  </td>
                  <td className="py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    <button
                      onClick={() => void viewOutput(output.id)}
                      className="text-accent"
                    >
                      {TYPE_LABELS[output.type] ?? output.type}
                    </button>
                  </td>
                  <td className="font-data py-[14px] text-[13px] text-[var(--muted-foreground)]">
                    {output.created_at?.split("T")[0] || output.created_at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {outputs.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="text-center">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mx-auto h-10 w-10 text-[var(--border)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M4 7.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" />
                  <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
                </svg>
                <p className="mt-4 text-[14px] font-medium text-[var(--muted-foreground)]">
                  아직 저장된 산출물이 없습니다.
                </p>
                <p className="font-caption mt-3 text-[12px] leading-6 text-[#999999]">
                  답변이나 초안을 생성하면 이곳에 표시됩니다.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {viewContent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4"
          onClick={() => setViewContent(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-[4px] border border-[var(--border)] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
                  Output
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  산출물 내용
                </h3>
              </div>
              <CopyButton text={viewContent} />
            </div>
            <pre className="font-data whitespace-pre-wrap rounded-[4px] border border-[var(--border)] bg-white p-5 text-sm leading-7 text-slate-700">
              {viewContent}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
