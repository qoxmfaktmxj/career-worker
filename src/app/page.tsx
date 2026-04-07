"use client";

import { useEffect, useState } from "react";

import { JobTable, type JobTableJob } from "@/components/job-table";
import { StatCard } from "@/components/stat-card";

interface Stats {
  total: number;
  new_jobs: number;
  matched: number;
  deadline_soon: number;
  expired: number;
}

const EMPTY_STATS: Stats = {
  total: 0,
  new_jobs: 0,
  matched: 0,
  deadline_soon: 0,
  expired: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [matchedJobs, setMatchedJobs] = useState<JobTableJob[]>([]);
  const [scanning, setScanning] = useState(false);

  const loadData = async () => {
    const [statsResponse, jobsResponse] = await Promise.all([
      fetch("/api/jobs/stats"),
      fetch("/api/jobs?status=matched"),
    ]);

    setStats((await statsResponse.json()) as Stats);
    setMatchedJobs((await jobsResponse.json()) as JobTableJob[]);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleScan = async () => {
    setScanning(true);

    try {
      await fetch("/api/scan/run", { method: "POST" });
      await loadData();
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200">
              Overview
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              오늘 처리할 채용 작업을 한 번에 확인합니다.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              새 공고 수집부터 적합도 평가, 초안 생성까지 현재 파이프라인 상태를
              대시보드에서 확인할 수 있습니다.
            </p>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scanning ? "스캔 실행 중..." : "스캔 실행"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 수집 공고" value={stats.total} color="blue" />
        <StatCard label="신규 패스 공고" value={stats.new_jobs} color="green" />
        <StatCard label="적합 판정 공고" value={stats.matched} color="yellow" />
        <StatCard label="마감 임박 공고" value={stats.deadline_soon} color="red" />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">적합 공고</h2>
          <p className="mt-1 text-sm text-slate-500">
            AI 평가 기준으로 우선 검토할 공고입니다.
          </p>
        </div>
        <JobTable jobs={matchedJobs} />
      </section>
    </div>
  );
}
