import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getClient, SCAN_MODEL } from "./client";

/* --------------------------------- Schemi -------------------------------- */

export const MenuScanSchema = z.object({
  dishes: z.array(
    z.object({
      name: z.string(),
      category: z.string().nullable(),
      description: z.string().nullable(),
      price: z.number().nullable(),
    }),
  ),
});

export const InvoiceScanSchema = z.object({
  supplier: z.string().nullable(),
  date: z.string().nullable().describe("Data documento in formato YYYY-MM-DD"),
  lines: z.array(
    z.object({
      description: z.string().describe("Descrizione originale della riga"),
      name: z.string().describe("Nome ingrediente pulito, es. 'Mozzarella fior di latte'"),
      category: z.string().nullable(),
      quantity: z.number().nullable().describe("Quantità totale acquistata espressa in 'unit'"),
      unit: z.enum(["kg", "l", "pz"]),
      unitPrice: z.number().describe("Prezzo netto IVA per 1 unità di 'unit' (€/kg, €/l o €/pz)"),
    }),
  ),
});

export const RecipeScanSchema = z.object({
  title: z.string().nullable(),
  isPreparation: z.boolean().describe("true se è un semilavorato (sugo, fondo, crema, impasto)"),
  portions: z.number().nullable(),
  yieldQty: z.number().nullable(),
  yieldUnit: z.enum(["kg", "l", "pz"]).nullable(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.enum(["g", "kg", "ml", "l", "pz"]),
    }),
  ),
});

export type MenuScan = z.infer<typeof MenuScanSchema>;
export type InvoiceScan = z.infer<typeof InvoiceScanSchema>;
export type RecipeScan = z.infer<typeof RecipeScanSchema>;
export type ScanKind = "menu" | "invoice" | "recipe";

/* -------------------------------- Prompt --------------------------------- */

// Prompt stabili: nessun dato variabile, così restano identici tra le richieste.
const PROMPTS: Record<ScanKind, string> = {
  menu: `Sei un assistente che digitalizza menu di ristoranti italiani.
Estrai TUTTI i piatti e le bevande visibili nel documento, nell'ordine in cui compaiono.
- category: il titolo della sezione (es. "Antipasti", "Pizze rosse"), null se assente.
- description: ingredienti o descrizione così come scritti, null se assente.
- price: prezzo in euro come numero (es. 12.5). Se ci sono più formati prendi quello principale. null se non leggibile.
Non inventare piatti o prezzi che non vedi.`,
  invoice: `Sei un assistente che legge fatture e bolle di fornitori della ristorazione italiana.
Estrai fornitore, data e le righe relative a prodotti alimentari o bevande (ignora trasporto, cauzioni, sconti generici, imballi).
Per ogni riga NORMALIZZA il prezzo all'unità base:
- unit "kg" per prodotti a peso, "l" per liquidi, "pz" solo per prodotti che si usano a pezzo (uova, bottiglie, burrate singole).
- unitPrice = prezzo netto IVA per 1 kg, 1 l o 1 pezzo. Esempio: "Mozzarella 1kg x 6 cartone, 42,00 €" → quantity 6, unit kg, unitPrice 7.
- Se la riga indica confezioni (CF, CT, conf.), usa il peso o volume per confezione indicato nella descrizione per convertire.
- Usa sconti di riga se presenti. Prezzi sempre al netto dell'IVA.
name è il nome pulito dell'ingrediente in italiano, senza codici, marchi superflui o formati.`,
  recipe: `Sei un assistente che digitalizza schede ricetta di cucine professionali (anche scritte a mano).
Estrai il titolo e gli ingredienti con quantità e unità.
- Converti unità informali: "un pizzico" → 1 g, "q.b." → 0 g, "1 cucchiaio d'olio" → 10 ml, "1 uovo" → 1 pz.
- Se la ricetta è per più porzioni indica portions; NON dividere tu le quantità.
- isPreparation = true se è un semilavorato (sugo, fondo, crema, impasto, salsa); in quel caso stima la resa totale in yieldQty/yieldUnit se indicata, altrimenti null.`,
};

/* ------------------------------- Esecuzione ------------------------------ */

export type ScanInput =
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }
  | { type: "pdf"; data: string }
  | { type: "text"; text: string };

const SCHEMAS = { menu: MenuScanSchema, invoice: InvoiceScanSchema, recipe: RecipeScanSchema } as const;

export interface ScanResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number; model: string };
}

export async function runScan<K extends ScanKind>(
  kind: K,
  inputs: ScanInput[],
): Promise<ScanResult<z.infer<(typeof SCHEMAS)[K]>>> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const input of inputs) {
    if (input.type === "image") {
      content.push({ type: "image", source: { type: "base64", media_type: input.mediaType, data: input.data } });
    } else if (input.type === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.data } });
    } else {
      content.push({ type: "text", text: input.text });
    }
  }
  content.push({ type: "text", text: "Estrai i dati dal documento." });

  const response = await getClient().messages.parse({
    model: SCAN_MODEL,
    max_tokens: 16000,
    // Estrazione: poco ragionamento serve, si risparmia su token e latenza.
    output_config: { effort: "low", format: zodOutputFormat(SCHEMAS[kind]) },
    system: PROMPTS[kind],
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("Il documento non può essere elaborato.");
  if (response.stop_reason === "max_tokens") throw new Error("Documento troppo lungo: caricalo in più parti.");
  if (!response.parsed_output) throw new Error("Non sono riuscito a leggere il documento. Prova con una foto più nitida.");

  return {
    data: response.parsed_output as z.infer<(typeof SCHEMAS)[K]>,
    usage: {
      inputTokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
      model: response.model,
    },
  };
}
