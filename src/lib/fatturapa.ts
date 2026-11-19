import { XMLParser } from "fast-xml-parser";

/**
 * Lettura deterministica della fattura elettronica (FatturaPA / SDI).
 * Le righe estratte vengono poi normalizzate (unità e prezzi) dal modello economico,
 * oppure usate così come sono se l'AI non è configurata.
 */
export interface FatturaLine {
  description: string;
  quantity: number | null;
  unitOfMeasure: string | null;
  unitPrice: number | null;
  total: number | null;
}

export interface FatturaParsed {
  supplier: string | null;
  date: string | null;
  number: string | null;
  lines: FatturaLine[];
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findKey(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const found = findKey(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function parseFatturaPA(xml: string): FatturaParsed {
  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, processEntities: true });
  const doc = parser.parse(xml);
  const root = findKey(doc, "FatturaElettronica") ?? doc;
  const header = findKey(root, "CedentePrestatore");
  const anagrafica = findKey(header, "Anagrafica");
  const supplier =
    anagrafica?.Denominazione ??
    ([anagrafica?.Nome, anagrafica?.Cognome].filter(Boolean).join(" ") || null);
  const generali = findKey(root, "DatiGeneraliDocumento");
  const lines = asArray(findKey(root, "DettaglioLinee")).map((l) => ({
    description: String(l.Descrizione ?? "").trim(),
    quantity: num(l.Quantita),
    unitOfMeasure: l.UnitaMisura ? String(l.UnitaMisura) : null,
    unitPrice: num(l.PrezzoUnitario),
    total: num(l.PrezzoTotale),
  }));
  return {
    supplier: supplier ? String(supplier) : null,
    date: generali?.Data ? String(generali.Data) : null,
    number: generali?.Numero ? String(generali.Numero) : null,
    lines: lines.filter((l) => l.description && (l.total ?? 0) > 0),
  };
}

/** Normalizzazione minima senza AI: KG/LT riconosciuti, tutto il resto a pezzo. */
export function fatturaToInvoiceLines(f: FatturaParsed) {
  return f.lines.map((l) => {
    const um = (l.unitOfMeasure ?? "").toUpperCase();
    const unit = /^(KG|KGM|KILO)/.test(um) ? "kg" : /^(L|LT|LTR|LITRI)/.test(um) ? "l" : "pz";
    return {
      description: l.description,
      name: l.description.charAt(0).toUpperCase() + l.description.slice(1).toLowerCase(),
      category: null,
      quantity: l.quantity,
      unit: unit as "kg" | "l" | "pz",
      unitPrice: l.unitPrice ?? (l.total && l.quantity ? l.total / l.quantity : 0),
    };
  });
}

export function fatturaAsText(f: FatturaParsed): string {
  const rows = f.lines
    .map((l) => `- ${l.description} | quantità ${l.quantity ?? "?"} ${l.unitOfMeasure ?? ""} | prezzo unitario ${l.unitPrice ?? "?"} | totale ${l.total ?? "?"}`)
    .join("\n");
  return `Fattura elettronica di ${f.supplier ?? "fornitore sconosciuto"} del ${f.date ?? "?"}.\nRighe (prezzi netti IVA):\n${rows}`;
}
