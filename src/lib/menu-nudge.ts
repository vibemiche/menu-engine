/**
 * Motore delle "spinte" del menu (menu nudging).
 *
 * Decide per ogni piatto un ruolo e i ganci visivi da applicare, usando i numeri reali:
 * - spingi: margine in € sopra la media della sezione e food cost sotto controllo (Star, Enigmi);
 * - defila: food cost alto o margine basso (Cavalli da tiro, Cani). Non si nasconde,
 *   ma va in mezzo alla sezione, senza ganci e con meno peso visivo;
 * - neutro: tutto il resto.
 *
 * Ordine nella sezione (effetto posizione seriale): la prima e l'ultima voce sono le più lette,
 * quelle in mezzo le meno lette. I piatti da spingere occupano gli estremi, quelli da defilare il centro.
 *
 * La riprova sociale ("Il più scelto") viene assegnata SOLO se i dati di vendita lo confermano:
 * un'affermazione falsa sul menu è una pratica commerciale scorretta, oltre che controproducente.
 */

export type NudgeRole = "push" | "neutral" | "steer";
export type HookKind = "chef" | "social" | "house" | "underline";

export interface NudgeDish {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  menuClass: "star" | "plowhorse" | "puzzle" | "dog" | null;
  foodCostPct: number | null;
  margin: number | null;
  monthlySales: number | null;
}

export interface NudgeOptions {
  targetFoodCost: number;
  /** Nomi suggeriti dall'agente da evidenziare (già normalizzati in minuscolo) */
  aiHighlights: string[];
  /** Ruoli forzati a mano dal ristoratore */
  overrides: Record<string, NudgeRole | "auto">;
  enable: { hooks: boolean; social: boolean; underline: boolean; order: boolean };
}

export interface PlacedDish extends NudgeDish {
  role: NudgeRole;
  hooks: HookKind[];
  /** true se è davvero il più venduto della sezione, altrimenti "tra i più scelti" */
  socialTop?: boolean;
  reason: string;
}

export interface NudgedSection {
  name: string;
  dishes: PlacedDish[];
}

export const HOOK_LABELS: Record<HookKind, string> = {
  chef: "Consigliato dallo chef",
  social: "Tra i più scelti dai clienti",
  house: "Specialità della casa",
  underline: "Nome sottolineato",
};

const norm = (s: string) => s.trim().toLowerCase();

function autoRole(d: NudgeDish, sectionAvgMargin: number | null, target: number, highlighted: boolean): { role: NudgeRole; reason: string } {
  if (d.menuClass === "dog") return { role: "steer", reason: "Poco venduto e poco redditizio: in mezzo alla sezione, senza ganci." };
  if (d.menuClass === "plowhorse") return { role: "steer", reason: "Molto venduto ma con margine basso: lo togliamo dai punti caldi per spostare le scelte." };
  if (d.foodCostPct != null && d.foodCostPct > target + 3)
    return { role: "steer", reason: `Food cost ${d.foodCostPct.toFixed(0)}%, sopra il ${target}%: va in mezzo e perde peso visivo.` };
  if (highlighted) return { role: "push", reason: "Indicato dall'agente strategia come piatto da spingere." };
  if (d.menuClass === "star") return { role: "push", reason: "Star: venduto e redditizio, va nei punti più letti (inizio o fine sezione)." };
  if (d.menuClass === "puzzle") return { role: "push", reason: "Enigma: buon margine ma poco scelto, ha bisogno di visibilità." };
  if (d.margin != null && sectionAvgMargin != null && d.foodCostPct != null && d.foodCostPct <= target && d.margin >= sectionAvgMargin * 1.05)
    return { role: "push", reason: "Margine in euro sopra la media della sezione con food cost in linea." };
  return { role: "neutral", reason: d.foodCostPct == null ? "Senza ricetta: posizione neutra finché non conosciamo il costo." : "In linea con il resto della sezione." };
}

/** Punteggio per scegliere quale piatto "spinto" merita i ganci più forti: conta il margine in euro. */
const pushScore = (d: NudgeDish) => (d.margin ?? 0) * (d.menuClass === "puzzle" ? 1.15 : 1) + (100 - (d.foodCostPct ?? 50)) / 20;

export function nudgeMenu(sections: { name: string; dishes: NudgeDish[] }[], opts: NudgeOptions): NudgedSection[] {
  const highlights = new Set(opts.aiHighlights.map(norm));

  return sections.map(({ name, dishes }) => {
    const withMargin = dishes.filter((d) => d.margin != null && d.foodCostPct != null);
    const avgMargin = withMargin.length ? withMargin.reduce((s, d) => s + (d.margin ?? 0), 0) / withMargin.length : null;

    const placed: PlacedDish[] = dishes.map((d) => {
      const forced = opts.overrides[d.id];
      const auto = autoRole(d, avgMargin, opts.targetFoodCost, highlights.has(norm(d.name)));
      const role = forced && forced !== "auto" ? forced : auto.role;
      const reason = forced && forced !== "auto" ? "Scelta manuale." : auto.reason;
      return { ...d, role, hooks: [], reason };
    });

    const push = placed.filter((d) => d.role === "push").sort((a, b) => pushScore(b) - pushScore(a));
    const neutral = placed.filter((d) => d.role === "neutral").sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
    // Da defilare: i più "pericolosi" (food cost più alto, poi più venduti) vanno al centro esatto.
    const danger = (d: PlacedDish) => (d.foodCostPct ?? opts.targetFoodCost) + (d.menuClass === "plowhorse" ? 10 : 0);
    const steer = placed.filter((d) => d.role === "steer").sort((a, b) => danger(a) - danger(b));

    // --- Ganci: al massimo uno per piatto e pochi per sezione (se tutto è evidenziato, niente lo è)
    const free = (d: PlacedDish) => d.hooks.length === 0 && d.role !== "steer";
    if (opts.enable.hooks && push[0]) push[0].hooks.push(push[0].menuClass === "star" ? "house" : "chef");

    if (opts.enable.social) {
      // Solo affermazioni vere: il piatto deve essere davvero tra i più venduti della sezione.
      const sold = [...placed].filter((d) => (d.monthlySales ?? 0) > 0).sort((a, b) => (b.monthlySales ?? 0) - (a.monthlySales ?? 0));
      const avgSales = sold.length ? sold.reduce((sum, d) => sum + (d.monthlySales ?? 0), 0) / sold.length : 0;
      const pick = sold.find((d, i) => d.role !== "steer" && (i < 3 || (d.monthlySales ?? 0) >= avgSales));
      if (pick && sold.length >= 2) {
        pick.hooks = ["social"];
        pick.socialTop = sold[0].id === pick.id;
      }
    }

    if (opts.enable.hooks) {
      const next = push.find(free);
      if (next) next.hooks.push("house");
    }
    if (opts.enable.underline) {
      const candidate = push.find(free) ?? neutral.find((d) => free(d) && d.foodCostPct != null && d.foodCostPct <= opts.targetFoodCost);
      if (candidate) candidate.hooks.push("underline");
    }

    // --- Ordine: estremi ai piatti da spingere, centro ai piatti da defilare
    let ordered: PlacedDish[];
    if (!opts.enable.order) {
      ordered = placed;
    } else {
      const first = push[0] ? [push[0]] : neutral.length ? [neutral.shift()!] : [];
      const restPush = push.slice(1);
      // Ultima posizione (molto letta): un piatto da spingere, altrimenti un neutro,
      // altrimenti il meno problematico tra quelli da defilare.
      const lastCandidate = restPush.length
        ? restPush.pop()!
        : neutral.length > 1
          ? neutral.pop()!
          : steer.length > 1 || (steer.length === 1 && first.length === 0)
            ? steer.shift()!
            : null;
      // Al centro il più problematico: i meno problematici lo circondano.
      const middle = [...steer.filter((_, i) => i % 2 === 0), ...steer.filter((_, i) => i % 2 === 1).reverse()];
      ordered = [...first, ...restPush, ...neutral.slice(0, Math.ceil(neutral.length / 2)), ...middle, ...neutral.slice(Math.ceil(neutral.length / 2))];
      if (lastCandidate) ordered.push(lastCandidate);
    }
    return { name, dishes: ordered };
  });
}
