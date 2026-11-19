"use client";

import { useState } from "react";

export function PriceSimulator({ cost, price, vatIncluded, vatRate, target }: { cost: number; price: number; vatIncluded: boolean; vatRate: number; target: number }) {
  const [p, setP] = useState(price || 10);
  const net = vatIncluded ? p / (1 + vatRate / 100) : p;
  const fc = net > 0 ? (cost / net) * 100 : 0;
  const margin = net - cost;
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const tone = fc > target + 5 ? "text-tomato" : fc > target ? "text-amber" : "text-basil";
  const max = Math.max(price * 2, 30);

  return (
    <div className="card p-5">
      <h3 className="font-semibold">Simulatore prezzo</h3>
      <p className="mt-1 text-xs text-muted">Sposta il cursore per vedere l&apos;effetto su food cost e margine.</p>
      <input type="range" min={0.5} max={max} step={0.5} value={p} onChange={(e) => setP(Number(e.target.value))} className="mt-4 w-full accent-[#2f6b4f]" aria-label="Prezzo simulato" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-xs text-muted">Prezzo</div><div className="tabular text-lg font-semibold">{fmt(p)}</div></div>
        <div><div className="text-xs text-muted">Food cost</div><div className={`tabular text-lg font-semibold ${tone}`}>{fc.toFixed(1)}%</div></div>
        <div><div className="text-xs text-muted">Margine</div><div className="tabular text-lg font-semibold">{fmt(margin)}</div></div>
      </div>
      {p !== price && price > 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          {p > price ? "+" : ""}{fmt(p - price)} rispetto al prezzo attuale
        </p>
      )}
    </div>
  );
}
