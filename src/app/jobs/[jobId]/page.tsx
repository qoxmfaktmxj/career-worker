"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { CopyButton } from "@/components/copy-button";
import { LoadingButton } from "@/components/loading-button";

interface OutputItem {
  id: number;
  type: string;
  created_at: string;
}

interface JobDetail {
  job_id: string;
  company: string;
  position: string;
  source: string;
  location: string | null;
  company_size: string | null;
  fit_score: number | null;
  fit_reason: string | null;
  risks: string | null;
  recommended_stories: string | null;
  rawContent: string;
  outputs: OutputItem[];
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = useMemo(
    () => (Array.isArray(params.jobId) ? params.jobId[0] : params.jobId),
    [params.jobId]
  );
  const [job, setJob] = useState<JobDetail | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyChannel, setReplyChannel] = useState("linkedin");
  const [outputContent, setOutputContent] = useState<string | null>(null);

  const loadJob = async () => {
    const response = await fetch(`/api/jobs/${jobId}`);
    const data = (await response.json()) as JobDetail;
    setJob(data);
  };

  useEffect(() => {
    if (!jobId) {
      return;
    }

    void loadJob();
  }, [jobId]);

  const runAction = async (action: string, body?: Record<string, unknown>) => {
    await fetch(`/api/jobs/${jobId}/${action}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    await loadJob();
  };

  const openOutput = async (id: number) => {
    const response = await fetch(`/api/outputs/${id}`);
    const data = (await response.json()) as { content: string };
    setOutputContent(data.content);
  };

  if (!job) {
    return <div className="rounded-3xl bg-white p-6 shadow-sm">로딩 중...</div>;
  }

  const risks = parseStringArray(job.risks);
  const recommendedStories = parseStringArray(job.recommended_stories);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {job.company} · {job.position}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {job.source} · {job.location || "지역 미상"} ·{" "}
          {job.company_size || "규모 미상"}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">원문 JD</h2>
          <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {job.rawContent || "원문이 없습니다."}
          </pre>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">AI 평가</h2>
          {job.fit_score ? (
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              <p>
                <strong className="text-slate-900">점수</strong> {job.fit_score}
                /5.0
              </p>
              <p>
                <strong className="text-slate-900">이유</strong>{" "}
                {job.fit_reason || "-"}
              </p>
              <p>
                <strong className="text-slate-900">리스크</strong>{" "}
                {risks.length > 0 ? risks.join(", ") : "-"}
              </p>
              <p>
                <strong className="text-slate-900">추천 스토리</strong>{" "}
                {recommendedStories.length > 0
                  ? recommendedStories.join(", ")
                  : "-"}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              아직 AI 평가를 실행하지 않았습니다.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI 액션</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <LoadingButton
            onClick={() => runAction("evaluate")}
            label="AI 평가 실행"
            loadingLabel="AI 평가 중..."
            className="bg-blue-600 hover:bg-blue-500"
          />
          <LoadingButton
            onClick={() => runAction("generate-answers")}
            label="자소서 생성"
            loadingLabel="생성 중..."
            className="bg-emerald-600 hover:bg-emerald-500"
          />
          <LoadingButton
            onClick={() => runAction("generate-resume")}
            label="이력서 생성"
            loadingLabel="생성 중..."
            className="bg-violet-600 hover:bg-violet-500"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_180px]">
            <select
              value={replyChannel}
              onChange={(event) => setReplyChannel(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
              <option value="remember">Remember</option>
            </select>
            <textarea
              value={replyMessage}
              onChange={(event) => setReplyMessage(event.target.value)}
              placeholder="리크루터 메시지를 붙여 넣으세요."
              className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
            />
            <LoadingButton
              onClick={() =>
                runAction("generate-reply", {
                  message: replyMessage,
                  channel: replyChannel,
                })
              }
              label="답장 생성"
              loadingLabel="생성 중..."
              className="self-start bg-slate-900 hover:bg-slate-800"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">생성된 산출물</h2>
        <div className="mt-4 space-y-3">
          {job.outputs.length === 0 ? (
            <p className="text-sm text-slate-500">아직 생성된 산출물이 없습니다.</p>
          ) : (
            job.outputs.map((output) => (
              <div
                key={output.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {output.type}
                  </p>
                  <p className="text-xs text-slate-500">{output.created_at}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void openOutput(output.id)}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    보기
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {outputContent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
          onClick={() => setOutputContent(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">산출물 내용</h3>
              <CopyButton text={outputContent} />
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {outputContent}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
