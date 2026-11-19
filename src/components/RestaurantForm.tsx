import { saveRestaurant } from "@/app/app/actions";
import type { Restaurant } from "@/lib/db/schema";

const TYPES = ["ristorante", "trattoria/osteria", "pizzeria", "ristorante-pizzeria", "bistrot", "pub/birreria", "bar/caffetteria", "fast casual/burger", "sushi/fusion", "ristorante di pesce", "fine dining", "altro"];

export function RestaurantForm({ restaurant, submitLabel }: { restaurant?: Restaurant | null; submitLabel: string }) {
  return (
    <form action={saveRestaurant} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Nome del locale</label>
          <input id="name" name="name" className="input" required defaultValue={restaurant?.name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="city">Città</label>
          <input id="city" name="city" className="input" defaultValue={restaurant?.city ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="type">Tipo di locale</label>
          <select id="type" name="type" className="input" defaultValue={restaurant?.type ?? "ristorante"}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="targetFoodCost">Food cost di riferimento (%)</label>
          <input id="targetFoodCost" name="targetFoodCost" type="number" step="0.5" min="5" max="80" className="input" defaultValue={restaurant?.targetFoodCost ?? 30} />
          <p className="mt-1 text-xs text-muted">Solo un riferimento: l&apos;agente lo adatta per categoria e posizionamento.</p>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="vatIncluded" name="vatIncluded" type="checkbox" className="h-4 w-4 accent-[#2f6b4f]" defaultChecked={restaurant?.vatIncluded ?? true} />
          <label htmlFor="vatIncluded" className="text-sm">I prezzi del menu sono IVA inclusa</label>
        </div>
        <div>
          <label className="label" htmlFor="vatRate">Aliquota IVA (%)</label>
          <input id="vatRate" name="vatRate" type="number" step="1" min="0" max="30" className="input" defaultValue={restaurant?.vatRate ?? 10} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Racconta il tuo locale all&apos;agente AI</label>
        <textarea id="notes" name="notes" rows={4} className="input" defaultValue={restaurant?.notes ?? ""}
          placeholder="Es. trattoria in centro, clientela di lavoratori a pranzo e turisti la sera, scontrino medio 28 €, vogliamo aumentare i margini senza perdere il pubblico del pranzo." />
      </div>
      <button className="btn-primary">{submitLabel}</button>
    </form>
  );
}
