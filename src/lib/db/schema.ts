import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/* ------------------------------------------------------------------ */
/* Better Auth (user, session, account, verification) + username plugin */
/* ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/* ------------------------------------------------------------------ */
/* Dominio                                                             */
/* ------------------------------------------------------------------ */

export const restaurants = sqliteTable("restaurants", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("ristorante"),
  city: text("city"),
  /** Contesto libero per l'agente AI: posizionamento, clientela, obiettivi. */
  notes: text("notes"),
  /** I prezzi del menu includono l'IVA? */
  vatIncluded: integer("vat_included", { mode: "boolean" }).notNull().default(true),
  vatRate: real("vat_rate").notNull().default(10),
  /** Riferimento indicativo, non una regola: l'agente AI lo contestualizza. */
  targetFoodCost: real("target_food_cost").notNull().default(30),
  createdAt: createdAt(),
});

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    /** Unità di acquisto: kg | l | pz */
    unit: text("unit").notNull().default("kg"),
    /** Prezzo netto IVA per unità di acquisto */
    price: real("price").notNull().default(0),
    /** Scarto/calo peso in percentuale (0-90) */
    wastePct: real("waste_pct").notNull().default(0),
    supplier: text("supplier"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("ingredients_restaurant_idx").on(t.restaurantId)],
);

export const ingredientPrices = sqliteTable("ingredient_prices", {
  id: id(),
  ingredientId: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  price: real("price").notNull(),
  unit: text("unit").notNull(),
  source: text("source").notNull().default("manuale"),
  supplier: text("supplier"),
  invoiceDate: text("invoice_date"),
  createdAt: createdAt(),
});

/** Piatti e preparazioni (semilavorati) condividono la stessa struttura di ricetta. */
export const recipes = sqliteTable(
  "recipes",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    /** dish | prep */
    kind: text("kind").notNull().default("dish"),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    /** Prezzo di vendita (solo piatti) */
    price: real("price"),
    /** Porzioni vendute al mese (solo piatti) per la menu engineering */
    monthlySales: integer("monthly_sales"),
    /** Resa della preparazione (solo prep), es. 2 kg di ragù */
    yieldQty: real("yield_qty"),
    yieldUnit: text("yield_unit"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("recipes_restaurant_idx").on(t.restaurantId)],
);

export const recipeItems = sqliteTable(
  "recipe_items",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id").references(() => ingredients.id, { onDelete: "cascade" }),
    prepId: text("prep_id").references(() => recipes.id, { onDelete: "cascade" }),
    quantity: real("quantity").notNull(),
    /** g | kg | ml | l | pz */
    unit: text("unit").notNull().default("g"),
  },
  (t) => [index("recipe_items_recipe_idx").on(t.recipeId)],
);

export const strategyReports = sqliteTable("strategy_reports", {
  id: id(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  /** JSON del piano d'azione (vedi lib/ai/strategy.ts) */
  data: text("data").notNull(),
  createdAt: createdAt(),
});

/** Registro delle scansioni AI: serve a monitorare costi e limiti per piano. */
export const aiUsage = sqliteTable("ai_usage", {
  id: id(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: createdAt(),
});

export type Restaurant = typeof restaurants.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
