import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { analyzeMenu } from "./costing";
import { db } from "./db";
import { ingredientPrices, ingredients, recipeItems, recipes, strategyReports, type Restaurant } from "./db/schema";

export async function loadRestaurantData(restaurant: Restaurant) {
  const [ings, recs] = await Promise.all([
    db.select().from(ingredients).where(eq(ingredients.restaurantId, restaurant.id)).orderBy(asc(ingredients.name)),
    db
      .select()
      .from(recipes)
      .where(eq(recipes.restaurantId, restaurant.id))
      .orderBy(asc(recipes.sortOrder), asc(recipes.name)),
  ]);
  const recipeIds = recs.map((r) => r.id);
  const items = recipeIds.length
    ? await db.select().from(recipeItems).where(inArray(recipeItems.recipeId, recipeIds))
    : [];
  const analysis = analyzeMenu(ings, recs, items, restaurant);
  return { ingredients: ings, recipes: recs, items, analysis };
}

/** Variazioni di prezzo tra l'ultimo e il penultimo acquisto, per l'agente e la dashboard. */
export async function loadPriceChanges(restaurantId: string) {
  const rows = await db
    .select({
      ingredientId: ingredientPrices.ingredientId,
      price: ingredientPrices.price,
      unit: ingredientPrices.unit,
      createdAt: ingredientPrices.createdAt,
      name: ingredients.name,
    })
    .from(ingredientPrices)
    .innerJoin(ingredients, eq(ingredients.id, ingredientPrices.ingredientId))
    .where(eq(ingredients.restaurantId, restaurantId))
    .orderBy(desc(ingredientPrices.createdAt));

  const byIng = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byIng.get(r.ingredientId) ?? [];
    if (list.length < 2) list.push(r);
    byIng.set(r.ingredientId, list);
  }
  const changes: { name: string; from: number; to: number; unit: string; deltaPct: number }[] = [];
  for (const [, list] of byIng) {
    if (list.length < 2 || list[1].price <= 0) continue;
    const [last, prev] = list;
    const deltaPct = ((last.price - prev.price) / prev.price) * 100;
    if (Math.abs(deltaPct) >= 1) changes.push({ name: last.name, from: prev.price, to: last.price, unit: last.unit, deltaPct });
  }
  return changes.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

export async function loadLatestStrategy(restaurantId: string) {
  const rows = await db
    .select()
    .from(strategyReports)
    .where(eq(strategyReports.restaurantId, restaurantId))
    .orderBy(desc(strategyReports.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
