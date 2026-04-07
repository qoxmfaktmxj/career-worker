export interface FilterConfig {
  include_keywords: string[];
  exclude_keywords: string[];
  locations: string[];
  exclude_company_sizes: string[];
  min_employee_count: number;
  allow_startup: boolean;
  exclude_entry_only: boolean;
}

export interface JobCandidate {
  position: string;
  raw_text: string;
  location?: string;
  company_size?: string;
  employee_count?: number;
  employment_type?: string;
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

const GAME_KEYWORDS = ["게임"];
const AX_DX_KEYWORDS = [
  "AI",
  "AX",
  "DX",
  "디지털전환",
  "현대화",
  "클라우드전환",
  "레거시현대화",
  "AI활용",
  "AI도입",
  "생성형AI",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function containsAny(text: string, keywords: string[]): boolean {
  const normalizedText = normalize(text);

  return keywords.some((keyword) =>
    normalizedText.includes(normalize(keyword))
  );
}

function isEntryOnly(text: string, keywords: string[]): boolean {
  const normalizedText = normalize(text);
  const hasEntryOnlyKeyword = keywords.some((keyword) =>
    normalizedText.includes(normalize(keyword))
  );

  if (!hasEntryOnlyKeyword) {
    return false;
  }

  return !normalizedText.includes("경력");
}

export function applyFilter(
  job: JobCandidate,
  config: FilterConfig
): FilterResult {
  const combinedText = `${job.position} ${job.raw_text}`;

  if (config.exclude_entry_only && isEntryOnly(combinedText, config.exclude_keywords)) {
    return { passed: false, reason: "신입만/인턴만 공고" };
  }

  if (containsAny(combinedText, GAME_KEYWORDS) && !containsAny(combinedText, AX_DX_KEYWORDS)) {
    return { passed: false, reason: "게임 단독, AX/DX 키워드 없음" };
  }

  if (!containsAny(combinedText, config.include_keywords)) {
    return { passed: false, reason: "매칭 키워드 없음" };
  }

  if (job.location) {
    const locationMatched = config.locations.some((location) =>
      normalize(job.location!).includes(normalize(location))
    );

    if (!locationMatched) {
      return { passed: false, reason: `지역 불일치: ${job.location}` };
    }
  }

  if (job.company_size) {
    const normalizedCompanySize = normalize(job.company_size);
    const isStartup = normalizedCompanySize.includes("스타트업");

    if (!isStartup && config.exclude_company_sizes.some((size) => normalizedCompanySize.includes(normalize(size)))) {
      return { passed: false, reason: `기업규모 제외: ${job.company_size}` };
    }

    if (isStartup && config.allow_startup) {
      return { passed: true };
    }

    if (
      !isStartup &&
      job.employee_count !== undefined &&
      job.employee_count < config.min_employee_count
    ) {
      return {
        passed: false,
        reason: `사원수 ${job.employee_count}명 (기준: ${config.min_employee_count}명)`,
      };
    }
  }

  return { passed: true };
}
