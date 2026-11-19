import Link from "next/link";
import { notFound } from "next/navigation";
import { addRecipeItem, deleteRecipe, deleteRecipeItem, saveRecipe, updateRecipeItem } from "@/app/app/actions";
import { CLASS_LABELS, createCalculator, eur, toBase } from "@/lib/costing";
import { loadRestaurantData } from "@/lib/data";
import type { Restaurant } from "@/lib/db/schema";
import { PriceSimulator } from "./PriceSimulator";
import { ConfirmButton, SubmitButton } from "./SubmitButton";
import { ClassBadge, FoodCostBadge, Stat } from "./ui";

const UNITS = ["g", "kg", "ml", "l", "pz"];

export async function RecipeEditor({ restaurant, recipeId, kind }: { restaurant: Restaurant; recipeId: string; kind: "dish" | "prep" }) {
  const { ingredients, recipes, items, analysis } = await loadRestaurantData(restaurant);
  const recipe = recipes.find((r) => r.id === recipeId && r.kind === kind);
  if (!recipe) notFound();

  const calc = createCalculator(ingredients, recipes, items);
  const rc = calc.recipeCost(recipe.id);
  const lineByItem = new Map(rc.lines.map((l) => [l.itemId, l]));
  const ownItems = items.filter((i) => i.recipeId === recipe.id);
  const dish = analysis.dishes.find((d) => d.id === recipe.id);
  const preps = recipes.filter((r) => r.kind === "prep" && r.id !== recipe.id);
  const ingName = new Map(ingredients.map((i) => [i.id, i]));
  const prepName = new Map(preps.map((p) => [p.id, p]));
  const back = kind === "dish" ? { href: "/app/piatti", label: "Piatti" } : { href: "/app/preparazioni", label: "Preparazioni" };
  const yieldBase = recipe.yieldQty && recipe.yieldUnit ? toBase(recipe.yieldQty, recipe.yieldUnit) : null;

  return (
    <div>
      <Link href={back.href} className="text-sm text-muted hover:text-ink">← {back.label}</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold">{recipe.name}</h1>
        {dish && <ClassBadge value={dish.menuClass} />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={kind === "dish" ? "Costo porzione" : "Costo totale"} value={eur(rc.cost)} />
        {kind === "dish" && dish ? (
          <>
            <Stat label="Food cost" value={<FoodCostBadge value={dish.foodCostPct} target={restaurant.targetFoodCost} />} hint={`prezzo netto ${eur(dish.netPrice)}`} />
            <Stat label="Margine a piatto" value={eur(dish.margin)} hint={dish.monthlyMargin != null ? `${eur(dish.monthlyMargin, 0)} al mese` : "inserisci le vendite"} />
            <Stat label="Prezzo consigliato" value={dish.suggestedPrice ? eur(dish.suggestedPrice) : "ok"} hint={dish.suggestedPrice ? `per tornare al ${restaurant.targetFoodCost}%` : "in linea col riferimento"} tone="basil" />
          </>
        ) : (
          <>
            <Stat label="Resa" value={recipe.yieldQty ? `${recipe.yieldQty} ${recipe.yieldUnit}` : "–"} hint="quantità finale prodotta" />
            <Stat label={`Costo per ${yieldBase?.base ?? "unità"}`} value={yieldBase && yieldBase.qty > 0 ? eur(rc.cost / yieldBase.qty) : "–"} />
            <Stat label="Usata in" value={`${items.filter((i) => i.prepId === recipe.id).length} ricette`} />
          </>
        )}
      </div>

      {dish?.menuClass && (
        <p className="mt-4 rounded-lg bg-card px-4 py-3 text-sm text-ink/80 ring-1 ring-line">
          <strong>{CLASS_LABELS[dish.menuClass].label}:</strong> {CLASS_LABELS[dish.menuClass].hint}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="border-b border-line px-5 py-4 font-semibold">{kind === "dish" ? "Ricetta per 1 porzione" : "Ricetta (per la resa indicata)"}</h2>
          <div className="divide-y divide-line">
            {ownItems.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nessun ingrediente. Aggiungili qui sotto o importa la ricetta da una foto.</p>}
            {ownItems.map((it) => {
              const line = lineByItem.get(it.id);
              const name = it.ingredientId ? ingName.get(it.ingredientId)?.name : `↳ ${prepName.get(it.prepId ?? "")?.name ?? "Preparazione"}`;
              return (
                <div key={it.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
                  <div className="min-w-[10rem] flex-1">
                    <div className="text-sm font-medium">{name}</div>
                    {line?.warning && <div className="text-[11px] text-amber">{line.warning}</div>}
                  </div>
                  <form action={updateRecipeItem} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={it.id} />
                    <input name="quantity" defaultValue={String(it.quantity).replace(".", ",")} inputMode="decimal" className="input tabular w-20 py-1.5" aria-label="Quantità" />
                    <select name="unit" defaultValue={it.unit} className="input w-[4.5rem] py-1.5" aria-label="Unità">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                    <button className="btn-ghost px-2 py-1.5 text-xs">Salva</button>
                  </form>
                  <span className="tabular w-20 text-right text-sm">{eur(line?.cost ?? 0)}</span>
                  <form action={deleteRecipeItem.bind(null, it.id)}>
                    <button className="btn-ghost px-2 py-1 text-tomato" aria-label="Rimuovi">✕</button>
                  </form>
                </div>
              );
            })}
          </div>
          <form action={addRecipeItem} className="grid gap-2 border-t border-line bg-paper/60 p-4 sm:grid-cols-[2fr_1.4fr_0.8fr_0.7fr_auto] sm:items-end">
            <input type="hidden" name="recipeId" value={recipe.id} />
            <div>
              <label className="label">Ingrediente</label>
              <select name="ref" className="input" defaultValue="">
                <option value="">Scegli…</option>
                <optgroup label="Ingredienti">{ingredients.map((i) => <option key={i.id} value={`ing:${i.id}`}>{i.name}</option>)}</optgroup>
                {preps.length > 0 && <optgroup label="Preparazioni">{preps.map((p) => <option key={p.id} value={`prep:${p.id}`}>{p.name}</option>)}</optgroup>}
              </select>
            </div>
            <div><label className="label">…o nuovo</label><input name="newName" className="input" placeholder="Nome nuovo ingrediente" /></div>
            <div><label className="label">Quantità</label><input name="quantity" required inputMode="decimal" className="input" /></div>
            <div><label className="label">Unità</label><select name="unit" className="input">{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <SubmitButton>Aggiungi</SubmitButton>
          </form>
        </section>

        <div className="space-y-6">
          {kind === "dish" && <PriceSimulator cost={rc.cost} price={recipe.price ?? 0} vatIncluded={restaurant.vatIncluded} vatRate={restaurant.vatRate} target={restaurant.targetFoodCost} />}

          <form action={saveRecipe} className="card space-y-3 p-5">
            <h3 className="font-semibold">Dettagli</h3>
            <input type="hidden" name="id" value={recipe.id} />
            <input type="hidden" name="kind" value={kind} />
            <div><label className="label">Nome</label><input name="name" defaultValue={recipe.name} className="input" /></div>
            <div><label className="label">{kind === "dish" ? "Sezione del menu" : "Categoria"}</label><input name="category" defaultValue={recipe.category ?? ""} className="input" /></div>
            {kind === "dish" ? (
              <>
                <div><label className="label">Descrizione nel menu</label><textarea name="description" rows={3} defaultValue={recipe.description ?? ""} className="input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Prezzo €</label><input name="price" inputMode="decimal" defaultValue={recipe.price != null ? String(recipe.price).replace(".", ",") : ""} className="input" /></div>
                  <div><label className="label">Vendite/mese</label><input name="monthlySales" inputMode="numeric" defaultValue={recipe.monthlySales ?? ""} className="input" /></div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Resa</label><input name="yieldQty" inputMode="decimal" defaultValue={recipe.yieldQty ?? ""} className="input" /></div>
                <div><label className="label">Unità</label><select name="yieldUnit" defaultValue={recipe.yieldUnit ?? "kg"} className="input"><option>kg</option><option>l</option><option>pz</option></select></div>
              </div>
            )}
            <SubmitButton className="btn-primary w-full">Salva</SubmitButton>
          </form>

          <div className="flex justify-between">
            <Link href={`/app/importa?tipo=recipe&ricetta=${recipe.id}`} className="btn-secondary">Importa ricetta da foto</Link>
            <form action={deleteRecipe.bind(null, recipe.id)}>
              <ConfirmButton className="btn-danger" message={`Eliminare ${recipe.name}?`}>Elimina</ConfirmButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
