import Link from "next/link";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/ui";
import { effectivePrice, eur } from "@/lib/costing";
import { loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";
import { deleteIngredient, saveIngredient } from "../actions";

export default async function IngredientsPage() {
  const { restaurant } = await requireRestaurant();
  const { ingredients, items } = await loadRestaurantData(restaurant);
  const usage = new Map<string, number>();
  for (const it of items) if (it.ingredientId) usage.set(it.ingredientId, (usage.get(it.ingredientId) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title="Ingredienti"
        subtitle="Prezzi netti IVA per kg, litro o pezzo. Lo scarto (pulizia, cottura, calo peso) fa salire il costo reale."
        actions={<Link href="/app/importa?tipo=invoice" className="btn-primary">Importa da fattura</Link>}
      />

      <form action={saveIngredient} className="card mb-6 grid gap-3 p-4 sm:grid-cols-[2fr_1fr_0.8fr_1fr_0.8fr_auto] sm:items-end">
        <div><label className="label">Nuovo ingrediente</label><input name="name" required className="input" placeholder="Es. Guanciale" /></div>
        <div><label className="label">Fornitore</label><input name="supplier" className="input" /></div>
        <div><label className="label">Unità</label><select name="unit" className="input"><option value="kg">kg</option><option value="l">l</option><option value="pz">pz</option></select></div>
        <div><label className="label">Prezzo €</label><input name="price" inputMode="decimal" className="input" placeholder="0,00" /></div>
        <div><label className="label">Scarto %</label><input name="wastePct" inputMode="decimal" className="input" placeholder="0" /></div>
        <SubmitButton>Aggiungi</SubmitButton>
      </form>

      {ingredients.length === 0 ? (
        <p className="text-sm text-muted">Nessun ingrediente. Il modo più rapido è caricare una fattura.</p>
      ) : (
        <div className="card divide-y divide-line">
          <div className="hidden grid-cols-[2fr_1fr_0.7fr_0.9fr_0.7fr_0.9fr_auto] gap-3 px-4 py-2 sm:grid">
            {["Nome", "Fornitore", "Unità", "Prezzo €", "Scarto %", "Costo reale", ""].map((h) => <span key={h} className="text-xs font-medium uppercase tracking-wide text-muted">{h}</span>)}
          </div>
          {ingredients.map((i) => (
            <div key={i.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[2fr_1fr_0.7fr_0.9fr_0.7fr_0.9fr_auto] sm:items-center sm:gap-3">
              <form id={`ing-${i.id}`} action={saveIngredient} className="contents">
                <input type="hidden" name="id" value={i.id} />
                <div>
                  <input name="name" defaultValue={i.name} className="input" aria-label="Nome" />
                  <div className="mt-1 text-[11px] text-muted">{usage.get(i.id) ? `usato in ${usage.get(i.id)} ricette` : "non usato"}{i.price <= 0 && <span className="ml-2 font-medium text-amber">prezzo mancante</span>}</div>
                </div>
                <input name="supplier" defaultValue={i.supplier ?? ""} className="input" aria-label="Fornitore" />
                <select name="unit" defaultValue={i.unit} className="input" aria-label="Unità"><option value="kg">kg</option><option value="l">l</option><option value="pz">pz</option></select>
                <input name="price" defaultValue={i.price ? String(i.price).replace(".", ",") : ""} inputMode="decimal" className={`input tabular ${i.price <= 0 ? "border-amber" : ""}`} aria-label="Prezzo" />
                <input name="wastePct" defaultValue={i.wastePct ? String(i.wastePct).replace(".", ",") : ""} inputMode="decimal" className="input tabular" aria-label="Scarto" />
                <span className="tabular text-sm">{eur(effectivePrice(i))}<span className="text-muted">/{i.unit}</span></span>
              </form>
              <div className="flex gap-1">
                <button form={`ing-${i.id}`} className="btn-secondary px-3">Salva</button>
                <form action={deleteIngredient.bind(null, i.id)}>
                  <ConfirmButton className="btn-ghost px-2 text-tomato" message={`Eliminare ${i.name}? Verrà tolto anche dalle ricette.`}>✕</ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
