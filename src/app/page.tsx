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

interface ScanResultItem {
  channel: string;
  error?: string;
  missing_config?: string[];
}

interface ScanRunResponse {
  results?: ScanResultItem[];
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
      const response = await fetch("/api/scan/run", { method: "POST" });
      const body = (await response.json()) as ScanRunResponse;
      const missingConfigResults = (body.results || []).filter(
        (result) => (result.missing_config || []).length > 0
      );

      if (missingConfigResults.length > 0) {
        if (
          missingConfigResults.length === 1 &&
          missingConfigResults[0].error === "사람인 API 키가 없습니다."
        ) {
          window.alert("사람인 API 키가 없습니다.");
          await loadData();
          return;
        }

        const lines = missingConfigResults.map((result) => {
          if (result.error) {
            return `- ${result.error}`;
          }

          return `- ${result.channel}: ${(result.missing_config || []).join(", ")}`;
        });

        window.alert(
          [
            "일부 수집원을 실행할 수 없습니다.",
            "누락된 설정을 확인해 주세요.",
            "",
            ...lines,
          ].join("\n")
        );
      }

      await loadData();
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="flex items-center gap-4 bg-[#0a0a0a] px-8 py-6 text-white">
        <h1 className="font-heading text-[22px] font-semibold">
          오늘 공고와 대기 작업
        </h1>
        <div className="flex-1" />
        <button
          onClick={handleScan}
          disabled={scanning}
          className="bg-accent rounded-[4px] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {scanning ? "스캔 중" : "전체 스캔"}
        </button>
      </section>

      <section className="grid gap-6 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_280px]">
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
              <span className="text-accent font-data">1</span>
              <p>수집된 공고를 확인하세요</p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-data">2</span>
              <p>우선 검토 대상을 분류하세요</p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-data">3</span>
              <p>기한 임박 공고를 처리하세요</p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-data">4</span>
              <p>완료된 작업을 기록하세요</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
