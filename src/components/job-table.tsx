import Link from "next/link";

export interface JobTableJob {
  job_id: string;
  company: string;
  position: string;
  source: string;
  deadline: string | null;
  fit_score: number | null;
  status: string;
  company_size?: string | null;
}

interface JobTableProps {
  jobs: JobTableJob[];
  showScore?: boolean;
}

function dDay(deadline: string | null): string {
  if (!deadline) {
    return "상시";
  }

  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);

  if (diff < 0) {
    return "마감";
  }

  if (diff === 0) {
    return "D-Day";
  }

  return `D-${diff}`;
}

export function JobTable({ jobs, showScore = true }: JobTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        표시할 공고가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">회사</th>
            <th className="px-4 py-3 font-medium">포지션</th>
            <th className="px-4 py-3 font-medium">채널</th>
            <th className="px-4 py-3 font-medium">마감</th>
            {showScore ? <th className="px-4 py-3 font-medium">점수</th> : null}
            <th className="px-4 py-3 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.job_id}
              className="border-t border-slate-100 transition hover:bg-slate-50"
            >
              <td className="px-4 py-3 font-medium text-slate-900">
                {job.company}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/jobs/${job.job_id}`}
                  className="text-cyan-700 hover:text-cyan-900 hover:underline"
                >
                  {job.position}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{job.source}</td>
              <td className="px-4 py-3 text-slate-600">{dDay(job.deadline)}</td>
              {showScore ? (
                <td className="px-4 py-3 text-slate-600">
                  {job.fit_score ?? "-"}
                </td>
              ) : null}
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {job.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
