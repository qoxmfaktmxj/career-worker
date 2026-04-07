"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";

import { JobTable, type JobTableJob } from "@/components/job-table";

async function fetchJobs(params: {
  status: string;
  source: string;
  search: string;
}): Promise<JobTableJob[]> {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (params.source) {
    searchParams.set("source", params.source);
  }

  if (params.search) {
    searchParams.set("search", params.search);
  }

  const response = await fetch(`/api/jobs?${searchParams.toString()}`);
  return (await response.json()) as JobTableJob[];
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobTableJob[]>([]);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const data = await fetchJobs({ status, source, search: "" });

      if (!cancelled) {
        startTransition(() => setJobs(data));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, source]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = await fetchJobs({ status, source, search });
    startTransition(() => setJobs(data));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          공고 목록
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          상태, 채널, 키워드 기준으로 수집 공고를 필터링합니다.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
          >
            <option value="">전체 상태</option>
            <option value="passed">미평가</option>
            <option value="matched">적합</option>
            <option value="low_fit">부적합</option>
            <option value="draft_ready">초안완료</option>
            <option value="applied">지원완료</option>
          </select>

          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
          >
            <option value="">전체 채널</option>
            <option value="saramin">사람인</option>
            <option value="jobkorea">잡코리아</option>
            <option value="remember">리멤버</option>
          </select>

          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="회사명 또는 포지션 검색"
              className="flex-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              검색
            </button>
          </form>
        </div>
      </div>

      <JobTable jobs={jobs} />
    </div>
  );
}
