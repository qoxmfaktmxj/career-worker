"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";

import { JobTable, type JobTableJob } from "@/components/job-table";

const STATUS_OPTIONS = [
  { value: "", label: "진행 상태" },
  { value: "passed", label: "미평가" },
  { value: "matched", label: "적합" },
  { value: "low_fit", label: "보류" },
  { value: "draft_ready", label: "초안 완료" },
  { value: "applied", label: "지원 완료" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "진행 채널" },
  { value: "saramin", label: "사람인" },
  { value: "jobkorea", label: "잡코리아" },
  { value: "remember", label: "리멤버" },
];

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

  const selectedStatus =
    STATUS_OPTIONS.find((option) => option.value === status)?.label || "진행 상태";
  const selectedSource =
    SOURCE_OPTIONS.find((option) => option.value === source)?.label || "진행 채널";

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0a0a0a] px-8 py-7 text-white">
        <h1 className="font-heading text-[28px] font-semibold">공고 검토</h1>
        <p className="mt-2 text-sm text-[#999999]">
          필터를 설정해 원하는 공고를 찾습니다.
        </p>
      </section>

      <section className="grid min-h-[calc(100vh-92px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="border-r border-[var(--border)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-5">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 w-[160px] rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-9 w-[160px] rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <form onSubmit={handleSearch} className="flex flex-1 gap-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="검색어 입력"
                className="h-9 flex-1 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none placeholder:text-[#bbbbbb] focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="h-9 rounded-[4px] bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:opacity-90"
              >
                조회
              </button>
            </form>
          </div>

          <div className="px-6 py-6">
            <JobTable
              jobs={jobs}
              emptyTitle="조건에 맞는 공고가 없습니다."
              emptyDescription="필터 조건을 변경하거나 다른 기준을 선택해 보세요."
            />
          </div>
        </div>

        <aside className="px-4 py-6">
          <h2 className="text-sm font-medium text-[var(--foreground)]">적용된 필터</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-[4px] bg-[#d9edf9] px-3 py-2 text-sm text-[#4a7ea7]">
              상태: {selectedStatus}
            </span>
            <span className="rounded-[4px] bg-[#d9edf9] px-3 py-2 text-sm text-[#4a7ea7]">
              채널: {selectedSource}
            </span>
            {search ? (
              <span className="rounded-[4px] bg-[#d9edf9] px-3 py-2 text-sm text-[#4a7ea7]">
                검색어: {search}
              </span>
            ) : null}
          </div>
          <button
            onClick={() => {
              setStatus("");
              setSource("");
              setSearch("");
              void fetchJobs({ status: "", source: "", search: "" }).then((data) =>
                startTransition(() => setJobs(data))
              );
            }}
            className="mt-6 rounded-[4px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]"
          >
            필터 초기화
          </button>
        </aside>
      </section>
    </div>
  );
}
