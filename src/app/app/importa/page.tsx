import { ImportWizard } from "@/components/ImportWizard";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai/client";
import { loadRestaurantData } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ tipo?: string; ricetta?: string }> }) {
  const { tipo, ricetta } = await searchParams;
  const { restaurant } = await requireRestaurant();
  const { ingredients, recipes } = await loadRestaurantData(restaurant);
  const kind = tipo === "invoice" || tipo === "recipe" ? tipo : "menu";

  return (
    <div>
      <PageHeader
        title="Importa da foto"
        subtitle="Menu, fatture e ricette vengono letti in automatico. Rivedi sempre i dati prima di salvarli: bastano pochi secondi."
      />
      <ImportWizard
        initialKind={kind}
        targetRecipeId={ricetta ?? null}
        aiEnabled={aiEnabled()}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, price: i.price }))}
        dishes={recipes.filter((r) => r.kind === "dish").map((r) => ({ id: r.id, name: r.name }))}
        preps={recipes.filter((r) => r.kind === "prep").map((r) => ({ id: r.id, name: r.name }))}
      />
    </div>
  );
}
