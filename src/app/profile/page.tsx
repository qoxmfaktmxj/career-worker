"use client";

import { useEffect, useState } from "react";
import yaml from "js-yaml";

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
    label: "스코어 맵핑",
    description: "면접과 자기소개서에 재사용할 사례를 쌓아 둡니다.",
  },
  {
    key: "answer_bank.md",
    label: "날짜 메모",
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
  const [editingProfile, setEditingProfile] = useState(false);

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
  const showProfileSummary = activeTab === "profile.yml" && !editingProfile;
  const profileSummary = (() => {
    if (!content["profile.yml"]) {
      return [];
    }

    try {
      const parsed = yaml.load(content["profile.yml"]) as Record<string, unknown>;
      const orderedKeys = [
        "name",
        "headline",
        "email",
        "phone",
        "location",
        "summary",
        "preferred_roles",
        "preferred_domains",
      ];

      return orderedKeys
        .filter((key) => key in parsed)
        .map((key) => ({
          key,
          value: Array.isArray(parsed[key])
            ? (parsed[key] as unknown[]).join(", ")
            : String(parsed[key] ?? ""),
        }));
    } catch {
      return [];
    }
  })();

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0a0a0a] px-12 py-10 text-white">
        <h1 className="font-heading text-[28px] font-bold">원본 문서</h1>
        <p className="mt-2 text-sm text-[#999999]">
          평가와 생성에 쓰는 기준 정보입니다.
        </p>
      </section>

      <div className="border-b border-[var(--border)] px-12">
        <div className="flex flex-wrap gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-3 text-sm transition ${
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

      <section className="px-12 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-[20px] font-semibold text-[var(--foreground)]">
              {activeDoc.label}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                activeTab === "profile.yml"
                  ? setEditingProfile((current) => !current)
                  : undefined
              }
              className="font-data text-sm text-[var(--accent)]"
            >
              {activeTab === "profile.yml" ? "profile.md" : activeDoc.key}
            </button>
            {editingProfile || activeTab !== "profile.yml" ? (
              <button
                onClick={() => void save()}
                disabled={saving}
                className="rounded-[4px] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "저장 중" : "저장"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          {showProfileSummary && profileSummary.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {profileSummary.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[180px_minmax(0,1fr)]"
                >
                  <div className="py-[14px] pr-6 text-[13px] text-[var(--muted-foreground)]">
                    {item.key}
                  </div>
                  <div className="font-data py-[14px] text-[13px] leading-7 text-[var(--foreground)]">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MarkdownEditor
              value={content[activeTab] || ""}
              onChange={(value) =>
                setContent((current) => ({ ...current, [activeTab]: value }))
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
