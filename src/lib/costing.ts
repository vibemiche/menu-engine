/**
 * Motore di calcolo del food cost. Puro e senza dipendenze dal database,
 * così è testabile e riusabile sia lato server sia nel prompt dell'agente.
 */

export type ItemUnit = "g" | "kg" | "ml" | "l" | "pz";
export type BaseUnit = "kg" | "l" | "pz";

export interface CostIngredient {
  id: string;
  name: string;
  unit: string; // kg | l | pz
  price: number; // € netti per unità di acquisto
  wastePct: number;
}

export interface CostRecipe {
  id: string;
  kind: string; // dish | prep
  name: string;
  category: string | null;
  price: number | null;
  monthlySales: number | null;
  yieldQty: number | null;
  yieldUnit: string | null;
}

export interface CostItem {
  id: string;
  recipeId: string;
  ingredientId: string | null;
  prepId: string | null;
  quantity: number;
  unit: string;
}

export interface Settings {
  vatIncluded: boolean;
  vatRate: number;
  targetFoodCost: number;
}

export interface LineCost {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  warning?: string;
}

export interface RecipeCost {
  cost: number;
  lines: LineCost[];
  warnings: string[];
  /** Costo per ingrediente (id → €), con le preparazioni esplose in proporzione */
  breakdown: Map<string, number>;
}

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export interface DishAnalysis {
  id: string;
  name: string;
  category: string | null;
  price: number;
  netPrice: number;
  cost: number;
  foodCostPct: number | null;
  margin: number;
  monthlySales: number | null;
  monthlyMargin: number | null;
  menuClass: MenuClass | null;
  suggestedPrice: number | null;
  hasRecipe: boolean;
  warnings: string[];
}

export const CLASS_LABELS: Record<MenuClass, { label: string; hint: string }> = {
  star: { label: "Star", hint: "Molto venduto e ad alto margine: proteggilo e dagli visibilità." },
  plowhorse: { label: "Cavallo da tiro", hint: "Molto venduto ma margine basso: lavora su porzione, ricetta o prezzo." },
  puzzle: { label: "Enigma", hint: "Buon margine ma poco venduto: riposizionalo nel menu e riscrivi la descrizione." },
  dog: { label: "Cane", hint: "Poco venduto e margine basso: ripensalo o toglilo." },
};

export function toBase(quantity: number, unit: string): { qty: number; base: BaseUnit } {
  switch (unit) {
    case "g":
      return { qty: quantity / 1000, base: "kg" };
    case "kg":
      return { qty: quantity, base: "kg" };
    case "ml":
      return { qty: quantity / 1000, base: "l" };
    case "cl":
      return { qty: quantity / 100, base: "l" };
    case "l":
      return { qty: quantity, base: "l" };
    default:
      return { qty: quantity, base: "pz" };
  }
}

/** Converte una quantità nell'unità base richiesta; kg e l sono trattati come equivalenti (densità ≈ 1). */
function convert(quantity: number, unit: string, target: string): { qty: number; approx: boolean } | null {
  const { qty, base } = toBase(quantity, unit);
  if (base === target) return { qty, approx: false };
  if ((base === "kg" && target === "l") || (base === "l" && target === "kg")) return { qty, approx: true };
  return null;
}

export function effectivePrice(ing: Pick<CostIngredient, "price" | "wastePct">): number {
  const waste = Math.min(Math.max(ing.wastePct || 0, 0), 95);
  return ing.price / (1 - waste / 100);
}

export function netPrice(price: number, s: Settings): number {
  return s.vatIncluded ? price / (1 + s.vatRate / 100) : price;
}

/** Prezzo lordo consigliato per tornare al food cost di riferimento, arrotondato ai 50 centesimi. */
export function suggestPrice(cost: number, s: Settings, targetPct = s.targetFoodCost): number {
  const net = cost / (targetPct / 100);
  const gross = s.vatIncluded ? net * (1 + s.vatRate / 100) : net;
  return Math.ceil(gross * 2) / 2;
}

export function createCalculator(ingredients: CostIngredient[], recipes: CostRecipe[], items: CostItem[]) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recById = new Map(recipes.map((r) => [r.id, r]));
  const itemsByRecipe = new Map<string, CostItem[]>();
  for (const it of items) {
    const list = itemsByRecipe.get(it.recipeId) ?? [];
    list.push(it);
    itemsByRecipe.set(it.recipeId, list);
  }
  const memo = new Map<string, RecipeCost>();

  function recipeCost(recipeId: string, stack: Set<string> = new Set()): RecipeCost {
    const cached = memo.get(recipeId);
    if (cached) return cached;
    const result: RecipeCost = { cost: 0, lines: [], warnings: [], breakdown: new Map() };
    if (stack.has(recipeId)) {
      result.warnings.push("Riferimento circolare tra preparazioni");
      return result;
    }
    stack.add(recipeId);

    for (const it of itemsByRecipe.get(recipeId) ?? []) {
      if (it.ingredientId) {
        const ing = ingById.get(it.ingredientId);
        if (!ing) continue;
        const conv = convert(it.quantity, it.unit, ing.unit);
        let cost = 0;
        let warning: string | undefined;
        if (!conv) {
          warning = `Unità non compatibile (${it.unit} vs ${ing.unit})`;
        } else {
          cost = conv.qty * effectivePrice(ing);
          if (conv.approx) warning = "Conversione kg/l approssimata";
        }
        if (ing.price <= 0) warning = "Prezzo ingrediente mancante";
        if (warning) result.warnings.push(`${ing.name}: ${warning}`);
        result.cost += cost;
        result.lines.push({ itemId: it.id, name: ing.name, quantity: it.quantity, unit: it.unit, cost, warning });
        result.breakdown.set(ing.id, (result.breakdown.get(ing.id) ?? 0) + cost);
      } else if (it.prepId) {
        const prep = recById.get(it.prepId);
        if (!prep) continue;
        const sub = recipeCost(prep.id, stack);
        const yieldBase = prep.yieldQty && prep.yieldUnit ? toBase(prep.yieldQty, prep.yieldUnit) : null;
        let cost = 0;
        let warning: string | undefined;
        if (!yieldBase || yieldBase.qty <= 0) {
          warning = "Resa della preparazione mancante";
        } else {
          const conv = convert(it.quantity, it.unit, yieldBase.base);
          if (!conv) warning = `Unità non compatibile (${it.unit} vs ${prep.yieldUnit})`;
          else {
            const ratio = conv.qty / yieldBase.qty;
            cost = sub.cost * ratio;
            for (const [ingId, c] of sub.breakdown) {
              result.breakdown.set(ingId, (result.breakdown.get(ingId) ?? 0) + c * ratio);
            }
          }
        }
        if (warning) result.warnings.push(`${prep.name}: ${warning}`);
        result.cost += cost;
        result.lines.push({ itemId: it.id, name: `↳ ${prep.name}`, quantity: it.quantity, unit: it.unit, cost, warning });
      }
    }
    stack.delete(recipeId);
    memo.set(recipeId, result);
    return result;
  }

  return { recipeCost };
}

export interface MenuAnalysis {
  dishes: DishAnalysis[];
  totals: {
    dishCount: number;
    withRecipe: number;
    avgFoodCost: number | null;
    weightedFoodCost: number | null;
    monthlyRevenue: number | null;
    monthlyMargin: number | null;
    overTarget: number;
    hasSales: boolean;
  };
  criticalIngredients: { id: string; name: string; monthlyCost: number; share: number; dishes: number }[];
}

export function analyzeMenu(
  ingredients: CostIngredient[],
  recipes: CostRecipe[],
  items: CostItem[],
  settings: Settings,
): MenuAnalysis {
  const calc = createCalculator(ingredients, recipes, items);
  const dishes = recipes.filter((r) => r.kind === "dish");
  const itemCount = new Map<string, number>();
  for (const it of items) itemCount.set(it.recipeId, (itemCount.get(it.recipeId) ?? 0) + 1);

  const analyses: DishAnalysis[] = dishes.map((d) => {
    const rc = calc.recipeCost(d.id);
    const price = d.price ?? 0;
    const net = netPrice(price, settings);
    const hasRecipe = (itemCount.get(d.id) ?? 0) > 0;
    const fc = hasRecipe && net > 0 ? (rc.cost / net) * 100 : null;
    const margin = net - rc.cost;
    const sales = d.monthlySales ?? null;
    return {
      id: d.id,
      name: d.name,
      category: d.category,
      price,
      netPrice: net,
      cost: rc.cost,
      foodCostPct: fc,
      margin,
      monthlySales: sales,
      monthlyMargin: sales != null && hasRecipe ? margin * sales : null,
      menuClass: null,
      suggestedPrice:
        hasRecipe && fc != null && fc > settings.targetFoodCost ? suggestPrice(rc.cost, settings) : null,
      hasRecipe,
      warnings: rc.warnings,
    };
  });

  // Menu engineering (metodo Kasavana & Smith) sui piatti con ricetta e vendite.
  // Il confronto avviene tra piatti della stessa sezione (un dolce non compete con un secondo);
  // le sezioni con un solo piatto analizzabile vengono confrontate con l'intero menu.
  const engineered = analyses.filter((a) => a.hasRecipe && (a.monthlySales ?? 0) > 0);
  const classify = (group: DishAnalysis[], targets: DishAnalysis[]) => {
    const sales = group.reduce((s, a) => s + (a.monthlySales ?? 0), 0);
    if (group.length < 2 || sales <= 0) return;
    const popThreshold = (1 / group.length) * 0.7;
    const avgMargin = group.reduce((s, a) => s + a.margin * (a.monthlySales ?? 0), 0) / sales;
    for (const a of targets) {
      const popular = (a.monthlySales ?? 0) / sales >= popThreshold;
      const profitable = a.margin >= avgMargin;
      a.menuClass = popular ? (profitable ? "star" : "plowhorse") : profitable ? "puzzle" : "dog";
    }
  };
  const byCategory = new Map<string, DishAnalysis[]>();
  for (const a of engineered) byCategory.set(a.category ?? "", [...(byCategory.get(a.category ?? "") ?? []), a]);
  const singles: DishAnalysis[] = [];
  for (const group of byCategory.values()) {
    if (group.length >= 2) classify(group, group);
    else singles.push(...group);
  }
  if (singles.length) classify(engineered, singles);

  const withRecipe = analyses.filter((a) => a.foodCostPct != null);
  const hasSales = engineered.length > 0;
  const revenue = hasSales ? engineered.reduce((s, a) => s + a.netPrice * (a.monthlySales ?? 0), 0) : null;
  const costTotal = hasSales ? engineered.reduce((s, a) => s + a.cost * (a.monthlySales ?? 0), 0) : null;

  // Ingredienti critici: peso sul costo totale (pesato sulle vendite se disponibili)
  const ingTotals = new Map<string, { cost: number; dishes: Set<string> }>();
  for (const d of dishes) {
    const weight = hasSales ? d.monthlySales ?? 0 : 1;
    if (weight <= 0) continue;
    for (const [ingId, c] of calc.recipeCost(d.id).breakdown) {
      const e = ingTotals.get(ingId) ?? { cost: 0, dishes: new Set<string>() };
      e.cost += c * weight;
      e.dishes.add(d.id);
      ingTotals.set(ingId, e);
    }
  }
  const grand = [...ingTotals.values()].reduce((s, e) => s + e.cost, 0);
  const ingName = new Map(ingredients.map((i) => [i.id, i.name]));
  const criticalIngredients = [...ingTotals.entries()]
    .map(([id, e]) => ({
      id,
      name: ingName.get(id) ?? "?",
      monthlyCost: e.cost,
      share: grand > 0 ? e.cost / grand : 0,
      dishes: e.dishes.size,
    }))
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 10);

  return {
    dishes: analyses,
    totals: {
      dishCount: analyses.length,
      withRecipe: withRecipe.length,
      avgFoodCost: withRecipe.length
        ? withRecipe.reduce((s, a) => s + (a.foodCostPct ?? 0), 0) / withRecipe.length
        : null,
      weightedFoodCost: revenue && costTotal != null && revenue > 0 ? (costTotal / revenue) * 100 : null,
      monthlyRevenue: revenue,
      monthlyMargin: revenue != null && costTotal != null ? revenue - costTotal : null,
      overTarget: withRecipe.filter((a) => (a.foodCostPct ?? 0) > settings.targetFoodCost).length,
      hasSales,
    },
    criticalIngredients,
  };
}

export const eur = (n: number | null | undefined, digits = 2) =>
  n == null || Number.isNaN(n)
    ? "–"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

export const pct = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "–" : `${n.toFixed(1).replace(".", ",")}%`);
