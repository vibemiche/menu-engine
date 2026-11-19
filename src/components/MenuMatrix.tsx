import type { DishAnalysis, MenuClass } from "@/lib/costing";

// Palette validata (scripts dataviz): la classe è codificata anche dalla posizione nel quadrante e dalle etichette.
const COLORS: Record<MenuClass, string> = { star: "#1f8a5a", plowhorse: "#c07d10", puzzle: "#2d6fb8", dog: "#d04a2a" };
const QUAD: { cls: MenuClass; label: string; x: "l" | "r"; y: "t" | "b" }[] = [
  { cls: "puzzle", label: "Enigmi", x: "l", y: "t" },
  { cls: "star", label: "Star", x: "r", y: "t" },
  { cls: "dog", label: "Cani", x: "l", y: "b" },
  { cls: "plowhorse", label: "Cavalli da tiro", x: "r", y: "b" },
];

export function MenuMatrix({ dishes }: { dishes: DishAnalysis[] }) {
  const pts = dishes.filter((d) => d.menuClass && (d.monthlySales ?? 0) > 0);
  if (pts.length < 2) return null;
  const total = pts.reduce((s, d) => s + (d.monthlySales ?? 0), 0);
  const avgMargin = pts.reduce((s, d) => s + d.margin * (d.monthlySales ?? 0), 0) / total;
  const popThreshold = (1 / pts.length) * 0.7;

  const W = 640, H = 400, P = { l: 52, r: 16, t: 16, b: 40 };
  const shares = pts.map((d) => (d.monthlySales ?? 0) / total);
  const maxX = Math.max(...shares, popThreshold) * 1.12;
  const margins = pts.map((d) => d.margin);
  const minY = Math.min(0, ...margins);
  const maxY = Math.max(...margins, avgMargin) * 1.12 || 1;
  const sx = (v: number) => P.l + (v / maxX) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - ((v - minY) / (maxY - minY)) * (H - P.t - P.b);
  const tx = sx(popThreshold), ty = sy(avgMargin);
  const labelled = new Set(
    [...pts].sort((a, b) => (b.monthlyMargin ?? 0) - (a.monthlyMargin ?? 0)).slice(0, 8).map((d) => d.id),
  );

  return (
    <figure className="card p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Matrice di menu engineering: popolarità sull'asse orizzontale, margine per piatto su quello verticale">
        {QUAD.map((q) => {
          const x = q.x === "l" ? P.l : tx, y = q.y === "t" ? P.t : ty;
          const w = q.x === "l" ? tx - P.l : W - P.r - tx, h = q.y === "t" ? ty - P.t : H - P.b - ty;
          return (
            <g key={q.cls}>
              <rect x={x} y={y} width={Math.max(w, 0)} height={Math.max(h, 0)} fill={COLORS[q.cls]} opacity={0.05} />
              <text x={q.x === "l" ? x + 8 : x + w - 8} y={q.y === "t" ? y + 18 : y + h - 8} textAnchor={q.x === "l" ? "start" : "end"} fontSize="12" fontWeight="600" fill="#6b6258">{q.label}</text>
            </g>
          );
        })}
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="#d9d1c4" />
        <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} stroke="#d9d1c4" />
        <line x1={tx} x2={tx} y1={P.t} y2={H - P.b} stroke="#b9afa1" strokeDasharray="4 4" />
        <line x1={P.l} x2={W - P.r} y1={ty} y2={ty} stroke="#b9afa1" strokeDasharray="4 4" />
        <text x={(P.l + W - P.r) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b6258">Popolarità (quota sulle vendite) →</text>
        <text x={14} y={(P.t + H - P.b) / 2} textAnchor="middle" fontSize="11" fill="#6b6258" transform={`rotate(-90 14 ${(P.t + H - P.b) / 2})`}>Margine per piatto (€) →</text>
        <text x={P.l - 6} y={ty + 4} textAnchor="end" fontSize="10" fill="#6b6258">{avgMargin.toFixed(1)}</text>
        {pts.map((d, i) => {
          const x = sx(shares[i]), y = sy(d.margin);
          return (
            <g key={d.id}>
              <circle cx={x} cy={y} r={14} fill="transparent">
                <title>{`${d.name}\nVendite: ${d.monthlySales}/mese\nMargine: ${d.margin.toFixed(2)} €\nFood cost: ${d.foodCostPct?.toFixed(1) ?? "–"}%`}</title>
              </circle>
              <circle cx={x} cy={y} r={5} fill={COLORS[d.menuClass!]} stroke="#fff" strokeWidth={2} pointerEvents="none" />
              {labelled.has(d.id) && (
                <text x={x > W * 0.7 ? x - 9 : x + 9} y={y + 4} textAnchor={x > W * 0.7 ? "end" : "start"} fontSize="11" fill="#1f1b16" pointerEvents="none">{d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        {QUAD.map((q) => (
          <span key={q.cls} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[q.cls] }} />{q.label}</span>
        ))}
        <span>Linee tratteggiate: soglia di popolarità (70% della quota media) e margine medio ponderato. Passa sopra un punto per i dettagli.</span>
      </figcaption>
    </figure>
  );
}
