import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";
import { restaurants } from "./db/schema";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export const getRestaurantForUser = cache(async (userId: string) => {
  const rows = await db.select().from(restaurants).where(eq(restaurants.userId, userId)).limit(1);
  return rows[0] ?? null;
});

/** Utente autenticato + ristorante. Se il ristorante non esiste, manda all'onboarding. */
export async function requireRestaurant() {
  const user = await requireUser();
  const restaurant = await getRestaurantForUser(user.id);
  if (!restaurant) redirect("/app/benvenuto");
  return { user, restaurant };
}
