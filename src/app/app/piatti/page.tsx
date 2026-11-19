import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { ClassBadge, EmptyState, FoodCostBadge, PageHeader } from "@/components/ui";
import { eur } from "@/lib/costing";
import { loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";
import { saveRecipe, saveSales } from "../actions";

export default async function DishesPage() {
  const { restaurant } = await requireRestaurant();
  const { analysis } = await loadRestaurantData(restaurant);
  const groups = new Map<string, typeof analysis.dishes>();
  for (const d of analysis.dishes) {
    const key = d.category ?? "Senza sezione";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <div>
      <PageHeader
        title="Piatti"
        subtitle="Il tuo menu con costo, food cost e margine per piatto. Inserisci le vendite mensili (dal gestionale cassa) per attivare la menu engineering."
        actions={<Link href="/app/importa?tipo=menu" className="btn-primary">Importa menu da foto</Link>}
      />

      <form action={saveRecipe} className="card mb-6 grid gap-3 p-4 sm:grid-cols-[2fr_1.2fr_0.8fr_auto] sm:items-end">
        <input type="hidden" name="kind" value="dish" />
        <div><label className="label">Nuovo piatto</label><input name="name" required className="input" placeholder="Es. Carbonara" /></div>
        <div><label className="label">Sezione</label><input name="category" className="input" placeholder="Primi" /></div>
        <div><label className="label">Prezzo €</label><input name="price" inputMode="decimal" className="input" /></div>
        <SubmitButton>Crea</SubmitButton>
      </form>

      {analysis.dishes.length === 0 ? (
        <EmptyState title="Nessun piatto" text="Fotografa il menu: piatti, sezioni e prezzi verranno letti in automatico." href="/app/importa?tipo=menu" cta="Importa il menu" />
      ) : (
        <form action={saveSales} id="vendite">
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Piatto</th><th className="th text-right">Prezzo</th><th className="th text-right">Costo</th><th className="th">FC</th><th className="th text-right">Margine</th><th className="th">Classe</th><th className="th w-28">Vendite/mese</th>
                </tr>
              </thead>
              {[...groups.entries()].map(([cat, list]) => (
                <tbody key={cat}>
                  <tr className="bg-paper"><td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</td></tr>
                  {list.map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="td">
                        <Link href={`/app/piatti/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
                        {!d.hasRecipe && <span className="ml-2 rounded bg-amber-soft px-1.5 py-0.5 text-[11px] text-amber">senza ricetta</span>}
                        {d.warnings.length > 0 && <span className="ml-2 text-[11px] text-amber" title={d.warnings.join("\n")}>⚠ {d.warnings.length}</span>}
                      </td>
                      <td className="td tabular text-right">{eur(d.price)}</td>
                      <td className="td tabular text-right">{d.hasRecipe ? eur(d.cost) : "–"}</td>
                      <td className="td"><FoodCostBadge value={d.foodCostPct} target={restaurant.targetFoodCost} /></td>
                      <td className="td tabular text-right">{d.hasRecipe ? eur(d.margin) : "–"}</td>
                      <td className="td"><ClassBadge value={d.menuClass} /></td>
                      <td className="td"><input name={`sales:${d.id}`} defaultValue={d.monthlySales ?? ""} inputMode="numeric" className="input tabular py-1" aria-label={`Vendite di ${d.name}`} /></td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="mt-4 flex justify-end"><SubmitButton pendingText="Salvo…">Salva vendite</SubmitButton></div>
        </form>
      )}
    </div>
  );
}
