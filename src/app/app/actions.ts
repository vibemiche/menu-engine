"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiEnabled, describeAiError, SCAN_MODEL } from "@/lib/ai/client";
import { runScan, type InvoiceScan, type MenuScan, type RecipeScan, type ScanInput, type ScanKind } from "@/lib/ai/scan";
import { generateStrategy } from "@/lib/ai/strategy";
import { loadPriceChanges, loadRestaurantData } from "@/lib/data";
import { db } from "@/lib/db";
import { aiUsage, ingredientPrices, ingredients, recipeItems, recipes, restaurants, strategyReports } from "@/lib/db/schema";
import { fatturaAsText, fatturaToInvoiceLines, parseFatturaPA } from "@/lib/fatturapa";
import { getRestaurantForUser, requireRestaurant, requireUser } from "@/lib/session";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const optStr = (v: FormDataEntryValue | null) => str(v) || null;
const numOr = (v: FormDataEntryValue | null, fallback: number | null = null) => {
  const s = str(v).replace(",", ".");
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

function refreshAll() {
  revalidatePath("/app", "layout");
}

/* ------------------------------- Ristorante ------------------------------ */

export async function saveRestaurant(formData: FormData) {
  const user = await requireUser();
  const existing = await getRestaurantForUser(user.id);
  const values = {
    name: str(formData.get("name")) || "Il mio ristorante",
    type: str(formData.get("type")) || "ristorante",
    city: optStr(formData.get("city")),
    notes: optStr(formData.get("notes")),
    vatIncluded: formData.get("vatIncluded") === "on",
    vatRate: numOr(formData.get("vatRate"), 10)!,
    targetFoodCost: Math.min(Math.max(numOr(formData.get("targetFoodCost"), 30)!, 5), 80),
  };
  if (existing) {
    await db.update(restaurants).set(values).where(eq(restaurants.id, existing.id));
    refreshAll();
  } else {
    await db.insert(restaurants).values({ ...values, userId: user.id });
    redirect("/app/importa");
  }
}

/* ------------------------------- Ingredienti ----------------------------- */

export async function saveIngredient(formData: FormData) {
  const { restaurant } = await requireRestaurant();
  const id = optStr(formData.get("id"));
  const price = Math.max(numOr(formData.get("price"), 0)!, 0);
  const unit = ["kg", "l", "pz"].includes(str(formData.get("unit"))) ? str(formData.get("unit")) : "kg";
  const values = {
    name: str(formData.get("name")) || "Senza nome",
    category: optStr(formData.get("category")),
    unit,
    price,
    wastePct: Math.min(Math.max(numOr(formData.get("wastePct"), 0)!, 0), 90),
    supplier: optStr(formData.get("supplier")),
    updatedAt: new Date(),
  };

  if (id) {
    const [current] = await db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.id, id), eq(ingredients.restaurantId, restaurant.id)));
    if (!current) return;
    await db.update(ingredients).set(values).where(eq(ingredients.id, id));
    if (current.price !== price || current.unit !== unit) {
      await db.insert(ingredientPrices).values({ ingredientId: id, price, unit, source: "manuale", supplier: values.supplier });
    }
  } else {
    const [created] = await db
      .insert(ingredients)
      .values({ ...values, restaurantId: restaurant.id })
      .returning({ id: ingredients.id });
    if (price > 0) {
      await db.insert(ingredientPrices).values({ ingredientId: created.id, price, unit, source: "manuale", supplier: values.supplier });
    }
  }
  refreshAll();
}

export async function deleteIngredient(id: string) {
  const { restaurant } = await requireRestaurant();
  await db.delete(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.restaurantId, restaurant.id)));
  refreshAll();
}

/* -------------------------------- Ricette -------------------------------- */

async function ownRecipe(recipeId: string, restaurantId: string) {
  const [r] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.restaurantId, restaurantId)));
  return r ?? null;
}

export async function saveRecipe(formData: FormData) {
  const { restaurant } = await requireRestaurant();
  const id = optStr(formData.get("id"));
  const kind = str(formData.get("kind")) === "prep" ? "prep" : "dish";
  const values = {
    kind,
    name: str(formData.get("name")) || "Senza nome",
    category: optStr(formData.get("category")),
    description: optStr(formData.get("description")),
    price: kind === "dish" ? numOr(formData.get("price")) : null,
    monthlySales: kind === "dish" ? (numOr(formData.get("monthlySales")) ?? null) : null,
    yieldQty: kind === "prep" ? numOr(formData.get("yieldQty")) : null,
    yieldUnit: kind === "prep" ? optStr(formData.get("yieldUnit")) ?? "kg" : null,
  };
  if (values.monthlySales != null) values.monthlySales = Math.round(Math.max(values.monthlySales, 0));

  if (id) {
    if (!(await ownRecipe(id, restaurant.id))) return;
    await db.update(recipes).set(values).where(eq(recipes.id, id));
    refreshAll();
  } else {
    const [created] = await db
      .insert(recipes)
      .values({ ...values, restaurantId: restaurant.id })
      .returning({ id: recipes.id });
    refreshAll();
    redirect(kind === "dish" ? `/app/piatti/${created.id}` : `/app/preparazioni/${created.id}`);
  }
}

export async function deleteRecipe(id: string) {
  const { restaurant } = await requireRestaurant();
  const r = await ownRecipe(id, restaurant.id);
  if (!r) return;
  await db.delete(recipes).where(eq(recipes.id, id));
  refreshAll();
  redirect(r.kind === "dish" ? "/app/piatti" : "/app/preparazioni");
}

export async function addRecipeItem(formData: FormData) {
  const { restaurant } = await requireRestaurant();
  const recipeId = str(formData.get("recipeId"));
  if (!(await ownRecipe(recipeId, restaurant.id))) return;
  const newName = str(formData.get("newName"));
  const ref = newName ? `new:${newName}` : str(formData.get("ref")); // "ing:<id>" | "prep:<id>" | "new:<nome>"
  const quantity = numOr(formData.get("quantity"), 0)!;
  const unit = ["g", "kg", "ml", "l", "pz"].includes(str(formData.get("unit"))) ? str(formData.get("unit")) : "g";
  if (!ref || quantity <= 0) return;

  let ingredientId: string | null = null;
  let prepId: string | null = null;
  if (ref.startsWith("ing:")) {
    const [ing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(and(eq(ingredients.id, ref.slice(4)), eq(ingredients.restaurantId, restaurant.id)));
    ingredientId = ing?.id ?? null;
  } else if (ref.startsWith("prep:")) {
    const prep = await ownRecipe(ref.slice(5), restaurant.id);
    if (prep && prep.kind === "prep" && prep.id !== recipeId) prepId = prep.id;
  } else if (ref.startsWith("new:")) {
    const baseUnit = unit === "g" || unit === "kg" ? "kg" : unit === "ml" || unit === "l" ? "l" : "pz";
    const [created] = await db
      .insert(ingredients)
      .values({ restaurantId: restaurant.id, name: ref.slice(4).trim() || "Nuovo ingrediente", unit: baseUnit, price: 0 })
      .returning({ id: ingredients.id });
    ingredientId = created.id;
  }
  if (!ingredientId && !prepId) return;
  await db.insert(recipeItems).values({ recipeId, ingredientId, prepId, quantity, unit });
  refreshAll();
}

export async function updateRecipeItem(formData: FormData) {
  const { restaurant } = await requireRestaurant();
  const id = str(formData.get("id"));
  const [row] = await db
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .innerJoin(recipes, eq(recipes.id, recipeItems.recipeId))
    .where(and(eq(recipeItems.id, id), eq(recipes.restaurantId, restaurant.id)));
  if (!row) return;
  const quantity = numOr(formData.get("quantity"), 0)!;
  const unit = ["g", "kg", "ml", "l", "pz"].includes(str(formData.get("unit"))) ? str(formData.get("unit")) : "g";
  await db.update(recipeItems).set({ quantity, unit }).where(eq(recipeItems.id, id));
  refreshAll();
}

export async function deleteRecipeItem(id: string) {
  const { restaurant } = await requireRestaurant();
  const [row] = await db
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .innerJoin(recipes, eq(recipes.id, recipeItems.recipeId))
    .where(and(eq(recipeItems.id, id), eq(recipes.restaurantId, restaurant.id)));
  if (!row) return;
  await db.delete(recipeItems).where(eq(recipeItems.id, id));
  refreshAll();
}

/** Aggiorna in blocco le vendite mensili (form "Vendite" nella pagina piatti). */
export async function saveSales(formData: FormData) {
  const { restaurant } = await requireRestaurant();
  const own = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.restaurantId, restaurant.id));
  const ownIds = new Set(own.map((r) => r.id));
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("sales:")) continue;
    const id = key.slice(6);
    if (!ownIds.has(id)) continue;
    const n = numOr(value);
    await db
      .update(recipes)
      .set({ monthlySales: n == null ? null : Math.round(Math.max(n, 0)) })
      .where(eq(recipes.id, id));
  }
  refreshAll();
}

/* ------------------------------- Scansioni ------------------------------- */

const ScanFileSchema = z.object({
  name: z.string(),
  mediaType: z.string(),
  data: z.string(), // base64 per immagini/pdf, testo per xml
});

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type ScanPayload =
  | { kind: "menu"; data: MenuScan }
  | { kind: "invoice"; data: InvoiceScan; source: "foto" | "xml" }
  | { kind: "recipe"; data: RecipeScan };

export async function scanDocuments(kind: ScanKind, files: z.infer<typeof ScanFileSchema>[]): Promise<Result<ScanPayload>> {
  const { restaurant } = await requireRestaurant();
  const parsed = z.array(ScanFileSchema).min(1).max(6).safeParse(files);
  if (!parsed.success) return { ok: false, error: "Carica da 1 a 6 file." };

  // Fatture elettroniche XML: lettura gratuita e precisa, l'AI serve solo a normalizzare unità e nomi.
  const xmlFiles = parsed.data.filter((f) => f.mediaType.includes("xml") || f.name.toLowerCase().endsWith(".xml"));
  if (kind === "invoice" && xmlFiles.length) {
    try {
      const fatture = xmlFiles.map((f) => parseFatturaPA(f.data));
      const lines = fatture.flatMap((f) => f.lines);
      if (!lines.length) return { ok: false, error: "Nessuna riga prodotto trovata nella fattura XML." };
      const merged = { supplier: fatture[0].supplier, date: fatture[0].date, number: fatture[0].number, lines };
      if (!aiEnabled()) {
        return {
          ok: true,
          data: { kind, source: "xml", data: { supplier: merged.supplier, date: merged.date, lines: fatturaToInvoiceLines(merged) } },
        };
      }
      const result = await runScan("invoice", [{ type: "text", text: fatturaAsText(merged) }]);
      await logUsage(restaurant.id, "invoice-xml", result.usage);
      return { ok: true, data: { kind, source: "xml", data: result.data as InvoiceScan } };
    } catch (e) {
      return { ok: false, error: `Fattura XML non leggibile: ${describeAiError(e)}` };
    }
  }

  if (!aiEnabled()) {
    return { ok: false, error: "La lettura delle foto richiede la chiave ANTHROPIC_API_KEY nel file .env." };
  }

  const inputs: ScanInput[] = [];
  for (const f of parsed.data) {
    if (f.data.length * 0.75 > MAX_FILE_BYTES) return { ok: false, error: `${f.name} è troppo grande (max 8 MB).` };
    if (f.mediaType === "application/pdf") inputs.push({ type: "pdf", data: f.data });
    else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.mediaType))
      inputs.push({ type: "image", mediaType: f.mediaType as "image/jpeg", data: f.data });
    else return { ok: false, error: `Formato non supportato: ${f.name}` };
  }

  try {
    const result = await runScan(kind, inputs);
    await logUsage(restaurant.id, kind, result.usage);
    if (kind === "menu") return { ok: true, data: { kind, data: result.data as MenuScan } };
    if (kind === "invoice") return { ok: true, data: { kind, source: "foto", data: result.data as InvoiceScan } };
    return { ok: true, data: { kind: "recipe", data: result.data as RecipeScan } };
  } catch (e) {
    return { ok: false, error: describeAiError(e) };
  }
}

async function logUsage(restaurantId: string, kind: string, usage: { inputTokens: number; outputTokens: number; model?: string }) {
  await db.insert(aiUsage).values({
    restaurantId,
    kind,
    model: usage.model ?? SCAN_MODEL,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
}

/* ------------------------------ Importazioni ----------------------------- */

const MenuImportSchema = z.array(
  z.object({
    name: z.string().min(1),
    category: z.string().nullable(),
    description: z.string().nullable(),
    price: z.number().nullable(),
    matchId: z.string().nullable(),
  }),
);

export async function importMenu(rows: z.infer<typeof MenuImportSchema>): Promise<Result<{ created: number; updated: number }>> {
  const { restaurant } = await requireRestaurant();
  const parsed = MenuImportSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Dati non validi." };
  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.restaurantId, restaurant.id), eq(recipes.kind, "dish")));
  const own = new Set(existing.map((r) => r.id));
  let created = 0;
  let updated = 0;
  let order = existing.length;
  for (const row of parsed.data) {
    if (row.matchId && own.has(row.matchId)) {
      await db
        .update(recipes)
        .set({ price: row.price, category: row.category, description: row.description })
        .where(eq(recipes.id, row.matchId));
      updated++;
    } else {
      await db.insert(recipes).values({
        restaurantId: restaurant.id,
        kind: "dish",
        name: row.name,
        category: row.category,
        description: row.description,
        price: row.price,
        sortOrder: order++,
      });
      created++;
    }
  }
  refreshAll();
  return { ok: true, data: { created, updated } };
}

const InvoiceImportSchema = z.object({
  supplier: z.string().nullable(),
  date: z.string().nullable(),
  source: z.enum(["foto", "xml"]),
  lines: z.array(
    z.object({
      name: z.string().min(1),
      category: z.string().nullable(),
      unit: z.enum(["kg", "l", "pz"]),
      unitPrice: z.number().min(0),
      matchId: z.string().nullable(),
    }),
  ),
});

export async function importInvoice(
  input: z.infer<typeof InvoiceImportSchema>,
): Promise<Result<{ created: number; updated: number }>> {
  const { restaurant } = await requireRestaurant();
  const parsed = InvoiceImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dati non validi." };
  const { supplier, date, source, lines } = parsed.data;
  const ids = lines.map((l) => l.matchId).filter((x): x is string => Boolean(x));
  const own = ids.length
    ? await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(and(eq(ingredients.restaurantId, restaurant.id), inArray(ingredients.id, ids)))
    : [];
  const ownIds = new Set(own.map((r) => r.id));
  let created = 0;
  let updated = 0;
  for (const l of lines) {
    let ingredientId = l.matchId && ownIds.has(l.matchId) ? l.matchId : null;
    if (ingredientId) {
      await db
        .update(ingredients)
        .set({ price: l.unitPrice, unit: l.unit, supplier: supplier ?? undefined, updatedAt: new Date() })
        .where(eq(ingredients.id, ingredientId));
      updated++;
    } else {
      const [row] = await db
        .insert(ingredients)
        .values({ restaurantId: restaurant.id, name: l.name, category: l.category, unit: l.unit, price: l.unitPrice, supplier })
        .returning({ id: ingredients.id });
      ingredientId = row.id;
      created++;
    }
    await db.insert(ingredientPrices).values({
      ingredientId,
      price: l.unitPrice,
      unit: l.unit,
      source,
      supplier,
      invoiceDate: date,
    });
  }
  refreshAll();
  return { ok: true, data: { created, updated } };
}

const RecipeImportSchema = z.object({
  target: z.string(), // id ricetta esistente oppure "new"
  kind: z.enum(["dish", "prep"]),
  title: z.string(),
  portions: z.number().nullable(),
  yieldQty: z.number().nullable(),
  yieldUnit: z.enum(["kg", "l", "pz"]).nullable(),
  replace: z.boolean(),
  lines: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().min(0),
      unit: z.enum(["g", "kg", "ml", "l", "pz"]),
      matchId: z.string().nullable(), // "ing:<id>" | "prep:<id>" | null = crea
    }),
  ),
});

export async function importRecipe(input: z.infer<typeof RecipeImportSchema>): Promise<Result<{ recipeId: string; kind: string }>> {
  const { restaurant } = await requireRestaurant();
  const parsed = RecipeImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dati non validi." };
  const p = parsed.data;
  const divisor = p.kind === "dish" && p.portions && p.portions > 1 ? p.portions : 1;

  let recipeId: string;
  if (p.target !== "new") {
    const r = await ownRecipe(p.target, restaurant.id);
    if (!r) return { ok: false, error: "Ricetta non trovata." };
    recipeId = r.id;
    if (r.kind === "prep" && p.yieldQty) {
      await db.update(recipes).set({ yieldQty: p.yieldQty, yieldUnit: p.yieldUnit ?? "kg" }).where(eq(recipes.id, r.id));
    }
    if (p.replace) await db.delete(recipeItems).where(eq(recipeItems.recipeId, recipeId));
  } else {
    const [row] = await db
      .insert(recipes)
      .values({
        restaurantId: restaurant.id,
        kind: p.kind,
        name: p.title || "Nuova ricetta",
        yieldQty: p.kind === "prep" ? p.yieldQty : null,
        yieldUnit: p.kind === "prep" ? p.yieldUnit ?? "kg" : null,
      })
      .returning({ id: recipes.id });
    recipeId = row.id;
  }

  const allIngs = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.restaurantId, restaurant.id));
  const ingIds = new Set(allIngs.map((i) => i.id));
  const allPreps = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.restaurantId, restaurant.id), eq(recipes.kind, "prep")));
  const prepIds = new Set(allPreps.map((r) => r.id));

  for (const l of p.lines) {
    if (l.quantity <= 0) continue;
    let ingredientId: string | null = null;
    let prepId: string | null = null;
    if (l.matchId?.startsWith("ing:") && ingIds.has(l.matchId.slice(4))) ingredientId = l.matchId.slice(4);
    else if (l.matchId?.startsWith("prep:") && prepIds.has(l.matchId.slice(5)) && l.matchId.slice(5) !== recipeId)
      prepId = l.matchId.slice(5);
    else {
      const baseUnit = l.unit === "g" || l.unit === "kg" ? "kg" : l.unit === "ml" || l.unit === "l" ? "l" : "pz";
      const [row] = await db
        .insert(ingredients)
        .values({ restaurantId: restaurant.id, name: l.name, unit: baseUnit, price: 0 })
        .returning({ id: ingredients.id });
      ingredientId = row.id;
      ingIds.add(row.id);
    }
    await db.insert(recipeItems).values({
      recipeId,
      ingredientId,
      prepId,
      quantity: Math.round((l.quantity / divisor) * 1000) / 1000,
      unit: l.unit,
    });
  }
  refreshAll();
  return { ok: true, data: { recipeId, kind: p.kind } };
}

/* ------------------------------ Agente AI -------------------------------- */

export async function runStrategy(): Promise<Result<{ id: string }>> {
  const { restaurant } = await requireRestaurant();
  if (!aiEnabled()) return { ok: false, error: "L'agente strategia richiede la chiave ANTHROPIC_API_KEY nel file .env." };
  const { analysis } = await loadRestaurantData(restaurant);
  if (analysis.totals.dishCount === 0) return { ok: false, error: "Aggiungi prima i piatti del menu." };
  const changes = await loadPriceChanges(restaurant.id);
  const changeLines = changes
    .slice(0, 20)
    .map((c) => `${c.name}: da ${c.from.toFixed(2)} a ${c.to.toFixed(2)} €/${c.unit} (${c.deltaPct > 0 ? "+" : ""}${c.deltaPct.toFixed(1)}%)`);
  try {
    const { strategy, model, usage } = await generateStrategy(restaurant, analysis, changeLines);
    const [row] = await db
      .insert(strategyReports)
      .values({ restaurantId: restaurant.id, model, data: JSON.stringify(strategy) })
      .returning({ id: strategyReports.id });
    await logUsage(restaurant.id, "strategy", { ...usage, model });
    refreshAll();
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return { ok: false, error: describeAiError(e) };
  }
}
