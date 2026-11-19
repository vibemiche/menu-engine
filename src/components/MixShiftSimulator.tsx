"use client";

import { useState } from "react";
import type { DishAnalysis } from "@/lib/costing";
import { simulateMixShift } from "@/lib/engineering";

export function MixShiftSimulator({ dishes }: { dishes: DishAnalysis[] }) {
  const [pct, setPct] = useState(10);
  const sim = simulateMixShift(dishes, pct);
  const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  return (
    <div className="card p-5">
      <h3 className="font-semibold">Quanto vale guidare le scelte</h3>
      <p className="mt-1 text-xs text-muted">
        Se il nuovo menu sposta una quota delle scelte dai piatti a basso margine a quelli ad alto margine della stessa sezione, a parità di coperti.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <input type="range" min={0} max={30} step={1} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="flex-1 accent-[#2f6b4f]" aria-label="Quota di scelte spostate" />
        <span className="tabular w-12 text-right text-sm font-semibold">{pct}%</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm text-muted">Margine in più al mese</span>
        <span className="tabular font-serif text-3xl font-semibold text-basil">+{eur(sim.total)}</span>
      </div>
      <p className="tabular text-right text-xs text-muted">≈ {eur(sim.total * 12)} l&apos;anno</p>
      {sim.perSection.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
          {sim.perSection.map((s) => (
            <li key={s.name} className="flex justify-between"><span>{s.name || "Senza sezione"} · {Math.round(s.moved)} porzioni spostate</span><span className="tabular font-medium">+{eur(s.gain)}</span></li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">Con un buon menu uno spostamento del 5–15% è realistico. Misuralo davvero confrontando le vendite prima e dopo.</p>
    </div>
  );
}
