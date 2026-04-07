interface StatCardProps {
  label: string;
  value: number;
  color?: "blue" | "green" | "yellow" | "red";
}

const COLOR_MAP: Record<NonNullable<StatCardProps["color"]>, string> = {
  blue: "border-cyan-200 bg-cyan-50 text-cyan-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatCard({
  label,
  value,
  color = "blue",
}: StatCardProps) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${COLOR_MAP[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
