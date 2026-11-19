import Link from "next/link";
import { RunStrategyButton } from "@/components/RunStrategyButton";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Strategy } from "@/lib/ai/strategy";
import { aiEnabled } from "@/lib/ai/client";
import { eur } from "@/lib/costing";
import { loadLatestStrategy } from "@/lib/data";
import { requireRestaurant } from "@/lib/session";

const VERDICT: Record<string, string> = {
  mantieni: "bg-basil-soft text-basil",
  valorizza: "bg-sky-soft text-sky",
  correggi: "bg-amber-soft text-amber",
  ripensa: "bg-amber-soft text-amber",
  elimina: "bg-tomato-soft text-tomato",
};
const PRIORITIES = ["subito", "30 giorni", "90 giorni"] as const;

export default async function StrategyPage() {
  const { restaurant } = await requireRestaurant();
  const latest = await loadLatestStrategy(restaurant.id);
  const s = latest ? (JSON.parse(latest.data) as Strategy) : null;
  const totalImpact = s?.actions.reduce((sum, a) => sum + (a.impactEurMonth ?? 0), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Agente strategia"
        subtitle="Un consulente AI legge food cost, margini, vendite e rincari del tuo menu e ti prepara un piano d'azione con priorità. Le soglie non sono rigide: valuta il tuo tipo di locale e i volumi."
        actions={aiEnabled() ? <RunStrategyButton label={s ? "Rigenera il piano" : "Genera il piano"} /> : undefined}
      />
      {!aiEnabled() && <p className="mb-6 rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">Configura ANTHROPIC_API_KEY nel file .env per attivare l&apos;agente.</p>}

      {!s ? (
        <EmptyState title="Nessun piano ancora" text="Più dati inserisci (ricette, prezzi, vendite, note sul locale), più il piano sarà preciso." />
      ) : (
        <div className="space-y-8">
          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="font-serif text-xl font-semibold">Diagnosi</h2>
                <p className="mt-2 text-ink/80">{s.summary}</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center"><div className="tabular font-serif text-4xl font-semibold text-basil">{Math.round(s.healthScore)}</div><div className="text-xs text-muted">salute del menu</div></div>
                {totalImpact > 0 && <div className="text-center"><div className="tabular font-serif text-4xl font-semibold text-basil">+{eur(totalImpact, 0)}</div><div className="text-xs text-muted">margine stimato/mese</div></div>}
              </div>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div><h3 className="text-sm font-semibold text-basil">Punti forti</h3><ul className="mt-2 space-y-1.5 text-sm">{s.strengths.map((x) => <li key={x} className="flex gap-2"><span className="text-basil">+</span>{x}</li>)}</ul></div>
              <div><h3 className="text-sm font-semibold text-tomato">Punti deboli</h3><ul className="mt-2 space-y-1.5 text-sm">{s.weaknesses.map((x) => <li key={x} className="flex gap-2"><span className="text-tomato">−</span>{x}</li>)}</ul></div>
            </div>
            <p className="mt-6 text-xs text-muted">Generato il {latest!.createdAt.toLocaleDateString("it-IT")} · le stime sono indicative e vanno verificate sul campo.</p>
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold">Piano d&apos;azione</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {PRIORITIES.map((p) => (
                <div key={p}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{p === "subito" ? "Da fare subito" : `Entro ${p}`}</h3>
                  <div className="space-y-3">
                    {s.actions.filter((a) => a.priority === p).map((a) => (
                      <div key={a.title} className="card p-4">
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded-full bg-paper px-2 py-0.5 font-medium ring-1 ring-line">{a.type}</span>
                          <span className="rounded-full bg-paper px-2 py-0.5 ring-1 ring-line">sforzo {a.effort}</span>
                          {a.impactEurMonth ? <span className="rounded-full bg-basil-soft px-2 py-0.5 font-semibold text-basil">+{eur(a.impactEurMonth, 0)}/mese</span> : null}
                        </div>
                        <h4 className="mt-2 font-medium">{a.title}</h4>
                        <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.description}</p>
                        {a.dishes.length > 0 && <p className="mt-2 text-xs text-ink/70">Piatti: {a.dishes.join(", ")}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold">Piatto per piatto</h2>
            <div className="card divide-y divide-line">
              {s.dishNotes.map((d) => (
                <div key={d.dish} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT[d.verdict] ?? ""}`}>{d.verdict}</span>
                  <div><div className="font-medium">{d.dish}</div><div className="text-sm text-muted">{d.note}</div></div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold">Indicazioni per il nuovo menu</h2>
              <Link href="/app/menu-design" className="btn-primary">Genera il nuovo menu</Link>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">{s.menuDesign.principles.map((x) => <li key={x} className="flex gap-2"><span className="text-basil">→</span>{x}</li>)}</ul>
          </section>

          {s.missingData.length > 0 && (
            <section className="rounded-xl bg-amber-soft p-5 text-sm text-amber">
              <h2 className="font-semibold">Per un&apos;analisi più precisa servono</h2>
              <ul className="mt-2 list-disc pl-5">{s.missingData.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
