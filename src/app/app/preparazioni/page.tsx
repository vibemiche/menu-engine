import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { EmptyState, PageHeader } from "@/components/ui";
import { createCalculator, eur, toBase } from "@/lib/costing";
import { loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";
import { saveRecipe } from "../actions";

export default async function PrepsPage() {
  const { restaurant } = await requireRestaurant();
  const { ingredients, recipes, items } = await loadRestaurantData(restaurant);
  const preps = recipes.filter((r) => r.kind === "prep");
  const calc = createCalculator(ingredients, recipes, items);

  return (
    <div>
      <PageHeader
        title="Preparazioni"
        subtitle="Semilavorati come fondi, sughi, creme e impasti. Indica la resa: il costo verrà ripartito sui piatti in base alla quantità usata."
        actions={<Link href="/app/importa?tipo=recipe" className="btn-primary">Importa da foto</Link>}
      />
      <form action={saveRecipe} className="card mb-6 grid gap-3 p-4 sm:grid-cols-[2fr_0.8fr_0.7fr_auto] sm:items-end">
        <input type="hidden" name="kind" value="prep" />
        <div><label className="label">Nuova preparazione</label><input name="name" required className="input" placeholder="Es. Ragù di manzo" /></div>
        <div><label className="label">Resa</label><input name="yieldQty" inputMode="decimal" className="input" placeholder="2" /></div>
        <div><label className="label">Unità</label><select name="yieldUnit" className="input"><option>kg</option><option>l</option><option>pz</option></select></div>
        <SubmitButton>Crea</SubmitButton>
      </form>
      {preps.length === 0 ? (
        <EmptyState title="Nessuna preparazione" text="Aggiungi i semilavorati che usi in più piatti per arrivare a un food cost preciso al 100%." />
      ) : (
        <div className="card divide-y divide-line">
          {preps.map((p) => {
            const rc = calc.recipeCost(p.id);
            const y = p.yieldQty && p.yieldUnit ? toBase(p.yieldQty, p.yieldUnit) : null;
            return (
              <Link key={p.id} href={`/app/preparazioni/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-paper">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">{p.yieldQty ? `resa ${p.yieldQty} ${p.yieldUnit}` : <span className="text-amber">resa mancante</span>}</div>
                </div>
                <div className="tabular text-right text-sm">
                  <div>{eur(rc.cost)}</div>
                  <div className="text-xs text-muted">{y && y.qty > 0 ? `${eur(rc.cost / y.qty)}/${y.base}` : ""}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
