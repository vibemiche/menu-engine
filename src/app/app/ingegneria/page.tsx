import Link from "next/link";
import { MixShiftSimulator } from "@/components/MixShiftSimulator";
import { ClassBadge, EmptyState, FoodCostBadge, PageHeader, Stat } from "@/components/ui";
import { eur, pct } from "@/lib/costing";
import { loadEngineering } from "@/lib/data";
import { PAVESIC_LABELS, type ActionType, type PavesicClass } from "@/lib/engineering";
import { requireRestaurant } from "@/lib/session";

const PAV_STYLE: Record<PavesicClass, string> = {
  prime: "bg-basil-soft text-basil",
  standard: "bg-sky-soft text-sky",
  sleeper: "bg-amber-soft text-amber",
  problem: "bg-tomato-soft text-tomato",
};
const ACTION_STYLE: Record<ActionType, { label: string; className: string }> = {
  ricetta: { label: "Dati", className: "bg-paper text-muted ring-1 ring-line" },
  prezzo: { label: "Prezzo", className: "bg-basil-soft text-basil" },
  porzione: { label: "Porzione", className: "bg-amber-soft text-amber" },
  posizione: { label: "Posizione", className: "bg-sky-soft text-sky" },
  proteggi: { label: "Proteggi", className: "bg-basil-soft text-basil" },
  elimina: { label: "Elimina", className: "bg-tomato-soft text-tomato" },
  fornitore: { label: "Fornitore", className: "bg-amber-soft text-amber" },
  monitora: { label: "Monitora", className: "bg-paper text-muted ring-1 ring-line" },
};

function Ratio({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted">–</span>;
  const w = Math.min(value / 2, 1) * 100;
  return (
    <div className="flex items-center gap-2" title="Goal value del piatto rispetto all'obiettivo della sezione (1,00 = in obiettivo)">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <div className={`h-full ${value >= 1 ? "bg-basil" : "bg-amber"}`} style={{ width: `${w}%` }} />
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink/40" />
      </div>
      <span className="tabular text-xs">{value.toFixed(2).replace(".", ",")}</span>
    </div>
  );
}

export default async function EngineeringPage() {
  const { restaurant } = await requireRestaurant();
  const { analysis, engineering: e } = await loadEngineering(restaurant);

  if (!analysis.totals.withRecipe) {
    return (
      <div>
        <PageHeader title="Ingegneria avanzata" />
        <EmptyState title="Servono ricette e prezzi" text="L'analisi avanzata parte quando almeno alcuni piatti hanno ricetta e prezzo." href="/app/importa?tipo=recipe" cta="Importa le ricette" />
      </div>
    );
  }

  const byId = new Map(analysis.dishes.map((d) => [d.id, d]));
  const rows = e.dishes
    .filter((d) => byId.get(d.id)?.hasRecipe)
    .map((d) => ({ d, a: byId.get(d.id)!, main: d.decisions[0] }))
    .sort((x, y) => x.main.priority - y.main.priority || (y.main.impactMonth ?? 0) - (x.main.impactMonth ?? 0));
  const totalImpact = rows.reduce((s, r) => s + r.d.decisions.reduce((t, dec) => t + (dec.impactMonth ?? 0), 0), 0);

  return (
    <div>
      <PageHeader
        title="Ingegneria avanzata"
        subtitle="Secondo livello di analisi: oltre a popolarità e margine incrocia food cost, volumi, costi variabili, struttura dei prezzi, sensibilità al prezzo e rischio fornitori. Ogni piatto è confrontato solo con quelli della sua sezione."
        actions={<><Link href="/app/strategia" className="btn-primary">Passa i dati all&apos;agente</Link><Link href="/app/menu-design" className="btn-secondary">Nuovo menu</Link></>}
      />

      {!e.hasSales && (
        <p className="mb-6 rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">
          Senza le vendite mensili l&apos;analisi usa solo costi e prezzi: Pareto, punteggio obiettivo e simulazioni restano parziali. <Link href="/app/piatti#vendite" className="font-medium underline">Inserisci le vendite</Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Impatto delle azioni" value={totalImpact > 0 ? `+${eur(totalImpact, 0)}` : "–"} hint="al mese, stima prudente" tone="basil" />
        <Stat
          label="Pareto del margine"
          value={e.abcSummary ? `${e.abcSummary.A} piatti` : "–"}
          hint={e.abcSummary ? `portano il ${(e.abcSummary.aMarginShare * 100).toFixed(0)}% del margine` : "servono le vendite"}
        />
        <Stat label="Stress test +10% costi" value={pct(e.stress.allPlus10.foodCost)} hint={e.stress.allPlus10.monthlyLoss != null ? `−${eur(e.stress.allPlus10.monthlyLoss, 0)} al mese se non intervieni` : "food cost medio dopo il rincaro"} tone="amber" />
        <Stat
          label="Ingrediente più esposto"
          value={e.stress.topIngredient?.name ?? "–"}
          hint={e.stress.topIngredient ? `+20% di prezzo = −${eur(e.stress.topIngredient.plus20MonthlyLoss, 0)} al mese` : "servono le vendite"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-xl font-semibold">Struttura prezzi per sezione</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {e.sections.filter((s) => s.dishCount > 0).map((s) => (
              <div key={s.name} className="card p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className="text-xs text-muted">{s.dishCount} piatti{s.revenueShare != null ? ` · ${(s.revenueShare * 100).toFixed(0)}% dei ricavi` : ""}</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[11px] text-muted">FC ponderato</dt><dd className="tabular font-semibold">{pct(s.weightedFoodCost)}</dd></div>
                  <div><dt className="text-[11px] text-muted">Gamma prezzi</dt><dd className={`tabular font-semibold ${s.spreadOk === false ? "text-tomato" : ""}`}>{s.spread != null ? `×${s.spread.toFixed(1).replace(".", ",")}` : "–"}</dd></div>
                  <div><dt className="text-[11px] text-muted" title="Prezzo medio scelto ÷ prezzo medio offerto">Domanda/offerta</dt><dd className={`tabular font-semibold ${s.demandPriceRatio != null && (s.demandPriceRatio < 0.85 || s.demandPriceRatio > 1.05) ? "text-amber" : ""}`}>{s.demandPriceRatio?.toFixed(2).replace(".", ",") ?? "–"}</dd></div>
                </dl>
                {s.zones && (
                  <div className="mt-3">
                    <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
                      <div className="bg-sky" style={{ width: `${s.zones.low * 100}%` }} />
                      <div className="bg-basil" style={{ width: `${s.zones.mid * 100}%` }} />
                      <div className="bg-amber" style={{ width: `${s.zones.high * 100}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted">
                      <span>economica {(s.zones.low * 100).toFixed(0)}%</span><span>media {(s.zones.mid * 100).toFixed(0)}%</span><span>alta {(s.zones.high * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
                {s.notes.length > 0 && <ul className="mt-3 space-y-1.5 text-xs text-ink/80">{s.notes.map((n) => <li key={n} className="flex gap-1.5"><span className="text-amber">●</span>{n}</li>)}</ul>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Principi di Omnes: gamma prezzi entro ×2,5 (×3 oltre 10 piatti), circa metà dei piatti nella fascia media, rapporto tra prezzo medio scelto e offerto tra 0,85 e 1,05.
          </p>
        </section>
        <div>
          <h2 className="mb-3 font-serif text-xl font-semibold">Simulazione</h2>
          {e.hasSales ? <MixShiftSimulator dishes={analysis.dishes} /> : <EmptyState title="Servono le vendite" text="La simulazione stima il valore di un menu che guida le scelte." />}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-1 font-serif text-xl font-semibold">Decisioni piatto per piatto</h2>
        <p className="mb-3 text-sm text-muted">Ordinate per priorità e impatto. Le stime di prezzo considerano già un calo prudente delle vendite del 20%.</p>
        <div className="space-y-3">
          {rows.map(({ d, a }) => (
            <details key={d.id} className="card group">
              <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 sm:w-56">
                  <Link href={`/app/piatti/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted">{d.category}</span>
                    <FoodCostBadge value={a.foodCostPct} target={restaurant.targetFoodCost} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs sm:w-80">
                  <ClassBadge value={a.menuClass} />
                  {d.pavesic && <span className={`rounded-full px-2 py-0.5 font-medium ${PAV_STYLE[d.pavesic]}`} title={PAVESIC_LABELS[d.pavesic].hint}>{PAVESIC_LABELS[d.pavesic].label}</span>}
                  {d.abc && <span className="rounded-full bg-paper px-2 py-0.5 font-semibold ring-1 ring-line" title="Classe Pareto sul margine">{d.abc}</span>}
                  <Ratio value={d.goalRatio} />
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACTION_STYLE[d.decisions[0].action].className}`}>{ACTION_STYLE[d.decisions[0].action].label}</span>
                    <span className="text-sm font-medium">{d.decisions[0].title}</span>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold text-basil">{d.decisions[0].impactMonth ? `+${eur(d.decisions[0].impactMonth, 0)}/mese` : ""}</span>
                  <span className="text-muted transition group-open:rotate-180">▾</span>
                </div>
              </summary>
              <div className="grid gap-4 border-t border-line p-4 text-sm md:grid-cols-3">
                <div className="md:col-span-2 space-y-3">
                  {d.decisions.map((dec) => (
                    <div key={dec.title}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACTION_STYLE[dec.action].className}`}>{ACTION_STYLE[dec.action].label}</span>
                        <span className="font-medium">{dec.title}</span>
                        {dec.impactMonth ? <span className="tabular text-xs font-semibold text-basil">+{eur(dec.impactMonth, 0)}/mese</span> : null}
                      </div>
                      <p className="mt-1 text-muted">{dec.detail}</p>
                    </div>
                  ))}
                </div>
                <dl className="space-y-2 rounded-lg bg-paper p-3 text-xs">
                  {d.priceTests.map((p) => (
                    <div key={p.delta} className="flex justify-between gap-2">
                      <dt className="text-muted">Prezzo {eur(p.newPrice)}</dt>
                      <dd className="tabular text-right">pareggio a −{p.breakEvenLossPct.toFixed(0)}% vendite{p.monthlyGainNoLoss != null ? ` · +${eur(p.monthlyGainNoLoss, 0)}` : ""}</dd>
                    </div>
                  ))}
                  {d.portion && <div className="flex justify-between gap-2"><dt className="text-muted">−10% {d.portion.ingredient.toLowerCase()}</dt><dd className="tabular">−{eur(d.portion.savingPerDish)} a piatto</dd></div>}
                  {d.volumeToGoal != null && <div className="flex justify-between gap-2"><dt className="text-muted">Per l&apos;obiettivo</dt><dd className="tabular">+{d.volumeToGoal} porzioni/mese</dd></div>}
                  {d.risk && <div className="flex justify-between gap-2"><dt className="text-muted">Rischio</dt><dd className="tabular">{d.risk.ingredient} ±{d.risk.volatilityPct.toFixed(0)}%</dd></div>}
                  {d.pavesic && <p className="border-t border-line pt-2 text-muted">{PAVESIC_LABELS[d.pavesic].hint}</p>}
                </dl>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10 card p-5 text-sm text-muted">
        <h2 className="font-semibold text-ink">Come leggere questa pagina</h2>
        <ul className="mt-2 space-y-1.5">
          <li><strong className="text-ink">Classe costo-margine (Pavesic):</strong> confronta food cost e margine in euro con la media ponderata della sezione. Primario = food cost basso e margine alto; Problematico = l&apos;opposto.</li>
          <li><strong className="text-ink">Punteggio obiettivo (Hayes &amp; Huffman):</strong> combina food cost, volumi, prezzo e costi variabili ({restaurant.variableCostPct}% impostato). Sopra 1 il piatto supera l&apos;obiettivo della sezione.</li>
          <li><strong className="text-ink">A / B / C (Pareto):</strong> i piatti A portano l&apos;80% del margine totale. Sono quelli da toccare con più cautela.</li>
          <li><strong className="text-ink">Pareggio:</strong> la quota di porzioni che puoi perdere con l&apos;aumento prima di guadagnare meno di prima.</li>
        </ul>
      </section>
    </div>
  );
}
