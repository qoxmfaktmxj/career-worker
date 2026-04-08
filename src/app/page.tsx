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
    <div className="min-h-screen bg-white">
      <section className="flex items-center gap-4 bg-[#0a0a0a] px-10 py-8 text-white">
        <h1 className="font-heading text-[26px] font-semibold">
          오늘 공고와 대기 작업
        </h1>
        <div className="flex-1" />
        <button
          onClick={handleScan}
          disabled={scanning}
          className="rounded-[4px] bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {scanning ? "스캔 중" : "전체 스캔"}
        </button>
      </section>

      <section className="grid gap-6 px-10 py-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="전체 수집 공고" value={stats.total} color="blue" />
            <StatCard label="신규 등록 공고" value={stats.new_jobs} color="green" />
            <StatCard label="우선 검토 공고" value={stats.matched} color="yellow" />
            <StatCard label="기한 임박 공고" value={stats.deadline_soon} color="red" />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-heading text-[18px] font-semibold text-[var(--foreground)]">
                우선 검토 공고
              </h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                빠른 판별과 결정을 위한 공고입니다.
              </p>
            </div>
            <JobTable
              jobs={matchedJobs}
              emptyTitle="검토할 공고가 없습니다"
              emptyDescription=""
            />
          </section>
        </div>

        <aside className="rounded-[4px] border border-[var(--border)] bg-white p-5">
          <h2 className="font-heading text-[16px] font-semibold text-[var(--foreground)]">
            작업 안내
          </h2>
          <div className="my-4 h-px bg-[var(--border)]" />
          <div className="space-y-4 text-sm text-[var(--muted-foreground)]">
            <div className="flex gap-3">
              <span className="font-data text-[var(--accent)]">1</span>
              <p>수집된 공고를 확인하세요</p>
            </div>
            <div className="flex gap-3">
              <span className="font-data text-[var(--accent)]">2</span>
              <p>우선 검토 대상을 분류하세요</p>
            </div>
            <div className="flex gap-3">
              <span className="font-data text-[var(--accent)]">3</span>
              <p>기한 임박 공고를 처리하세요</p>
            </div>
            <div className="flex gap-3">
              <span className="font-data text-[var(--accent)]">4</span>
              <p>완료된 작업을 기록하세요</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
