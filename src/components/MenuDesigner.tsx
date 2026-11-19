"use client";

import { useMemo, useState } from "react";
import type { MenuClass } from "@/lib/costing";

export interface DesignerDish {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  menuClass: MenuClass | null;
}

interface Props {
  restaurantName: string;
  city: string | null;
  dishes: DesignerDish[];
  aiHighlights: string[];
  aiOrder: string[];
  aiDescriptions: Record<string, string>;
  aiRemove: string[];
}

type Theme = "classico" | "moderno" | "trattoria";

const THEMES: Record<Theme, { label: string; page: string; title: string; section: string; name: string; desc: string; price: string; box: string; rule: string }> = {
  classico: {
    label: "Classico",
    page: "bg-[#fffdf8] text-[#2a241d] font-serif",
    title: "text-4xl tracking-wide",
    section: "text-xs uppercase tracking-[0.3em] text-[#8a6d3b]",
    name: "text-[15px] font-semibold",
    desc: "text-[13px] italic text-[#5d554b]",
    price: "text-[14px] font-semibold",
    box: "border border-[#c9b48a] bg-[#faf3e3]",
    rule: "bg-[#c9b48a]",
  },
  moderno: {
    label: "Moderno",
    page: "bg-white text-[#111] font-sans",
    title: "text-4xl font-black uppercase tracking-tight",
    section: "text-sm font-bold uppercase tracking-widest text-[#111]",
    name: "text-[15px] font-semibold uppercase tracking-wide",
    desc: "text-[13px] text-[#555]",
    price: "text-[14px] font-bold",
    box: "bg-[#111] text-white [&_p]:text-[#ccc]",
    rule: "bg-[#111]",
  },
  trattoria: {
    label: "Trattoria",
    page: "bg-[#f7f1e6] text-[#3b2a1a] font-serif",
    title: "text-5xl italic",
    section: "text-lg italic text-[#9b3d22]",
    name: "text-[16px] font-semibold",
    desc: "text-[13px] text-[#6b5a48]",
    price: "text-[15px] font-semibold text-[#9b3d22]",
    box: "border-2 border-dashed border-[#9b3d22] bg-[#fbf6ec]",
    rule: "bg-[#9b3d22]/40",
  },
};

/** Prezzo senza simbolo € e senza zeri inutili: sposta l'attenzione dal costo al piatto. */
const formatPrice = (p: number | null) => (p == null ? "" : Number.isInteger(p) ? String(p) : p.toFixed(2).replace(".", ",").replace(/0$/, ""));
const norm = (s: string) => s.trim().toLowerCase();

export function MenuDesigner(props: Props) {
  const [theme, setTheme] = useState<Theme>("classico");
  const [columns, setColumns] = useState<1 | 2>(1);
  const [useAiText, setUseAiText] = useState(Object.keys(props.aiDescriptions).length > 0);
  const [hideRemoved, setHideRemoved] = useState(false);
  const [title, setTitle] = useState(props.restaurantName);
  const [footer, setFooter] = useState("Coperto 2 · Informazioni sugli allergeni disponibili su richiesta al personale di sala.");
  const t = THEMES[theme];

  const highlight = useMemo(() => {
    const fromAi = new Set(props.aiHighlights.map(norm));
    // Senza agente: evidenzia Star ed Enigmi (alto margine) — al massimo uno per sezione.
    return (d: DesignerDish) => (fromAi.size ? fromAi.has(norm(d.name)) : d.menuClass === "star" || d.menuClass === "puzzle");
  }, [props.aiHighlights]);

  const sections = useMemo(() => {
    const removed = new Set(props.aiRemove.map(norm));
    const groups = new Map<string, DesignerDish[]>();
    for (const d of props.dishes) {
      if (hideRemoved && removed.has(norm(d.name))) continue;
      const key = d.category ?? "Altro";
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    const order = props.aiOrder.map(norm);
    const rank = (c: string) => {
      const i = order.indexOf(norm(c));
      return i === -1 ? 999 : i;
    };
    return [...groups.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([name, list]) => {
        // I piatti da spingere vanno in cima alla sezione (prima posizione = più letta).
        const top = list.filter(highlight).slice(0, 2);
        const rest = list.filter((d) => !top.includes(d));
        return { name, featured: top, rest };
      });
  }, [props.dishes, props.aiOrder, props.aiRemove, hideRemoved, highlight]);

  const desc = (d: DesignerDish) => (useAiText && props.aiDescriptions[norm(d.name)]) || d.description;

  return (
    <div>
      <div className="no-print card mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Stile</label>
          <div className="flex gap-1">
            {(Object.keys(THEMES) as Theme[]).map((k) => (
              <button key={k} onClick={() => setTheme(k)} className={`btn flex-1 px-2 ${theme === k ? "bg-basil text-white" : "border border-line bg-card"}`}>{THEMES[k].label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Impaginazione</label>
          <div className="flex gap-1">
            {([1, 2] as const).map((c) => (
              <button key={c} onClick={() => setColumns(c)} className={`btn flex-1 ${columns === c ? "bg-basil text-white" : "border border-line bg-card"}`}>{c === 1 ? "1 colonna" : "2 colonne"}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={useAiText} onChange={(e) => setUseAiText(e.target.checked)} disabled={!Object.keys(props.aiDescriptions).length} className="accent-[#2f6b4f]" />Descrizioni riscritte dall&apos;agente</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={hideRemoved} onChange={(e) => setHideRemoved(e.target.checked)} disabled={!props.aiRemove.length} className="accent-[#2f6b4f]" />Nascondi piatti da eliminare</label>
        </div>
        <div className="flex items-end">
          <button onClick={() => window.print()} className="btn-primary w-full">Stampa / salva PDF</button>
        </div>
        <div className="sm:col-span-2"><label className="label">Titolo</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Note a piè di pagina</label><input value={footer} onChange={(e) => setFooter(e.target.value)} className="input" /></div>
      </div>

      <div className="overflow-x-auto">
        <article id="menu-print" className={`mx-auto w-[210mm] max-w-full min-h-[297mm] px-[16mm] py-[18mm] shadow-xl print:shadow-none ${t.page}`}>
          <header className="text-center">
            <h1 className={t.title}>{title}</h1>
            {props.city && <p className="mt-2 text-xs uppercase tracking-[0.25em] opacity-60">{props.city}</p>}
            <div className={`mx-auto mt-6 h-px w-24 ${t.rule}`} />
          </header>

          <div className={`mt-10 ${columns === 2 ? "columns-2 gap-10" : ""}`}>
            {sections.map((s) => (
              <section key={s.name} className="mb-9 break-inside-avoid-column">
                <h2 className={`mb-4 text-center ${t.section}`}>{s.name}</h2>
                {s.featured.map((d) => (
                  <div key={d.id} className={`mb-4 rounded-md px-4 py-3 ${t.box}`}>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">Consigliato dallo chef</p>
                    <div className="mt-1"><span className={t.name}>{d.name}</span> <span className={`ml-2 ${t.price}`}>{formatPrice(d.price)}</span></div>
                    {desc(d) && <p className={`mt-0.5 ${t.desc}`}>{desc(d)}</p>}
                  </div>
                ))}
                <div className="space-y-3">
                  {s.rest.map((d) => (
                    <div key={d.id} className="break-inside-avoid">
                      {/* Prezzo subito dopo il nome, non in colonna: evita il confronto "dal più economico". */}
                      <div><span className={t.name}>{d.name}</span> <span className={`ml-2 ${t.price}`}>{formatPrice(d.price)}</span></div>
                      {desc(d) && <p className={t.desc}>{desc(d)}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-10 text-center text-[11px] opacity-60">{footer}</footer>
        </article>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden; }
          #menu-print, #menu-print * { visibility: visible; }
          #menu-print { position: absolute; left: 0; top: 0; width: 210mm; box-shadow: none; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
