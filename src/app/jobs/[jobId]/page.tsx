"use client";

import {
  type ReactNode,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  listingContent: string;
  detailContent: string;
  detail_status: string;
  openclaw_ready: boolean;
  rawContent: string;
  outputs: OutputItem[];
}

const TEXT = {
  loading: "\uB85C\uB529 \uC911...",
  source: "\uCC44\uB110",
  location: "\uC9C0\uC5ED",
  locationUnknown: "\uC9C0\uC5ED \uBBF8\uC0C1",
  size: "\uADDC\uBAA8",
  sizeUnknown: "\uADDC\uBAA8 \uBBF8\uC0C1",
  outputs: "\uC0B0\uCD9C\uBB3C",
  countUnit: "\uAC74",
  scorePending: "\uD3C9\uAC00 \uC804",
  rawTitle: "\uC0C1\uC138 JD",
  rawDescription:
    "\uC2A4\uCE90\uB108\uAC00 \uC218\uC9D1\uD55C \uACF5\uACE0 \uC0C1\uC138 \uBCF8\uBB38\uC744 \uBCF4\uC5EC\uC8FC\uB294 \uC601\uC5ED\uC785\uB2C8\uB2E4.",
  rawEmpty: "\uC0C1\uC138 JD\uAC00 \uC544\uC9C1 \uC218\uC9D1\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
  rawPending:
    "\uBAA9\uB85D \uC2A4\uB0C5\uC0F7\uB9CC \uC788\uACE0 \uACF5\uACE0 \uC0C1\uC138 \uBCF8\uBB38\uC740 \uC544\uC9C1 \uC900\uBE44\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
  listingTitle: "\uBAA9\uB85D \uC2A4\uB0C5\uC0F7",
  aiBlockedDetail:
    "\uACF5\uACE0 \uC0C1\uC138 \uBCF8\uBB38\uC774 \uC5C6\uC5B4 AI \uD3C9\uAC00\uC640 \uC0DD\uC131 \uC791\uC5C5\uC744 \uC9C4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
  aiBlockedOpenClaw:
    "OpenClaw CLI\uAC00 \uC124\uCE58\uB418\uC9C0 \uC54A\uC544 AI \uC791\uC5C5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
  actionFailed:
    "\uC694\uCCAD \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  aiTitle: "AI \uD3C9\uAC00",
  aiDescription:
    "\uC801\uD569\uB3C4, \uB9AC\uC2A4\uD06C, \uCD94\uCC9C \uC2A4\uD1A0\uB9AC\uB97C \uC694\uC57D\uD574\uC11C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.",
  score: "\uC810\uC218",
  reason: "\uD3C9\uAC00 \uC774\uC720",
  risks: "\uB9AC\uC2A4\uD06C",
  stories: "\uCD94\uCC9C \uC2A4\uD1A0\uB9AC",
  aiEmptyTitle:
    "\uC544\uC9C1 AI \uD3C9\uAC00\uB97C \uC2E4\uD589\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
  aiEmptyBody:
    "\uBA3C\uC800 \uD3C9\uAC00\uB97C \uC2E4\uD589\uD558\uBA74 \uC801\uD569\uB3C4 \uC810\uC218\uC640 \uC9C0\uC6D0 \uC804\uB7B5 \uC694\uC57D\uC774 \uC774 \uC601\uC5ED\uC5D0 \uC815\uB9AC\uB429\uB2C8\uB2E4.",
  actionTitle: "AI \uC561\uC158",
  actionDescription:
    "\uD3C9\uAC00, \uC790\uC18C\uC11C, \uC774\uB825\uC11C, \uB9AC\uD06C\uB8E8\uD130 \uB2F5\uC7A5 \uC0DD\uC131\uC744 \uD55C \uACF3\uC5D0\uC11C \uCC98\uB9AC\uD569\uB2C8\uB2E4.",
  evaluate: "AI \uD3C9\uAC00 \uC2E4\uD589",
  evaluating: "AI \uD3C9\uAC00 \uC911...",
  coverLetter: "\uC790\uC18C\uC11C \uC0DD\uC131",
  resume: "\uC774\uB825\uC11C \uC0DD\uC131",
  generating: "\uC0DD\uC131 \uC911...",
  reply: "\uB2F5\uC7A5 \uC0DD\uC131",
  message: "\uBA54\uC2DC\uC9C0",
  replyPlaceholder:
    "\uB9AC\uD06C\uB8E8\uD130 \uBA54\uC2DC\uC9C0\uB97C \uBD99\uC5EC \uB123\uC73C\uC138\uC694.",
  generatedTitle: "\uC0DD\uC131\uB41C \uC0B0\uCD9C\uBB3C",
  generatedDescription:
    "\uC0DD\uC131 \uACB0\uACFC\uB97C \uC2DC\uAC04\uC21C\uC73C\uB85C \uD655\uC778\uD558\uACE0 \uBC14\uB85C \uC5F4\uB78C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  generatedEmpty:
    "\uC544\uC9C1 \uC0DD\uC131\uB41C \uC0B0\uCD9C\uBB3C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  view: "\uBCF4\uAE30",
  outputModalTitle: "\uC0DD\uC131 \uC0B0\uCD9C\uBB3C \uB0B4\uC6A9",
};

const SOURCE_LABELS: Record<string, string> = {
  saramin: "\uC0AC\uB78C\uC778",
  jobkorea: "\uC7A1\uCF54\uB9AC\uC544",
  remember: "\uB9AC\uBA64\uBC84",
  manual: "\uC9C1\uC811 \uC785\uB825",
};

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  answer_pack: "\uC790\uC18C\uC11C \uC0DD\uC131",
  resume: "\uC774\uB825\uC11C \uC0DD\uC131",
  cover_letter: "\uCEE4\uBC84\uB808\uD130 \uC0DD\uC131",
  recruiter_reply: "\uB9AC\uD06C\uB8E8\uD130 \uB2F5\uC7A5",
};

const REPLY_CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  remember: "Remember",
};

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

async function fetchJobDetail(jobId: string): Promise<JobDetail> {
  const response = await fetch(`/api/jobs/${jobId}`);
  return (await response.json()) as JobDetail;
}

async function readActionError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: unknown;
      error?: unknown;
    };

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Ignore non-JSON failures and fall through to a generic message.
  }

  return TEXT.actionFailed;
}

function SectionFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[4px] border border-[var(--border)] bg-white">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-heading text-[20px] font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-6 py-4 md:grid-cols-[132px_minmax(0,1fr)] md:gap-6">
      <p className="text-[12px] font-medium tracking-[0.16em] text-[var(--muted-foreground-soft)]">
        {label}
      </p>
      <div className="min-w-0 text-sm leading-7 text-[var(--foreground)]">
        {children}
      </div>
    </div>
  );
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
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const data = await fetchJobDetail(jobId);

      if (!cancelled) {
        startTransition(() => setJob(data));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const runAction = async (action: string, body?: Record<string, unknown>) => {
    setActionError(null);

    const response = await fetch(`/api/jobs/${jobId}/${action}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      setActionError(await readActionError(response));
      return;
    }

    const data = await fetchJobDetail(jobId);
    startTransition(() => setJob(data));
  };

  const openOutput = async (id: number) => {
    const response = await fetch(`/api/outputs/${id}`);
    const data = (await response.json()) as { content: string };
    setOutputContent(data.content);
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-white px-10 py-8">
        <p className="text-sm text-[var(--muted-foreground)]">{TEXT.loading}</p>
      </div>
    );
  }

  const risks = parseStringArray(job.risks);
  const recommendedStories = parseStringArray(job.recommended_stories);
  const sourceLabel = SOURCE_LABELS[job.source] ?? job.source;
  const detailReady = job.detail_status === "ready" && Boolean(job.detailContent);
  const aiReady = detailReady && job.openclaw_ready;
  const aiBlockedMessage = !detailReady
    ? TEXT.aiBlockedDetail
    : !job.openclaw_ready
      ? TEXT.aiBlockedOpenClaw
      : null;
  const metaItems = [
    { label: TEXT.source, value: sourceLabel },
    { label: TEXT.location, value: job.location || TEXT.locationUnknown },
    { label: TEXT.size, value: job.company_size || TEXT.sizeUnknown },
    { label: TEXT.outputs, value: `${job.outputs.length}${TEXT.countUnit}` },
  ];

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0a0a0a] px-10 py-8 text-white">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-caption text-[11px] uppercase tracking-[0.2em] text-white/55">
              Job Detail
            </p>
            <h1 className="mt-3 font-heading text-[28px] font-bold leading-tight">
              {job.company} {" / "} {job.position}
            </h1>
            <p className="mt-3 text-sm text-white/68">
              {sourceLabel} {" / "} {job.location || TEXT.locationUnknown} {" / "}
              {job.company_size || TEXT.sizeUnknown}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <div className="rounded-[4px] border border-white/12 bg-white/5 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Fit Score
              </p>
              <p className="font-data mt-3 text-[24px] font-semibold text-white">
                {job.fit_score !== null
                  ? `${job.fit_score.toFixed(1)}/5.0`
                  : TEXT.scorePending}
              </p>
            </div>
            <div className="rounded-[4px] border border-white/12 bg-white/5 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Job ID
              </p>
              <p className="font-data mt-3 text-[12px] text-white/78">{job.job_id}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-8 px-10 py-8">
        <section className="grid gap-px overflow-hidden rounded-[4px] border border-[var(--border)] bg-[var(--border)] md:grid-cols-2 xl:grid-cols-4">
          {metaItems.map((item) => (
            <div key={item.label} className="bg-white px-5 py-4">
              <p className="text-[12px] tracking-[0.16em] text-[var(--muted-foreground-soft)]">
                {item.label}
              </p>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <SectionFrame
            title={TEXT.rawTitle}
            description={TEXT.rawDescription}
            actions={job.detailContent ? <CopyButton text={job.detailContent} /> : undefined}
          >
            <div className="space-y-0">
              <pre className="font-data max-h-[520px] overflow-auto whitespace-pre-wrap px-6 py-6 text-[13px] leading-7 text-[var(--foreground)]">
                {job.detailContent || TEXT.rawEmpty}
              </pre>
              {!detailReady ? (
                <div className="border-t border-[var(--border)] bg-[#fafbfc] px-6 py-5">
                  <p className="text-[12px] tracking-[0.16em] text-[var(--muted-foreground-soft)]">
                    {TEXT.listingTitle}
                  </p>
                  <pre className="font-data mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-[var(--muted-foreground)]">
                    {job.listingContent || TEXT.rawPending}
                  </pre>
                </div>
              ) : null}
            </div>
          </SectionFrame>

          <SectionFrame title={TEXT.aiTitle} description={TEXT.aiDescription}>
            {job.fit_score !== null ? (
              <div className="divide-y divide-[var(--border)]">
                <InfoRow label={TEXT.score}>
                  <span className="font-data text-[15px] font-semibold text-[var(--foreground)]">
                    {job.fit_score.toFixed(1)}/5.0
                  </span>
                </InfoRow>
                <InfoRow label={TEXT.reason}>{job.fit_reason || "-"}</InfoRow>
                <InfoRow label={TEXT.risks}>
                  {risks.length > 0 ? risks.join(", ") : "-"}
                </InfoRow>
                <InfoRow label={TEXT.stories}>
                  {recommendedStories.length > 0
                    ? recommendedStories.join(", ")
                    : "-"}
                </InfoRow>
              </div>
            ) : (
              <div className="px-6 py-8">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {TEXT.aiEmptyTitle}
                </p>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {TEXT.aiEmptyBody}
                </p>
              </div>
            )}
          </SectionFrame>
        </div>

        <SectionFrame title={TEXT.actionTitle} description={TEXT.actionDescription}>
          <div className="px-6 py-6">
            {aiBlockedMessage ? (
              <div className="mb-5 rounded-[4px] border border-[var(--border)] bg-[#fafbfc] px-4 py-4 text-sm text-[var(--muted-foreground)]">
                {aiBlockedMessage}
              </div>
            ) : null}
            {actionError ? (
              <div className="mb-5 rounded-[4px] border border-[#f3d2d2] bg-[#fff5f5] px-4 py-4 text-sm text-[#9f2d2d]">
                {actionError}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <LoadingButton
                onClick={() => runAction("evaluate")}
                label={TEXT.evaluate}
                loadingLabel={TEXT.evaluating}
                disabled={!aiReady}
                className="bg-accent hover:opacity-90"
              />
              <LoadingButton
                onClick={() => runAction("generate-answers")}
                label={TEXT.coverLetter}
                loadingLabel={TEXT.generating}
                disabled={!aiReady}
                className="border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[#fafbfc]"
              />
              <LoadingButton
                onClick={() => runAction("generate-resume")}
                label={TEXT.resume}
                loadingLabel={TEXT.generating}
                disabled={!aiReady}
                className="border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[#fafbfc]"
              />
            </div>

            <div className="mt-6 border-t border-[var(--border)] pt-6">
              <div className="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
                <div>
                  <label className="block text-[12px] tracking-[0.16em] text-[var(--muted-foreground-soft)]">
                    {TEXT.source}
                  </label>
                  <select
                    value={replyChannel}
                    onChange={(event) => setReplyChannel(event.target.value)}
                    className="focus-accent mt-2 h-10 w-full rounded-[4px] border border-[var(--border)] bg-white px-3 text-sm outline-none"
                  >
                    {Object.entries(REPLY_CHANNEL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] tracking-[0.16em] text-[var(--muted-foreground-soft)]">
                    {TEXT.message}
                  </label>
                  <textarea
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    placeholder={TEXT.replyPlaceholder}
                    className="focus-accent mt-2 min-h-[124px] w-full rounded-[4px] border border-[var(--border)] bg-white px-3 py-3 text-sm outline-none placeholder:text-[var(--muted-foreground-soft)]"
                  />
                </div>

                <div className="flex xl:items-end">
                  <LoadingButton
                    onClick={() =>
                      runAction("generate-reply", {
                        message: replyMessage,
                        channel: replyChannel,
                      })
                    }
                    label={TEXT.reply}
                    loadingLabel={TEXT.generating}
                    disabled={!aiReady || !replyMessage.trim()}
                    className="w-full bg-[#0a0a0a] hover:opacity-90"
                  />
                </div>
              </div>
            </div>
          </div>
        </SectionFrame>

        <SectionFrame
          title={TEXT.generatedTitle}
          description={TEXT.generatedDescription}
          actions={
            <p className="font-data text-[12px] text-[var(--muted-foreground)]">
              {job.outputs.length}
              {TEXT.countUnit}
            </p>
          }
        >
          {job.outputs.length === 0 ? (
            <div className="px-6 py-8">
              <p className="text-sm text-[var(--muted-foreground)]">
                {TEXT.generatedEmpty}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {job.outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {OUTPUT_TYPE_LABELS[output.type] ?? output.type}
                    </p>
                    <p className="font-data mt-1 text-[12px] text-[var(--muted-foreground)]">
                      {output.created_at}
                    </p>
                  </div>

                  <button
                    onClick={() => void openOutput(output.id)}
                    className="w-full rounded-[4px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:bg-[#fafbfc] md:w-auto"
                  >
                    {TEXT.view}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionFrame>
      </div>

      {outputContent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,10,0.42)] px-4"
          onClick={() => setOutputContent(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-[4px] border border-[var(--border)] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground-soft)]">
                  Output
                </p>
                <h3 className="mt-2 font-heading text-[20px] font-semibold text-[var(--foreground)]">
                  {TEXT.outputModalTitle}
                </h3>
              </div>
              <CopyButton text={outputContent} />
            </div>
            <pre className="whitespace-pre-wrap px-6 py-6 text-sm leading-7 text-[var(--foreground)]">
              {outputContent}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
