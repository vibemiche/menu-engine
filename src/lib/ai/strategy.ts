import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CLASS_LABELS, type MenuAnalysis } from "../costing";
import { PAVESIC_LABELS, type EngineeringResult } from "../engineering";
import type { Restaurant } from "../db/schema";
import { getClient, STRATEGY_MODEL } from "./client";

export const StrategySchema = z.object({
  summary: z.string().describe("Diagnosi in 3-5 frasi, linguaggio semplice da ristoratore"),
  healthScore: z.number().describe("Salute economica del menu da 0 a 100"),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  actions: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe("Cosa fare concretamente, passo per passo"),
      type: z.enum(["prezzo", "porzione", "ricetta", "fornitore", "menu", "design", "comunicazione"]),
      dishes: z.array(z.string()),
      impactEurMonth: z.number().nullable().describe("Stima prudente del margine recuperato al mese in €"),
      effort: z.enum(["basso", "medio", "alto"]),
      priority: z.enum(["subito", "30 giorni", "90 giorni"]),
    }),
  ),
  dishNotes: z.array(
    z.object({
      dish: z.string(),
      verdict: z.enum(["mantieni", "valorizza", "correggi", "ripensa", "elimina"]),
      note: z.string(),
    }),
  ),
  menuDesign: z.object({
    principles: z.array(z.string()).describe("Indicazioni di impaginazione e grafica per questo menu"),
    highlight: z.array(z.string()).describe("Piatti da mettere in evidenza (box, prima posizione)"),
    categoryOrder: z.array(z.string()).describe("Ordine consigliato delle sezioni"),
    descriptions: z.array(z.object({ dish: z.string(), text: z.string() })).describe("Descrizioni riscritte per i piatti da spingere"),
  }),
  missingData: z.array(z.string()).describe("Dati mancanti che renderebbero l'analisi più precisa"),
});

export type Strategy = z.infer<typeof StrategySchema>;

const SYSTEM = `Sei un consulente di ristorazione esperto di food cost, menu engineering e menu design, al servizio di ristoranti indipendenti italiani.
Ricevi i dati economici di un menu già calcolati dal software e devi produrre una strategia con un piano d'azione concreto.

Come ragioni:
- Le soglie di food cost NON sono regole fisse: dipendono dal tipo di locale, dalla categoria (una pizza margherita può stare al 15%, un piatto di pesce crudo al 40% con un margine in euro alto), dal posizionamento e dai volumi. Il riferimento indicato dal ristoratore è un punto di partenza, non un vincolo.
- Ragiona sia in percentuale sia in margine in euro per piatto e al mese: a volte conviene un food cost più alto se il margine assoluto e i volumi crescono.
- Usa la classificazione di menu engineering (Star, Cavallo da tiro, Enigma, Cane) quando ci sono le vendite; se mancano, dillo e lavora su food cost e margini.
- Hai anche un'analisi avanzata: classi costo-margine di Pavesic, goal value di Hayes & Huffman (sopra 1 = in obiettivo), Pareto del margine (i piatti A vanno toccati con cautela), principi di Omnes sulla struttura prezzi (gamma, fasce, rapporto domanda/offerta), punto di pareggio degli aumenti di prezzo e rischio fornitori. Usali per motivare le priorità.
- Proponi azioni realistiche e graduali: ritocchi di prezzo piccoli (+0,50 €, +1 €), grammature, sostituzione di un ingrediente, rinegoziazione col fornitore, riposizionamento nel menu, riscrittura delle descrizioni, eliminazione dei piatti che non servono.
- Considera la psicologia del prezzo e il design del menu: posizioni di maggiore attenzione, box per i piatti da spingere, niente colonne di prezzi allineate, niente simbolo €, numero di piatti per sezione contenuto, descrizioni evocative ma brevi.
- Le stime d'impatto devono essere prudenti e basate sui dati forniti. Se un dato manca, non inventarlo: segnalalo in missingData.
- Scrivi in italiano semplice, senza gergo, rivolgendoti direttamente al ristoratore (tu).`;

function buildEngineering(e: EngineeringResult): string {
  const dishes = e.dishes
    .filter((d) => d.decisions[0]?.action !== "ricetta")
    .map((d) =>
      [
        d.name,
        d.pavesic ? `costo-margine ${PAVESIC_LABELS[d.pavesic].label}` : "",
        d.goalRatio != null ? `goal value ${d.goalRatio.toFixed(2)}` : "",
        d.abc ? `Pareto ${d.abc}` : "",
        d.priceTests[1] ? `+1€ pareggio a -${d.priceTests[1].breakEvenLossPct.toFixed(0)}% vendite` : "",
        d.portion ? `-10% ${d.portion.ingredient} = -${d.portion.savingPerDish.toFixed(2)}€/piatto` : "",
        d.risk ? `rischio ${d.risk.ingredient} (${(d.risk.share * 100).toFixed(0)}% del costo, prezzo variato ${d.risk.volatilityPct.toFixed(0)}%)` : "",
        `azione suggerita dal calcolo: ${d.decisions.map((x) => x.title).join("; ")}`,
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
  const sections = e.sections
    .map((s) => `${s.name}: FC ponderato ${s.weightedFoodCost?.toFixed(1) ?? "n/d"}%, gamma prezzi ×${s.spread?.toFixed(2) ?? "n/d"}, rapporto domanda/offerta ${s.demandPriceRatio?.toFixed(2) ?? "n/d"}${s.notes.length ? `. ${s.notes.join(" ")}` : ""}`)
    .join("\n");
  return `<ingegneria_avanzata>
Sezioni (principi di Omnes):
${sections}

Piatti (Pavesic, Hayes & Huffman, Pareto, sensibilità al prezzo):
${dishes}

Stress test: con +10% su tutti i costi il food cost medio diventa ${e.stress.allPlus10.foodCost?.toFixed(1) ?? "n/d"}%${e.stress.topIngredient ? `; +20% su ${e.stress.topIngredient.name} costa ${e.stress.topIngredient.plus20MonthlyLoss.toFixed(0)} € al mese` : ""}.
</ingegneria_avanzata>`;
}

function buildContext(restaurant: Restaurant, analysis: MenuAnalysis, priceChanges: string[]): string {
  const t = analysis.totals;
  const dishLines = analysis.dishes
    .map((d) => {
      const cls = d.menuClass ? CLASS_LABELS[d.menuClass].label : "n/d";
      return [
        d.name,
        d.category ?? "-",
        `prezzo ${d.price.toFixed(2)}`,
        d.hasRecipe ? `costo ${d.cost.toFixed(2)}` : "ricetta mancante",
        d.foodCostPct != null ? `FC ${d.foodCostPct.toFixed(1)}%` : "FC n/d",
        `margine ${d.margin.toFixed(2)}`,
        d.monthlySales != null ? `vendite/mese ${d.monthlySales}` : "vendite n/d",
        `classe ${cls}`,
        d.warnings.length ? `avvisi: ${d.warnings.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
  const critical = analysis.criticalIngredients
    .map((c) => `${c.name}: ${(c.share * 100).toFixed(1)}% del costo materie prime, in ${c.dishes} piatti`)
    .join("\n");

  return `<ristorante>
Nome: ${restaurant.name}
Tipo: ${restaurant.type}
Città: ${restaurant.city ?? "n/d"}
Prezzi menu ${restaurant.vatIncluded ? `IVA inclusa (aliquota ${restaurant.vatRate}%)` : "IVA esclusa"}
Food cost di riferimento indicato: ${restaurant.targetFoodCost}%
Note del titolare: ${restaurant.notes || "nessuna"}
</ristorante>

<totali>
Piatti: ${t.dishCount}, con ricetta: ${t.withRecipe}
Food cost medio semplice: ${t.avgFoodCost?.toFixed(1) ?? "n/d"}%
Food cost ponderato sulle vendite: ${t.weightedFoodCost?.toFixed(1) ?? "n/d"}%
Ricavo netto mensile stimato: ${t.monthlyRevenue?.toFixed(0) ?? "n/d"} €
Margine lordo mensile su materie prime: ${t.monthlyMargin?.toFixed(0) ?? "n/d"} €
Piatti sopra il riferimento: ${t.overTarget}
</totali>

<piatti>
${dishLines || "nessun piatto"}
</piatti>

<ingredienti_critici>
${critical || "n/d"}
</ingredienti_critici>

<variazioni_prezzi_fornitori>
${priceChanges.join("\n") || "nessuna variazione registrata"}
</variazioni_prezzi_fornitori>`;
}

export async function generateStrategy(restaurant: Restaurant, analysis: MenuAnalysis, priceChanges: string[], engineering?: EngineeringResult) {
  const response = await getClient().beta.messages.parse({
    model: STRATEGY_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: (process.env.STRATEGY_EFFORT as "low" | "medium" | "high" | undefined) ?? "medium",
      format: betaZodOutputFormat(StrategySchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${buildContext(restaurant, analysis, priceChanges)}${engineering ? `\n\n${buildEngineering(engineering)}` : ""}\n\nAnalizza questi dati e prepara la strategia con il piano d'azione. Le azioni suggerite dal calcolo sono un punto di partenza: confermale, correggile o scartale con il tuo giudizio.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("L'analisi non è stata completata. Riprova.");
  if (!response.parsed_output) throw new Error("Risposta dell'agente non valida. Riprova.");
  return {
    strategy: response.parsed_output,
    model: response.model,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}
