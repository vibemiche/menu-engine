import type { MenuAnalysis } from "./costing";

export type Severity = "alta" | "media" | "bassa" | "ok";

export interface AuditFinding {
  area: "Economia" | "Struttura" | "Testi" | "Dati";
  severity: Severity;
  title: string;
  detail: string;
}

interface AuditDish {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
}

/**
 * Audit strutturale del menu (regole euristiche, non vincolanti).
 * Integra i numeri del food cost con i problemi di impaginazione e testi
 * che l'agente AI e il generatore del nuovo menu useranno.
 */
export function auditMenu(dishes: AuditDish[], analysis: MenuAnalysis, targetFoodCost: number) {
  const findings: AuditFinding[] = [];
  const t = analysis.totals;

  // --- Economia
  if (t.withRecipe > 0) {
    const share = t.overTarget / t.withRecipe;
    findings.push(
      share > 0.3
        ? { area: "Economia", severity: "alta", title: `${t.overTarget} piatti su ${t.withRecipe} sopra il ${targetFoodCost}%`, detail: "Una parte rilevante del menu lavora con margini bassi. Parti dai piatti più venduti: lì ogni centesimo pesa di più." }
        : t.overTarget > 0
          ? { area: "Economia", severity: "media", title: `${t.overTarget} piatti sopra il riferimento`, detail: "Situazione gestibile: correggi prezzo, porzione o ricetta dei piatti segnalati." }
          : { area: "Economia", severity: "ok", title: "Food cost sotto controllo", detail: "Nessun piatto supera il riferimento impostato." },
    );
  }
  const classes = analysis.dishes.reduce<Record<string, number>>((acc, d) => {
    if (d.menuClass) acc[d.menuClass] = (acc[d.menuClass] ?? 0) + 1;
    return acc;
  }, {});
  const classified = Object.values(classes).reduce((a, b) => a + b, 0);
  if (classified >= 4) {
    if ((classes.dog ?? 0) / classified > 0.25)
      findings.push({ area: "Economia", severity: "alta", title: `${classes.dog} piatti "cane" (poco venduti e poco redditizi)`, detail: "Occupano spazio nel menu e in cucina. Valuta di toglierli o trasformarli: un menu più corto vende meglio." });
    if ((classes.plowhorse ?? 0) > 0)
      findings.push({ area: "Economia", severity: "media", title: `${classes.plowhorse} piatti molto venduti ma poco redditizi`, detail: "Sono i piatti su cui un ritocco di 0,50–1 € o una grammatura più precisa rende di più, perché moltiplicato per tante porzioni." });
    if ((classes.puzzle ?? 0) > 0)
      findings.push({ area: "Economia", severity: "bassa", title: `${classes.puzzle} piatti redditizi ma poco scelti`, detail: "Dagli più visibilità: prima posizione nella sezione, un box, una descrizione più invitante o il suggerimento del personale." });
  }

  // --- Struttura
  const byCat = new Map<string, AuditDish[]>();
  for (const d of dishes) byCat.set(d.category ?? "Senza sezione", [...(byCat.get(d.category ?? "Senza sezione") ?? []), d]);
  if (dishes.length > 45)
    findings.push({ area: "Struttura", severity: "media", title: `Menu lungo: ${dishes.length} voci`, detail: "Troppa scelta rallenta la decisione, aumenta gli sprechi e abbassa lo scontrino medio percepito. Punta a 5–8 proposte per sezione." });
  for (const [cat, list] of byCat) {
    if (list.length > 9)
      findings.push({ area: "Struttura", severity: "media", title: `"${cat}": ${list.length} piatti`, detail: "Sezione affollata: oltre 7–9 proposte il cliente tende a scegliere i piatti più economici o i primi in alto." });
    const prices = list.map((d) => d.price ?? 0).filter((p) => p > 0);
    if (prices.length >= 3) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (max / min > 2.5)
        findings.push({ area: "Struttura", severity: "bassa", title: `"${cat}": prezzi da ${min.toFixed(2)} a ${max.toFixed(2)} €`, detail: "Forbice ampia: il piatto più caro può fare da àncora, ma solo se è messo in evidenza e ben descritto." });
    }
  }
  if (byCat.has("Senza sezione") && byCat.size > 1)
    findings.push({ area: "Struttura", severity: "bassa", title: "Piatti senza sezione", detail: "Assegna una sezione a tutti i piatti per un'impaginazione ordinata." });

  const decimals = new Set(dishes.map((d) => (d.price != null ? Math.round((d.price % 1) * 100) : null)).filter((x) => x != null));
  if (decimals.size >= 4)
    findings.push({ area: "Struttura", severity: "bassa", title: "Prezzi con decimali disomogenei", detail: "Un menu con prezzi coerenti (es. tutti interi o tutti ,50) appare più curato e sposta l'attenzione dal prezzo al piatto." });

  // --- Testi
  const noDesc = dishes.filter((d) => !d.description?.trim());
  if (dishes.length && noDesc.length / dishes.length > 0.4)
    findings.push({ area: "Testi", severity: "media", title: `${noDesc.length} piatti senza descrizione`, detail: "Una descrizione breve (provenienza, tecnica, ingrediente distintivo) aumenta la scelta dei piatti che vuoi vendere." });
  const longDesc = dishes.filter((d) => (d.description?.length ?? 0) > 160);
  if (longDesc.length)
    findings.push({ area: "Testi", severity: "bassa", title: `${longDesc.length} descrizioni troppo lunghe`, detail: "Oltre le due righe il cliente smette di leggere. Tieni 8–20 parole." });
  findings.push({ area: "Testi", severity: "bassa", title: "Allergeni", detail: "Ricorda l'informativa sui 14 allergeni (Reg. UE 1169/2011): nel menu o con un rimando chiaro a un registro disponibile in sala." });

  // --- Dati
  const noRecipe = analysis.dishes.filter((d) => !d.hasRecipe).length;
  if (noRecipe)
    findings.push({ area: "Dati", severity: noRecipe / Math.max(dishes.length, 1) > 0.5 ? "alta" : "media", title: `${noRecipe} piatti senza ricetta`, detail: "Senza ricetta il food cost non è calcolabile: importale da foto o inseriscile a mano." });
  if (!t.hasSales)
    findings.push({ area: "Dati", severity: "media", title: "Vendite mensili mancanti", detail: "Con le quantità vendute (export dal gestionale cassa) si attiva la matrice di menu engineering e la stima del margine recuperabile." });
  const warnings = analysis.dishes.reduce((s, d) => s + d.warnings.length, 0);
  if (warnings)
    findings.push({ area: "Dati", severity: "media", title: `${warnings} avvisi nelle ricette`, detail: "Prezzi ingredienti mancanti, unità non compatibili o rese mancanti: correggili per un food cost preciso." });

  const weights: Record<Severity, number> = { alta: 14, media: 7, bassa: 2, ok: 0 };
  const score = Math.max(0, Math.min(100, 100 - findings.reduce((s, f) => s + weights[f.severity], 0)));
  const order: Record<Severity, number> = { alta: 0, media: 1, bassa: 2, ok: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, findings };
}
