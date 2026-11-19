/** Abbinamento approssimato tra nomi (fattura/ricetta ↔ ingredienti in archivio). */

const STOP = new Set(["di", "da", "del", "della", "dei", "e", "al", "alla", "con", "in", "kg", "gr", "g", "lt", "l", "pz", "x", "conf", "cf", "ct"]);

export function normalizeName(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
}

export function similarity(a: string, b: string): number {
  const ta = normalizeName(a);
  const tb = normalizeName(b);
  if (!ta.length || !tb.length) return 0;
  const sb = new Set(tb);
  let hits = 0;
  for (const w of ta) {
    if (sb.has(w) || tb.some((x) => (x.length > 3 && w.startsWith(x)) || (w.length > 3 && x.startsWith(w)))) hits++;
  }
  return hits / Math.max(ta.length, tb.length);
}

export function bestMatch<T extends { id: string; name: string }>(name: string, list: T[], min = 0.5): T | null {
  let best: T | null = null;
  let score = 0;
  for (const item of list) {
    const s = similarity(name, item.name);
    if (s > score) {
      score = s;
      best = item;
    }
  }
  return score >= min ? best : null;
}
