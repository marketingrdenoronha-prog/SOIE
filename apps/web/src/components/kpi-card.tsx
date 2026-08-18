export function KpiCard({
  label,
  value,
  hint,
  trend,
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
  className?: string;
}) {
  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
        ? "text-rose-500"
        : "text-muted";
  const trendGlyph = trend === "up" ? "▲" : trend === "down" ? "▼" : "→";
  return (
    <div className={`rounded-xl border border-border bg-elevated p-4 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-1 text-xs ${trendColor}`}>
          {trend && <span className="mr-1">{trendGlyph}</span>}
          {hint}
        </p>
      )}
    </div>
  );
}
