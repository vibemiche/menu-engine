/**
 * Ingegneria del menu avanzata (secondo livello, sopra la matrice Kasavana & Smith).
 *
 * Modelli usati, tutti calcolati PER SEZIONE (i piatti competono solo con quelli della stessa sezione):
 * 1. Analisi costo-margine di Pavesic: food cost % ponderato × margine di contribuzione ponderato.
 * 2. Goal Value Analysis di Hayes & Huffman: un unico punteggio che combina food cost, volume,
 *    prezzo e costi variabili non alimentari, confrontato con l'obiettivo della sezione.
 * 3. Analisi ABC (Pareto) sul margine totale: quali piatti portano l'80% del margine.
 * 4. Principi di Omnes sulla struttura prezzi: ampiezza della gamma, distribuzione in fasce,
 *    rapporto domanda/offerta di prezzo (quanto i clienti scelgono i piatti cari o economici).
 * 5. Sensibilità al prezzo: quante vendite si possono perdere con +0,50/+1 € prima di perdere margine.
 * 6. Leva porzione: risparmio riducendo del 10% l'ingrediente più costoso.
 * 7. Rischio ingredienti: esposizione a ingredienti con prezzi instabili e stress test.
 * 8. Simulazione dello spostamento delle scelte (effetto del menu che guida le scelte).
 *
 * Il risultato finale è un motore di decisione: un'azione principale per piatto con impatto stimato.
 */

import type { DishAnalysis, MenuAnalysis, Settings } from "./costing";

export type PavesicClass = "prime" | "standard" | "sleeper" | "problem";
export type AbcClass = "A" | "B" | "C";
export type ActionType = "ricetta" | "prezzo" | "porzione" | "posizione" | "proteggi" | "elimina" | "fornitore" | "monitora";

export const PAVESIC_LABELS: Record<PavesicClass, { label: string; hint: string }> = {
  prime: { label: "Primario", hint: "Food cost basso e margine alto: il piatto ideale da vendere." },
  standard: { label: "Standard", hint: "Margine alto ma food cost alto: rende in euro, ma è esposto ai rincari." },
  sleeper: { label: "Dormiente", hint: "Food cost basso ma margine basso: spesso un prezzo troppo basso." },
  problem: { label: "Problematico", hint: "Food cost alto e margine basso: da riformulare o togliere." },
};

export interface EngineeringSettings extends Settings {
  /** Costi variabili non alimentari in % del prezzo netto (personale a ore, energia, packaging, commissioni) */
  variableCostPct: number;
}

export interface PriceTest {
  delta: number;
  newPrice: number;
  netGainPerDish: number;
  /** Quota di vendite che si può perdere prima che l'aumento diventi controproducente */
  breakEvenLossPct: number;
  monthlyGainNoLoss: number | null;
}

export interface Decision {
  action: ActionType;
  title: string;
  detail: string;
  impactMonth: number | null;
  priority: 1 | 2 | 3;
}

export interface DishEngineering {
  id: string;
  name: string;
  category: string;
  pavesic: PavesicClass | null;
  goalValue: number | null;
  goalRatio: number | null;
  volumeToGoal: number | null;
  abc: AbcClass | null;
  marginShare: number | null;
  priceTests: PriceTest[];
  portion: { ingredient: string; savingPerDish: number; newFoodCostPct: number | null; monthlySaving: number | null } | null;
  risk: { ingredient: string; share: number; volatilityPct: number } | null;
  decisions: Decision[];
}

export interface SectionEngineering {
  name: string;
  dishCount: number;
  priceMin: number | null;
  priceMax: number | null;
  spread: number | null;
  spreadOk: boolean | null;
  zones: { low: number; mid: number; high: number } | null;
  zonesOk: boolean | null;
  demandPriceRatio: number | null;
  weightedFoodCost: number | null;
  weightedMargin: number | null;
  revenueShare: number | null;
  goalTarget: number | null;
  notes: string[];
}

export interface EngineeringResult {
  dishes: DishEngineering[];
  sections: SectionEngineering[];
  abcSummary: { A: number; B: number; C: number; aMarginShare: number } | null;
  stress: { allPlus10: { foodCost: number | null; monthlyLoss: number | null }; topIngredient: { name: string; plus20MonthlyLoss: number } | null };
  hasSales: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function engineerMenu(
  analysis: MenuAnalysis,
  settings: EngineeringSettings,
  volatility: Map<string, number> = new Map(),
): EngineeringResult {
  const all = analysis.dishes.filter((d) => d.hasRecipe && d.netPrice > 0);
  const hasSales = all.some((d) => (d.monthlySales ?? 0) > 0);
  const vol = (d: DishAnalysis) => (hasSales ? d.monthlySales ?? 0 : 1);
  const varPct = Math.min(Math.max(settings.variableCostPct, 0), 80) / 100;
  const netOf = (gross: number) => (settings.vatIncluded ? gross / (1 + settings.vatRate / 100) : gross);

  // ---------------------------------------------------------------- sezioni
  const byCat = new Map<string, DishAnalysis[]>();
  for (const d of analysis.dishes) byCat.set(d.category ?? "Senza sezione", [...(byCat.get(d.category ?? "Senza sezione") ?? []), d]);
  const totalRevenue = sum(all.map((d) => d.netPrice * vol(d)));

  const pavesic = new Map<string, PavesicClass>();
  const goal = new Map<string, { gv: number; ratio: number; toGoal: number | null }>();
  const sections: SectionEngineering[] = [];

  for (const [name, list] of byCat) {
    const costed = list.filter((d) => d.hasRecipe && d.netPrice > 0);
    const prices = list.map((d) => d.price).filter((p) => p > 0);
    const notes: string[] = [];
    const sec: SectionEngineering = {
      name,
      dishCount: list.length,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      spread: null,
      spreadOk: null,
      zones: null,
      zonesOk: null,
      demandPriceRatio: null,
      weightedFoodCost: null,
      weightedMargin: null,
      revenueShare: null,
      goalTarget: null,
      notes,
    };

    // Omnes 1: ampiezza della gamma prezzi
    if (prices.length >= 3 && sec.priceMin && sec.priceMax) {
      sec.spread = sec.priceMax / sec.priceMin;
      const limit = prices.length >= 10 ? 3 : 2.5;
      sec.spreadOk = sec.spread <= limit;
      if (!sec.spreadOk)
        notes.push(`Gamma prezzi troppo ampia (il più caro costa ${sec.spread.toFixed(1)} volte il più economico, ideale ≤ ${limit}): il cliente percepisce due menu diversi e si rifugia nei piatti economici.`);
    }
    // Omnes 2: distribuzione in tre fasce (ideale circa 25% / 50% / 25%)
    if (prices.length >= 4 && sec.priceMin != null && sec.priceMax != null && sec.priceMax > sec.priceMin) {
      const w = (sec.priceMax - sec.priceMin) / 3;
      const low = prices.filter((p) => p < sec.priceMin! + w).length;
      const high = prices.filter((p) => p >= sec.priceMax! - w).length;
      const mid = prices.length - low - high;
      sec.zones = { low: low / prices.length, mid: mid / prices.length, high: high / prices.length };
      sec.zonesOk = sec.zones.mid >= 0.4;
      if (!sec.zonesOk) notes.push("Pochi piatti nella fascia di prezzo centrale: i prezzi sono polarizzati. Concentra la maggior parte dell'offerta nella fascia media.");
    }
    // Omnes 3: rapporto domanda/offerta di prezzo
    const sold = list.filter((d) => (d.monthlySales ?? 0) > 0 && d.price > 0);
    if (sold.length >= 2 && prices.length >= 2) {
      const demanded = sum(sold.map((d) => d.price * (d.monthlySales ?? 0))) / sum(sold.map((d) => d.monthlySales ?? 0));
      const offered = sum(prices) / prices.length;
      sec.demandPriceRatio = demanded / offered;
      if (sec.demandPriceRatio < 0.85)
        notes.push(`I clienti scelgono soprattutto i piatti più economici (rapporto ${sec.demandPriceRatio.toFixed(2)}): la sezione è percepita come cara. Prima di alzare i prezzi qui, lavora su descrizioni e piatti da spingere.`);
      else if (sec.demandPriceRatio > 1.05)
        notes.push(`I clienti scelgono volentieri i piatti più cari (rapporto ${sec.demandPriceRatio.toFixed(2)}): c'è spazio per ritoccare i prezzi o inserire una proposta premium.`);
    }

    if (costed.length) {
      const w = costed.map(vol);
      const W = sum(w) || 1;
      const revenue = sum(costed.map((d, i) => d.netPrice * w[i]));
      sec.weightedFoodCost = revenue > 0 ? (sum(costed.map((d, i) => d.cost * w[i])) / revenue) * 100 : null;
      sec.weightedMargin = sum(costed.map((d, i) => d.margin * w[i])) / W;
      sec.revenueShare = totalRevenue > 0 ? revenue / totalRevenue : null;

      // Pavesic (serve un confronto: almeno 2 piatti costati)
      if (costed.length >= 2 && sec.weightedFoodCost != null) {
        for (const d of costed) {
          const lowFc = (d.foodCostPct ?? 0) <= sec.weightedFoodCost;
          const highCm = d.margin >= sec.weightedMargin;
          pavesic.set(d.id, lowFc ? (highCm ? "prime" : "sleeper") : highCm ? "standard" : "problem");
        }
      }

      // Hayes & Huffman Goal Value: A × B × C × D
      const avgFc = (sec.weightedFoodCost ?? 0) / 100;
      const avgVol = W / costed.length;
      const avgPrice = sum(costed.map((d) => d.netPrice)) / costed.length;
      const target = (1 - avgFc) * avgVol * avgPrice * (1 - (avgFc + varPct));
      if (costed.length >= 2 && target > 0) {
        sec.goalTarget = target;
        for (const d of costed) {
          const fc = (d.foodCostPct ?? 0) / 100;
          const unit = (1 - fc) * d.netPrice * (1 - (fc + varPct));
          const gv = unit * vol(d);
          goal.set(d.id, { gv, ratio: gv / target, toGoal: hasSales && unit > 0 && gv < target ? Math.ceil(target / unit - vol(d)) : null });
        }
      }
    }
    sections.push(sec);
  }

  // ---------------------------------------------------------------- ABC
  const abc = new Map<string, { cls: AbcClass; share: number }>();
  let abcSummary: EngineeringResult["abcSummary"] = null;
  if (hasSales) {
    const ranked = all.filter((d) => (d.monthlyMargin ?? 0) > 0).sort((a, b) => (b.monthlyMargin ?? 0) - (a.monthlyMargin ?? 0));
    const total = sum(ranked.map((d) => d.monthlyMargin ?? 0));
    let cum = 0;
    for (const d of ranked) {
      const share = (d.monthlyMargin ?? 0) / total;
      const before = cum;
      cum += share;
      abc.set(d.id, { cls: before < 0.8 ? "A" : before < 0.95 ? "B" : "C", share });
    }
    const count = (c: AbcClass) => [...abc.values()].filter((x) => x.cls === c).length;
    abcSummary = { A: count("A"), B: count("B"), C: count("C"), aMarginShare: sum([...abc.values()].filter((x) => x.cls === "A").map((x) => x.share)) };
  }

  // ---------------------------------------------------------------- piatti
  const dishes: DishEngineering[] = analysis.dishes.map((d) => {
    const g = goal.get(d.id);
    const pv = pavesic.get(d.id) ?? null;
    const ab = abc.get(d.id);
    const sales = d.monthlySales ?? null;

    const priceTests: PriceTest[] = d.hasRecipe && d.price > 0
      ? [0.5, 1].map((delta) => {
          const net = netOf(delta);
          return {
            delta,
            newPrice: d.price + delta,
            netGainPerDish: net,
            breakEvenLossPct: d.margin + net > 0 ? (net / (d.margin + net)) * 100 : 0,
            monthlyGainNoLoss: sales != null ? net * sales : null,
          };
        })
      : [];

    const top = d.topIngredients[0];
    const portion = d.hasRecipe && top && top.share >= 0.25
      ? {
          ingredient: top.name,
          savingPerDish: top.cost * 0.1,
          newFoodCostPct: d.netPrice > 0 ? ((d.cost - top.cost * 0.1) / d.netPrice) * 100 : null,
          monthlySaving: sales != null ? top.cost * 0.1 * sales : null,
        }
      : null;

    let risk: DishEngineering["risk"] = null;
    for (const ing of d.topIngredients) {
      const v = volatility.get(ing.id) ?? 0;
      if (ing.share >= 0.3 && v >= 10 && (!risk || v * ing.share > risk.volatilityPct * risk.share)) {
        risk = { ingredient: ing.name, share: ing.share, volatilityPct: v };
      }
    }

    const decisions = decide(d, { pv, g, ab, priceTests, portion, risk, settings, hasSales, sections });
    return {
      id: d.id,
      name: d.name,
      category: d.category ?? "Senza sezione",
      pavesic: pv,
      goalValue: g?.gv ?? null,
      goalRatio: g?.ratio ?? null,
      volumeToGoal: g?.toGoal ?? null,
      abc: ab?.cls ?? null,
      marginShare: ab?.share ?? null,
      priceTests,
      portion,
      risk,
      decisions,
    };
  });

  // ---------------------------------------------------------------- stress test
  const t = analysis.totals;
  const monthlyCost = t.monthlyRevenue != null && t.monthlyMargin != null ? t.monthlyRevenue - t.monthlyMargin : null;
  const topCritical = analysis.criticalIngredients[0];
  const stress = {
    allPlus10: {
      foodCost: (t.weightedFoodCost ?? t.avgFoodCost) != null ? (t.weightedFoodCost ?? t.avgFoodCost)! * 1.1 : null,
      monthlyLoss: monthlyCost != null ? monthlyCost * 0.1 : null,
    },
    topIngredient: topCritical && hasSales ? { name: topCritical.name, plus20MonthlyLoss: topCritical.monthlyCost * 0.2 } : null,
  };

  return { dishes, sections, abcSummary, stress, hasSales };
}

/* ------------------------------------------------------------------ */
/* Motore di decisione                                                 */
/* ------------------------------------------------------------------ */

interface DecideCtx {
  pv: PavesicClass | null;
  g: { gv: number; ratio: number; toGoal: number | null } | undefined;
  ab: { cls: AbcClass; share: number } | undefined;
  priceTests: PriceTest[];
  portion: DishEngineering["portion"];
  risk: DishEngineering["risk"];
  settings: EngineeringSettings;
  hasSales: boolean;
  sections: SectionEngineering[];
}

const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function decide(d: DishAnalysis, c: DecideCtx): Decision[] {
  const out: Decision[] = [];
  if (!d.hasRecipe) {
    return [{ action: "ricetta", title: "Completa la ricetta", detail: "Senza ricetta non si può calcolare costo e margine: è il primo passo.", impactMonth: null, priority: 1 }];
  }
  const target = c.settings.targetFoodCost;
  const fc = d.foodCostPct ?? 0;
  const popular = d.menuClass === "star" || d.menuClass === "plowhorse" || c.ab?.cls === "A";
  const section = c.sections.find((s) => s.name === (d.category ?? "Senza sezione"));
  const dpr = section?.demandPriceRatio ?? null;
  const p1 = c.priceTests.find((p) => p.delta === 1);
  const p05 = c.priceTests.find((p) => p.delta === 0.5);

  // 1. Elimina: problematico e marginale nel conto economico (mai un piatto molto scelto)
  if (!popular && c.pv === "problem" && (d.menuClass === "dog" || c.ab?.cls === "C")) {
    out.push({
      action: "elimina",
      title: "Togli o ripensa il piatto",
      detail: "Food cost alto, margine basso e poche vendite: occupa spazio nel menu e in cucina senza portare risultati. Sostituiscilo con una variante di un piatto che rende.",
      impactMonth: null,
      priority: 2,
    });
    return out;
  }

  // 2. Prezzo: piatti molto scelti sopra il riferimento, o Cavalli da tiro (tanti volumi, margine basso).
  //    La domanda di un piatto popolare regge un piccolo aumento.
  if (((fc > target && popular) || d.menuClass === "plowhorse") && p1 && p05) {
    const small = (dpr != null && dpr < 0.85) || fc <= target || p1.breakEvenLossPct < 8;
    const test = small ? p05 : p1;
    const why = fc > target ? "È molto scelto ma sopra il food cost di riferimento" : "È tra i più scelti della sezione ma con un margine in euro sotto la media";
    out.push({
      action: "prezzo",
      title: `Porta il prezzo a ${fmt(test.newPrice)} (+${fmt(test.delta)})`,
      detail: `${why}: anche perdendo fino al ${test.breakEvenLossPct.toFixed(0)}% delle porzioni guadagneresti comunque di più.${dpr != null && dpr < 0.85 ? " La sezione è percepita come cara, quindi meglio un ritocco piccolo." : ""}`,
      impactMonth: test.monthlyGainNoLoss != null ? test.monthlyGainNoLoss * 0.8 : null,
      priority: 1,
    });
  }

  // 3. Porzione/ricetta: food cost alto, l'ingrediente principale pesa molto
  if (fc > target && c.portion) {
    out.push({
      action: "porzione",
      title: `Rivedi la grammatura di ${c.portion.ingredient.toLowerCase()} (−10%)`,
      detail: `Risparmi ${fmt(c.portion.savingPerDish)} a piatto${c.portion.newFoodCostPct != null ? ` e il food cost scende al ${c.portion.newFoodCostPct.toFixed(1)}%` : ""}. In alternativa valuta un taglio o un fornitore diverso.`,
      impactMonth: c.portion.monthlySaving,
      priority: popular ? 2 : 1,
    });
  }

  // 4. Posizione: buon margine ma pochi lo scelgono (Enigma, o Primario sotto obiettivo che non è già una Star)
  if ((d.menuClass === "puzzle" || (c.pv === "prime" && c.g && c.g.ratio < 1 && d.menuClass !== "star")) && fc <= target + 3) {
    const extra = c.g?.toGoal ?? null;
    // Stima prudente: +25% di porzioni (almeno 5) sottratte ad altri piatti della sezione,
    // quindi conta solo la differenza di margine rispetto alla media.
    const moved = Math.max((d.monthlySales ?? 0) * 0.25, 5);
    const diff = section?.weightedMargin != null ? d.margin - section.weightedMargin : 0;
    out.push({
      action: "posizione",
      title: "Dagli visibilità nel menu",
      detail: `Prima posizione della sezione, box o badge e descrizione più invitante; fallo proporre dal personale.${extra ? ` Per raggiungere l'obiettivo della sezione servirebbero ${extra} porzioni in più al mese.` : ""}`,
      impactMonth: c.hasSales && diff > 0 ? moved * diff : null,
      priority: 2,
    });
  }

  // 5. Dormiente: food cost basso ma margine basso → spesso prezzo troppo basso
  if (c.pv === "sleeper" && p05 && fc <= target && !out.some((x) => x.action === "prezzo")) {
    out.push({
      action: "prezzo",
      title: `Prova ${fmt(p05.newPrice)} (+${fmt(0.5)})`,
      detail: `Costa poco ma rende poco in euro: probabilmente è sottoprezzato. Il rischio è basso (punto di pareggio: −${p05.breakEvenLossPct.toFixed(0)}% di vendite).`,
      impactMonth: p05.monthlyGainNoLoss != null ? p05.monthlyGainNoLoss * 0.8 : null,
      priority: 3,
    });
  }

  // 6. Rischio fornitore
  if (c.risk) {
    out.push({
      action: "fornitore",
      title: `Proteggiti dai rincari di ${c.risk.ingredient.toLowerCase()}`,
      detail: `Pesa il ${(c.risk.share * 100).toFixed(0)}% del costo del piatto e il suo prezzo è variato del ${c.risk.volatilityPct.toFixed(0)}%. Chiedi un prezzo bloccato o individua un'alternativa.`,
      impactMonth: null,
      priority: 3,
    });
  }

  // 7. Star / Primario: proteggere
  const structural = out.some((x) => ["prezzo", "porzione", "elimina", "posizione"].includes(x.action));
  if (!structural && (d.menuClass === "star" || c.pv === "prime")) {
    out.unshift({
      action: "proteggi",
      title: "Proteggilo",
      detail: `È uno dei piatti che regge il conto economico${c.ab ? ` (${(c.ab.share * 100).toFixed(0)}% del margine del menu)` : ""}: non cambiare ricetta né porzione, tienilo nei punti più letti del menu e controlla la costanza in cucina.${dpr != null && dpr > 1.05 && p05 ? ` La sezione regge prezzi più alti: valuta ${fmt(p05.newPrice)}.` : ""}`,
      impactMonth: null,
      priority: 3,
    });
  }
  if (out.length === 0) {
    out.push({ action: "monitora", title: "Nessun intervento urgente", detail: "In linea con la sezione. Ricontrolla quando carichi nuove fatture.", impactMonth: null, priority: 3 });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

/* ------------------------------------------------------------------ */
/* Simulazione dello spostamento delle scelte                          */
/* ------------------------------------------------------------------ */

/**
 * Stima il margine guadagnato se una quota delle scelte si sposta, dentro ogni sezione,
 * dai piatti con margine sotto la media a quelli sopra la media (in proporzione al loro volume).
 * È l'effetto atteso di un menu che guida le scelte: non cambia il numero di coperti.
 */
export function simulateMixShift(dishes: DishAnalysis[], shiftPct: number) {
  const byCat = new Map<string, DishAnalysis[]>();
  for (const d of dishes.filter((x) => x.hasRecipe && (x.monthlySales ?? 0) > 0)) {
    byCat.set(d.category ?? "", [...(byCat.get(d.category ?? "") ?? []), d]);
  }
  const perSection: { name: string; moved: number; gain: number }[] = [];
  for (const [name, list] of byCat) {
    if (list.length < 2) continue;
    const vol = sum(list.map((d) => d.monthlySales ?? 0));
    const avg = sum(list.map((d) => d.margin * (d.monthlySales ?? 0))) / vol;
    const donors = list.filter((d) => d.margin < avg);
    const receivers = list.filter((d) => d.margin >= avg);
    if (!donors.length || !receivers.length) continue;
    const recVol = sum(receivers.map((d) => d.monthlySales ?? 0)) || receivers.length;
    const recMargin = sum(receivers.map((d) => d.margin * ((d.monthlySales ?? 0) || 1))) / recVol;
    let moved = 0;
    let gain = 0;
    for (const d of donors) {
      const m = (d.monthlySales ?? 0) * (shiftPct / 100);
      moved += m;
      gain += m * (recMargin - d.margin);
    }
    perSection.push({ name, moved, gain });
  }
  return { perSection, total: sum(perSection.map((s) => s.gain)) };
}
