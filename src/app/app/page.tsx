import Link from "next/link";
import { ClassBadge, FoodCostBadge, PageHeader, Stat } from "@/components/ui";
import { eur, pct } from "@/lib/costing";
import { loadLatestStrategy, loadPriceChanges, loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";
import type { Strategy } from "@/lib/ai/strategy";

export default async function Dashboard() {
  const { restaurant } = await requireRestaurant();
  const [{ ingredients, analysis }, changes, latest] = await Promise.all([
    loadRestaurantData(restaurant),
    loadPriceChanges(restaurant.id),
    loadLatestStrategy(restaurant.id),
  ]);
  const t = analysis.totals;
  const dishes = analysis.dishes;
  const pricedIngredients = ingredients.filter((i) => i.price > 0).length;

  const checklist = [
    { done: dishes.length > 0, label: "Importa il menu", href: "/app/importa?tipo=menu" },
    { done: pricedIngredients > 0, label: "Carica almeno una fattura", href: "/app/importa?tipo=invoice" },
    { done: t.withRecipe > 0, label: "Aggiungi le ricette ai piatti", href: "/app/importa?tipo=recipe" },
    { done: t.hasSales, label: "Inserisci le vendite mensili", href: "/app/piatti#vendite" },
    { done: Boolean(latest), label: "Genera la strategia con l'agente AI", href: "/app/strategia" },
  ];
  const progress = checklist.filter((c) => c.done).length;

  const problems = dishes
    .filter((d) => d.foodCostPct != null && d.foodCostPct > restaurant.targetFoodCost)
    .sort((a, b) => (b.foodCostPct ?? 0) - (a.foodCostPct ?? 0))
    .slice(0, 6);

  const potential = dishes.reduce((sum, d) => {
    if (!d.suggestedPrice || !d.monthlySales) return sum;
    const delta = d.suggestedPrice - d.price;
    const netDelta = restaurant.vatIncluded ? delta / (1 + restaurant.vatRate / 100) : delta;
    return sum + netDelta * d.monthlySales;
  }, 0);

  const strategy = latest ? (JSON.parse(latest.data) as Strategy) : null;
  const missingPrices = ingredients.length - pricedIngredients;

  return (
    <div>
      <PageHeader title={restaurant.name} subtitle="La situazione dei margini del tuo menu, aggiornata a ogni fattura caricata." />

      {progress < checklist.length && (
        <div className="card mb-8 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Completa il quadro</h2>
            <span className="text-xs text-muted">{progress}/{checklist.length}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-basil" style={{ width: `${(progress / checklist.length) * 100}%` }} />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper ${c.done ? "text-muted line-through" : ""}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${c.done ? "border-basil bg-basil text-white" : "border-line"}`}>{c.done ? "✓" : ""}</span>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Food cost medio" value={pct(t.weightedFoodCost ?? t.avgFoodCost)} hint={t.weightedFoodCost != null ? "ponderato sulle vendite" : `media di ${t.withRecipe} piatti con ricetta`} tone={(t.weightedFoodCost ?? t.avgFoodCost ?? 0) > restaurant.targetFoodCost ? "tomato" : "basil"} />
        <Stat label="Piatti sopra riferimento" value={`${t.overTarget}/${t.withRecipe}`} hint={`riferimento ${restaurant.targetFoodCost}%`} tone={t.overTarget ? "amber" : "basil"} />
        <Stat label="Margine mensile" value={eur(t.monthlyMargin, 0)} hint={t.hasSales ? "ricavi netti − materie prime" : "inserisci le vendite"} />
        <Stat label="Recuperabile con i prezzi" value={potential > 0 ? `+${eur(potential, 0)}` : "–"} hint="al mese, con i prezzi consigliati" tone="basil" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Piatti che bruciano margine</h2>
            <Link href="/app/analisi" className="text-xs font-medium text-basil hover:underline">Audit completo →</Link>
          </div>
          {problems.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">{t.withRecipe ? "Nessun piatto sopra il riferimento. Ottimo lavoro." : "Aggiungi le ricette per vedere il food cost dei piatti."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line"><th className="th">Piatto</th><th className="th text-right">Prezzo</th><th className="th text-right">Costo</th><th className="th">FC</th><th className="th text-right">Prezzo consigliato</th></tr></thead>
                <tbody>
                  {problems.map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="td"><Link href={`/app/piatti/${d.id}`} className="font-medium hover:underline">{d.name}</Link><div className="mt-0.5"><ClassBadge value={d.menuClass} /></div></td>
                      <td className="td tabular text-right">{eur(d.price)}</td>
                      <td className="td tabular text-right">{eur(d.cost)}</td>
                      <td className="td"><FoodCostBadge value={d.foodCostPct} target={restaurant.targetFoodCost} /></td>
                      <td className="td tabular text-right font-medium text-basil">{d.suggestedPrice ? `${eur(d.suggestedPrice)} (+${eur(d.suggestedPrice - d.price)})` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Ingredienti critici</h2>
            {analysis.criticalIngredients.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Compariranno quando i piatti avranno una ricetta.</p>
            ) : (
              <ul className="divide-y divide-line">
                {analysis.criticalIngredients.slice(0, 5).map((c) => (
                  <li key={c.id} className="px-5 py-2.5">
                    <div className="flex justify-between text-sm"><span>{c.name}</span><span className="tabular text-muted">{(c.share * 100).toFixed(0)}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-amber" style={{ width: `${Math.max(c.share * 100, 2)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Variazioni prezzi fornitori</h2>
            {changes.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Carica le fatture nel tempo: qui vedrai rincari e ribassi.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {changes.slice(0, 5).map((c) => (
                  <li key={c.name} className="flex justify-between px-5 py-2.5">
                    <span>{c.name}</span>
                    <span className={`tabular font-medium ${c.deltaPct > 0 ? "text-tomato" : "text-basil"}`}>{c.deltaPct > 0 ? "▲" : "▼"} {Math.abs(c.deltaPct).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
            {missingPrices > 0 && <p className="border-t border-line px-5 py-3 text-xs text-amber">{missingPrices} ingredienti senza prezzo: <Link href="/app/ingredienti" className="underline">completa</Link></p>}
          </section>
        </div>
      </div>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Agente strategia</h2>
          <Link href="/app/strategia" className="btn-secondary">{strategy ? "Apri il piano" : "Genera il piano"}</Link>
        </div>
        {strategy ? (
          <div className="mt-3">
            <p className="text-sm text-ink/80">{strategy.summary}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {strategy.actions.filter((a) => a.priority === "subito").slice(0, 3).map((a) => (
                <li key={a.title} className="flex gap-2"><span className="text-basil">→</span>{a.title}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Quando hai menu e ricette, l&apos;agente legge i numeri e ti prepara un piano d&apos;azione con priorità e impatto stimato.</p>
        )}
      </section>
    </div>
  );
}
