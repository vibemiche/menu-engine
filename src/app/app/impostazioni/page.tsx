import { desc, eq, sql } from "drizzle-orm";
import { RestaurantForm } from "@/components/RestaurantForm";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { requireRestaurant } from "@/lib/session";

export default async function SettingsPage() {
  const { user, restaurant } = await requireRestaurant();
  const usage = await db
    .select({ kind: aiUsage.kind, count: sql<number>`count(*)`, input: sql<number>`sum(${aiUsage.inputTokens})`, output: sql<number>`sum(${aiUsage.outputTokens})` })
    .from(aiUsage)
    .where(eq(aiUsage.restaurantId, restaurant.id))
    .groupBy(aiUsage.kind)
    .orderBy(desc(sql`count(*)`));
  const labels: Record<string, string> = { menu: "Foto menu", invoice: "Foto/PDF fatture", "invoice-xml": "Fatture XML", recipe: "Foto ricette", strategy: "Agente strategia" };

  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader title="Impostazioni" subtitle={`Account: ${user.email}${(user as { username?: string }).username ? ` · @${(user as { username?: string }).username}` : ""}`} />
      <RestaurantForm restaurant={restaurant} submitLabel="Salva" />
      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Utilizzo AI</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line"><tr><th className="th">Tipo</th><th className="th text-right">Richieste</th><th className="th text-right">Token in</th><th className="th text-right">Token out</th></tr></thead>
            <tbody>
              {usage.length === 0 && <tr><td className="td text-muted" colSpan={4}>Nessuna richiesta ancora.</td></tr>}
              {usage.map((u) => (
                <tr key={u.kind} className="border-b border-line last:border-0">
                  <td className="td">{labels[u.kind] ?? u.kind}</td>
                  <td className="td tabular text-right">{u.count}</td>
                  <td className="td tabular text-right">{Number(u.input).toLocaleString("it-IT")}</td>
                  <td className="td tabular text-right">{Number(u.output).toLocaleString("it-IT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
