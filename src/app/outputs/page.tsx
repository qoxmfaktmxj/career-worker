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

const TYPES = ["", "answer_pack", "resume", "cover_letter", "recruiter_reply"];

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          생성 산출물
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          답변 팩, 이력서, 답장 초안을 필터별로 확인합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((type) => (
          <button
            key={type || "all"}
            onClick={() => setTypeFilter(type)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              typeFilter === type
                ? "bg-cyan-600 text-white"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            {type || "전체"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">날짜</th>
              <th className="px-4 py-3 font-medium">회사 / 포지션</th>
              <th className="px-4 py-3 font-medium">타입</th>
              <th className="px-4 py-3 font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {outputs.map((output) => (
              <tr key={output.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">
                  {output.created_at?.split("T")[0] || output.created_at}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {output.company} · {output.position}
                </td>
                <td className="px-4 py-3 text-slate-600">{output.type}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void viewOutput(output.id)}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewContent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
          onClick={() => setViewContent(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">산출물 내용</h3>
              <CopyButton text={viewContent} />
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {viewContent}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
