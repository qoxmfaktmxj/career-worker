import Link from "next/link";

export interface JobTableJob {
  job_id: string;
  company: string;
  position: string;
  source: string;
  deadline: string | null;
  deadline_text?: string | null;
  deadline_date?: string | null;
  fit_score: number | null;
  status: string;
  fit_status?: string | null;
  workflow_status?: string | null;
  application_status?: string | null;
  company_size?: string | null;
}

interface JobTableProps {
  jobs: JobTableJob[];
  showScore?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  saramin: "사람인",
  jobkorea: "잡코리아",
  remember: "리멤버",
  manual: "직접 입력",
};

const STATUS_LABELS: Record<string, string> = {
  unreviewed: "미검토",
  filtered_out: "제외",
  passed: "신규",
  matched: "추천",
  low_fit: "보류",
  evaluation_failed: "평가 실패",
  idle: "대기",
  detail_pending: "상세 대기",
  detail_ready: "상세 확보",
  generating: "생성 중",
  draft_ready: "초안 완료",
  generation_failed: "생성 실패",
  not_started: "미지원",
  applied: "지원 완료",
  hold: "보류",
  withdrawn: "철회",
  closed: "마감",
};

function formatDeadline(deadlineDate: string | null, deadlineText: string | null) {
  if (deadlineDate && /^\d{4}-\d{2}-\d{2}$/u.test(deadlineDate)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(`${deadlineDate}T00:00:00`);
    const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);

    if (diff < 0) {
      return "마감";
    }

    if (diff === 0) {
      return "오늘";
    }

    return `D-${diff}`;
  }

  return deadlineText || "상시";
}

export function JobTable({
  jobs,
  showScore = true,
  emptyTitle = "조건에 맞는 공고가 없습니다.",
  emptyDescription = "필터 조건을 바꾸거나 다른 키워드로 다시 확인해 보세요.",
}: JobTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-[4px] border border-[var(--border)] bg-white px-6 py-10">
        <div className="text-center">
          <p className="text-base font-medium text-[var(--foreground)]">
            {emptyTitle}
          </p>
          {emptyDescription ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              {emptyDescription}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[4px] border border-[var(--border)] bg-white">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="border-b border-[var(--border)] bg-white text-left text-[12px] text-[var(--muted-foreground)]">
          <tr>
            <th className="px-5 py-4 font-medium">회사</th>
            <th className="px-5 py-4 font-medium">포지션</th>
            <th className="px-5 py-4 font-medium">채널</th>
            <th className="px-5 py-4 font-medium">마감</th>
            {showScore ? <th className="px-5 py-4 font-medium">점수</th> : null}
            <th className="px-5 py-4 font-medium">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {jobs.map((job) => (
            <tr key={job.job_id}>
              <td className="px-5 py-4">
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {job.company}
                  </p>
                  {job.company_size ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {job.company_size}
                    </p>
                  ) : null}
                </div>
              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/jobs/${job.job_id}`}
                  className="font-medium text-[var(--foreground)] hover:text-[#4a9fd8]"
                >
                  {job.position}
                </Link>
              </td>
              <td className="px-5 py-4 text-[var(--muted-foreground)]">
                {SOURCE_LABELS[job.source] ?? job.source}
              </td>
              <td className="px-5 py-4 text-[var(--muted-foreground)]">
                {formatDeadline(
                  job.deadline_date ?? job.deadline,
                  job.deadline_text ?? job.deadline
                )}
              </td>
              {showScore ? (
                <td className="font-data px-5 py-4 text-[var(--foreground)]">
                  {job.fit_score !== null ? job.fit_score.toFixed(1) : "-"}
                </td>
              ) : null}
              <td className="px-5 py-4 text-[var(--muted-foreground)]">
                {STATUS_LABELS[job.status] ?? job.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
