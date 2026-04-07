"use client";

import { useEffect, useState } from "react";

import { MarkdownEditor } from "@/components/markdown-editor";

const TABS = [
  { key: "profile.yml", label: "기본정보" },
  { key: "master_resume.md", label: "이력서" },
  { key: "career_story.md", label: "커리어 스토리" },
  { key: "story_bank.md", label: "스토리 뱅크" },
  { key: "answer_bank.md", label: "답변 뱅크" },
  { key: "links.md", label: "링크" },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            프로필 편집
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            평가와 생성에 사용하는 기본 자료를 탭별로 관리합니다.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-cyan-600 text-white"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <MarkdownEditor
        value={content[activeTab] || ""}
        onChange={(value) =>
          setContent((current) => ({ ...current, [activeTab]: value }))
        }
      />
    </div>
  );
}
