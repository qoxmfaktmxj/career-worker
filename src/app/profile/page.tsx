"use client";

import { useEffect, useState } from "react";

import { MarkdownEditor } from "@/components/markdown-editor";

const TABS = [
  {
    key: "profile.yml",
    label: "기본 정보",
    description: "기본 신상, 선호 포지션, 검색 조건을 관리합니다.",
  },
  {
    key: "master_resume.md",
    label: "이력서",
    description: "가장 최신 기준의 대표 이력서 원문입니다.",
  },
  {
    key: "career_story.md",
    label: "커리어 스토리",
    description: "전체 경력 흐름과 강점을 한 문서로 정리합니다.",
  },
  {
    key: "story_bank.md",
    label: "스토리 매핑",
    description: "면접과 자기소개서에 재사용할 사례를 쌓아 둡니다.",
  },
  {
    key: "answer_bank.md",
    label: "답변 메모",
    description: "자주 쓰는 답변 초안을 주제별로 보관합니다.",
  },
  {
    key: "links.md",
    label: "공고",
    description: "포트폴리오와 외부 링크를 정리합니다.",
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [content, setContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/profile")
      .then((response) => response.json())
      .then((data: { profile?: Record<string, string> }) =>
        setContent(data.profile || {})
      );
  }, []);

  const save = async () => {
    setSaving(true);

    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: activeTab,
          content: content[activeTab] || "",
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const activeDoc = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0a0a0a] px-8 py-7 text-white">
        <h1 className="font-heading text-[28px] font-semibold">원본 문서</h1>
        <p className="mt-2 text-sm text-[#999999]">
          평가와 생성에 쓰는 기준 정보입니다.
        </p>
      </section>

      <div className="border-b border-[var(--border)] px-8">
        <div className="flex flex-wrap gap-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-0 py-4 text-sm transition ${
                activeTab === tab.key
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="px-8 py-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-[18px] font-semibold text-[var(--foreground)]">
              {activeDoc.label}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {activeDoc.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-data text-sm text-[var(--accent)]">{activeDoc.key}</span>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-[4px] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "저장 중" : "저장"}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <MarkdownEditor
            value={content[activeTab] || ""}
            onChange={(value) =>
              setContent((current) => ({ ...current, [activeTab]: value }))
            }
          />
        </div>
      </section>
    </div>
  );
}
