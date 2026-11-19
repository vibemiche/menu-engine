import Link from "next/link";
import { MenuDesigner } from "@/components/MenuDesigner";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Strategy } from "@/lib/ai/strategy";
import { loadLatestStrategy, loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";

export default async function MenuDesignPage() {
  const { restaurant } = await requireRestaurant();
  const [{ recipes, analysis }, latest] = await Promise.all([loadRestaurantData(restaurant), loadLatestStrategy(restaurant.id)]);
  const strategy = latest ? (JSON.parse(latest.data) as Strategy) : null;
  const classById = new Map(analysis.dishes.map((d) => [d.id, d.menuClass]));
  const dishes = recipes
    .filter((r) => r.kind === "dish")
    .map((r) => ({ id: r.id, name: r.name, category: r.category, description: r.description, price: r.price, menuClass: classById.get(r.id) ?? null }));

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Nuovo menu"
          subtitle={
            strategy
              ? "Impaginato secondo il piano dell'agente: sezioni ordinate, piatti da spingere in evidenza in cima alla sezione, prezzi senza simbolo € e non incolonnati."
              : "Impaginazione basata sulla matrice: Star ed Enigmi in evidenza. Genera il piano con l'agente per ordine delle sezioni e descrizioni riscritte."
          }
          actions={!strategy ? <Link href="/app/strategia" className="btn-secondary">Genera il piano</Link> : undefined}
        />
      </div>
      {dishes.length === 0 ? (
        <EmptyState title="Nessun piatto" text="Importa il menu per generare la nuova versione." href="/app/importa?tipo=menu" cta="Importa il menu" />
      ) : (
        <MenuDesigner
          restaurantName={restaurant.name}
          city={restaurant.city}
          dishes={dishes}
          aiHighlights={strategy?.menuDesign.highlight ?? []}
          aiOrder={strategy?.menuDesign.categoryOrder ?? []}
          aiDescriptions={Object.fromEntries((strategy?.menuDesign.descriptions ?? []).map((d) => [d.dish.trim().toLowerCase(), d.text]))}
          aiRemove={(strategy?.dishNotes ?? []).filter((d) => d.verdict === "elimina").map((d) => d.dish)}
        />
      )}
    </div>
  );
}
