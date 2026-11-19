import Link from "next/link";
import { MenuMatrix } from "@/components/MenuMatrix";
import { ClassBadge, EmptyState, FoodCostBadge, PageHeader, Stat } from "@/components/ui";
import { auditMenu, type Severity } from "@/lib/audit";
import { CLASS_LABELS, eur, pct, type MenuClass } from "@/lib/costing";
import { loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";

const SEV: Record<Severity, { label: string; className: string }> = {
  alta: { label: "Priorità alta", className: "bg-tomato-soft text-tomato" },
  media: { label: "Da migliorare", className: "bg-amber-soft text-amber" },
  bassa: { label: "Suggerimento", className: "bg-sky-soft text-sky" },
  ok: { label: "Ok", className: "bg-basil-soft text-basil" },
};

export default async function AuditPage() {
  const { restaurant } = await requireRestaurant();
  const { recipes, analysis } = await loadRestaurantData(restaurant);
  const dishes = recipes.filter((r) => r.kind === "dish");
  if (!dishes.length) {
    return (
      <div>
        <PageHeader title="Audit del menu" />
        <EmptyState title="Serve il menu" text="Importa il menu per avviare l'audit." href="/app/importa?tipo=menu" cta="Importa il menu" />
      </div>
    );
  }
  const { score, findings } = auditMenu(dishes, analysis, restaurant.targetFoodCost);
  const t = analysis.totals;
  const sorted = [...analysis.dishes].sort((a, b) => (b.foodCostPct ?? -1) - (a.foodCostPct ?? -1));
  const engineered = analysis.dishes.filter((d) => d.menuClass && (d.monthlySales ?? 0) > 0);
  const catGroups = new Map<string, typeof engineered>();
  for (const d of engineered) catGroups.set(d.category ?? "Senza sezione", [...(catGroups.get(d.category ?? "Senza sezione") ?? []), d]);
  const singles = [...catGroups.values()].filter((g) => g.length < 2).flat();
  const matrixGroups = [
    ...[...catGroups.entries()].filter(([, g]) => g.length >= 2).map(([title, dishes]) => ({ title, dishes })),
    ...(singles.length ? [{ title: "Sezioni con un solo piatto (confronto sull'intero menu)", dishes: singles, reference: engineered }] : []),
  ];
  const byClass = (["star", "plowhorse", "puzzle", "dog"] as MenuClass[]).map((c) => ({ c, list: analysis.dishes.filter((d) => d.menuClass === c) }));

  return (
    <div>
      <PageHeader
        title="Audit del menu"
        subtitle="Numeri, struttura e testi del menu: i punti forti da proteggere e quelli deboli su cui lavorare."
        actions={<><Link href="/app/ingegneria" className="btn-primary">Ingegneria avanzata</Link><Link href="/app/strategia" className="btn-secondary">Chiedi il piano all&apos;agente</Link><Link href="/app/menu-design" className="btn-secondary">Riprogetta il menu</Link></>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Punteggio audit" value={`${score}/100`} tone={score >= 75 ? "basil" : score >= 50 ? "amber" : "tomato"} hint="struttura, testi, dati ed economia" />
        <Stat label="Food cost medio" value={pct(t.weightedFoodCost ?? t.avgFoodCost)} />
        <Stat label="Piatti analizzati" value={`${t.withRecipe}/${t.dishCount}`} hint="con ricetta" />
        <Stat label="Margine mensile" value={eur(t.monthlyMargin, 0)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl font-semibold">Cosa abbiamo trovato</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {findings.map((f, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEV[f.severity].className}`}>{SEV[f.severity].label}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted">{f.area}</span>
              </div>
              <h3 className="mt-2 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-xl font-semibold">Matrice popolarità × margine</h2>
        {t.hasSales ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {matrixGroups.map((g) => <MenuMatrix key={g.title} title={g.title} dishes={g.dishes} reference={"reference" in g ? g.reference : undefined} />)}
              <p className="text-xs text-muted">Ogni piatto è confrontato con gli altri della stessa sezione (un dolce non compete con un secondo). Linee tratteggiate: soglia di popolarità (70% della quota media) e margine medio ponderato. Passa sopra un punto per i dettagli.</p>
            </div>
            <div className="space-y-3">
              {byClass.map(({ c, list }) => (
                <div key={c} className="card p-4">
                  <div className="flex items-center justify-between"><ClassBadge value={c} /><span className="text-xs text-muted">{list.length} piatti</span></div>
                  <p className="mt-2 text-xs text-muted">{CLASS_LABELS[c].hint}</p>
                  {list.length > 0 && <p className="mt-2 text-sm">{list.map((d) => d.name).join(", ")}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Mancano le vendite" text="Inserisci le porzioni vendute al mese per ogni piatto: le trovi nel report del gestionale cassa." href="/app/piatti#vendite" cta="Inserisci le vendite" />
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-xl font-semibold">Tutti i piatti</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line"><th className="th">Piatto</th><th className="th">Sezione</th><th className="th text-right">Prezzo</th><th className="th text-right">Costo</th><th className="th">FC</th><th className="th text-right">Margine</th><th className="th text-right">Margine/mese</th><th className="th">Classe</th></tr></thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="td"><Link href={`/app/piatti/${d.id}`} className="font-medium hover:underline">{d.name}</Link></td>
                  <td className="td text-muted">{d.category ?? "–"}</td>
                  <td className="td tabular text-right">{eur(d.price)}</td>
                  <td className="td tabular text-right">{d.hasRecipe ? eur(d.cost) : "–"}</td>
                  <td className="td"><FoodCostBadge value={d.foodCostPct} target={restaurant.targetFoodCost} /></td>
                  <td className="td tabular text-right">{d.hasRecipe ? eur(d.margin) : "–"}</td>
                  <td className="td tabular text-right">{eur(d.monthlyMargin, 0)}</td>
                  <td className="td"><ClassBadge value={d.menuClass} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
