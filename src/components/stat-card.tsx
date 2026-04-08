interface StatCardProps {
  label: string;
  value: number;
  color?: "blue" | "green" | "yellow" | "red";
}

export function StatCard({
  label,
  value,
  color = "blue",
}: StatCardProps) {
  void color;

  return (
    <div className="rounded-[4px] border border-[var(--border)] bg-white px-5 py-5">
      <p className="text-[13px] text-[var(--muted-foreground)]">{label}</p>
      <p className="font-data mt-4 text-[32px] font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
