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
      <section className="bg-[#0a0a0a] px-10 py-7 text-white">
        <h1 className="font-heading text-[28px] font-bold">공고 검토</h1>
        <p className="mt-2 text-sm text-[#999999]">
          필터를 설정해 원하는 공고를 찾습니다.
        </p>
      </section>

      <section className="grid min-h-[calc(100vh-92px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="border-r border-[var(--border)]">
          <form
            onSubmit={handleSearch}
            className="grid items-center gap-3 border-b border-[var(--border)] px-6 py-5 md:grid-cols-[132px_132px_minmax(0,1fr)_56px]"
          >
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="focus-accent h-9 w-[132px] rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none"
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
              className="focus-accent h-9 w-[132px] rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="검색어 입력"
              className="focus-accent h-9 min-w-0 rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none placeholder:text-[#bbbbbb]"
            />
            <button
              type="submit"
              className="bg-accent h-9 shrink-0 rounded-[4px] px-4 text-sm font-medium text-white transition hover:opacity-90"
            >
              조회
            </button>
          </form>

          <div className="px-6 py-6">
            {jobs.length === 0 ? (
              <div className="flex min-h-[480px] items-center justify-center">
                <div className="text-center">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mx-auto h-12 w-12 text-[#cccccc]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M4 7.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" />
                    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
                  </svg>
                  <p className="mt-5 text-[15px] font-medium text-[var(--foreground)]">
                    주간에 해당하는 공고가 없습니다.
                  </p>
                  <p className="font-caption mt-3 text-[13px] text-[var(--muted-foreground)]">
                    필터 조건을 변경하거나 다른 기준을 선택해 보세요.
                  </p>
                </div>
              </div>
            ) : (
              <JobTable jobs={jobs} />
            )}
          </div>
        </div>

        <aside className="px-5 py-6">
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
