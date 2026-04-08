const CHANNEL_REQUIREMENTS: Record<
  string,
  Array<{ env: string; label: string }>
> = {
  saramin: [{ env: "SARAMIN_API_KEY", label: "사람인 API 키" }],
  jobkorea: [],
  remember: [],
};

export interface MissingScannerConfig {
  missingEnv: string[];
  missingLabels: string[];
}

export function getMissingScannerConfig(
  channel: string
): MissingScannerConfig | null {
  const requirements = CHANNEL_REQUIREMENTS[channel] || [];
  const missing = requirements.filter(({ env }) => {
    const value = process.env[env];

    return !value || value.trim().length === 0;
  });

  if (missing.length === 0) {
    return null;
  }

  return {
    missingEnv: missing.map(({ env }) => env),
    missingLabels: missing.map(({ label }) => label),
  };
}

export function formatMissingScannerConfigMessage(
  channel: string,
  missingLabels: string[]
): string {
  if (
    channel === "saramin" &&
    missingLabels.length === 1 &&
    missingLabels[0] === "사람인 API 키"
  ) {
    return "사람인 API 키가 없습니다.";
  }

  return `${channel} 실행에 필요한 설정이 없습니다: ${missingLabels.join(", ")}`;
}
