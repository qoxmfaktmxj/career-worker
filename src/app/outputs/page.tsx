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
  { key: "answer_pack", label: "요약 팩" },
  { key: "resume", label: "질문 의견서" },
  { key: "recruiter_reply", label: "손고침 설정" },
];

const TYPE_LABELS: Record<string, string> = {
  answer_pack: "답변 팩",
  resume: "맞춤 이력서",
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
      <section className="bg-[#0a0a0a] px-8 py-7 text-white">
        <h1 className="font-heading text-[28px] font-semibold">아웃풋</h1>
        <p className="mt-2 text-sm text-[#999999]">
          생성된 답변과 초안을 관리합니다.
        </p>
      </section>

      <div className="border-b border-[var(--border)] px-8">
        <div className="flex flex-wrap gap-8">
          {FILTERS.map((filter) => (
            <button
              key={filter.key || "all"}
              onClick={() => setTypeFilter(filter.key)}
              className={`border-b-2 px-0 py-4 text-sm transition ${
                typeFilter === filter.key
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="overflow-hidden rounded-[4px] border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-5 py-3 font-medium">제목/키워드</th>
                <th className="px-5 py-3 font-medium">기업</th>
                <th className="px-5 py-3 font-medium">작업</th>
                <th className="px-5 py-3 font-medium">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {outputs.map((output) => (
                <tr key={output.id}>
                  <td className="px-5 py-4 font-medium text-[var(--foreground)]">
                    {output.position}
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {output.company}
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    <button
                      onClick={() => void viewOutput(output.id)}
                      className="text-[var(--accent)]"
                    >
                      {TYPE_LABELS[output.type] ?? output.type}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)]">
                    {output.created_at?.split("T")[0] || output.created_at}
                  </td>
                </tr>
              ))}
              {outputs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-32 text-center">
                    <p className="text-base font-medium text-[var(--foreground)]">
                      아직 저장된 산출물이 없습니다.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                      답변이나 초안을 생성하면 이곳에 표시됩니다.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
