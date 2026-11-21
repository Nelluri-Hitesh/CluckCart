export function BarChart({ data, height = 180, money = true }: { data: { label: string; value: number }[]; height?: number; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const fmt = (v: number) => (money ? `₹${Math.round(v).toLocaleString("en-IN")}` : String(v));
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Bar chart">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2="100" y1={(height / 4) * (1 - g)} y2={(height / 4) * (1 - g)} stroke="#eee" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return (
            <rect key={d.label} x={i * w + w * 0.18} y={height / 4 - h} width={w * 0.64} height={h} rx="0.8" fill={d.value > 0 ? "#14412b" : "#e5e5e5"}>
              <title>{`${d.label}: ${fmt(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-muted">{data.length > 16 && i % 3 !== 0 ? "" : d.label}</span>
        ))}
      </div>
    </div>
  );
}
