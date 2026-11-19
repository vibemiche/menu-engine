"use client";

import { useMemo, useState } from "react";
import { HOOK_LABELS, nudgeMenu, type NudgeDish, type NudgeRole, type PlacedDish } from "@/lib/menu-nudge";

export type DesignerDish = NudgeDish;

interface Props {
  restaurantName: string;
  city: string | null;
  targetFoodCost: number;
  dishes: DesignerDish[];
  aiHighlights: string[];
  aiOrder: string[];
  aiDescriptions: Record<string, string>;
  aiRemove: string[];
}

type Theme = "classico" | "moderno" | "trattoria";

const THEMES: Record<Theme, {
  label: string; page: string; title: string; section: string; name: string; nameQuiet: string; desc: string; price: string;
  box: string; rule: string; badge: string; marker: string;
}> = {
  classico: {
    label: "Classico",
    page: "bg-[#fffdf8] text-[#2a241d] font-serif",
    title: "text-4xl tracking-wide",
    section: "text-xs uppercase tracking-[0.3em] text-[#8a6d3b]",
    name: "text-[15px] font-semibold",
    nameQuiet: "text-[14px] font-normal",
    desc: "text-[13px] italic text-[#5d554b]",
    price: "text-[14px] font-semibold",
    box: "border border-[#c9b48a] bg-[#faf3e3]",
    rule: "bg-[#c9b48a]",
    badge: "text-[#8a6d3b]",
    marker: "bg-[linear-gradient(transparent_62%,#ecd9a8_62%)]",
  },
  moderno: {
    label: "Moderno",
    page: "bg-white text-[#111] font-sans",
    title: "text-4xl font-black uppercase tracking-tight",
    section: "text-sm font-bold uppercase tracking-widest text-[#111]",
    name: "text-[15px] font-semibold uppercase tracking-wide",
    nameQuiet: "text-[13px] font-normal uppercase tracking-wide",
    desc: "text-[13px] text-[#555]",
    price: "text-[14px] font-bold",
    box: "bg-[#111] text-white [&_p]:text-[#ccc]",
    rule: "bg-[#111]",
    badge: "text-[#d04a2a]",
    marker: "underline decoration-[#d04a2a] decoration-[3px] underline-offset-4",
  },
  trattoria: {
    label: "Trattoria",
    page: "bg-[#f7f1e6] text-[#3b2a1a] font-serif",
    title: "text-5xl italic",
    section: "text-lg italic text-[#9b3d22]",
    name: "text-[16px] font-semibold",
    nameQuiet: "text-[15px] font-normal",
    desc: "text-[13px] text-[#6b5a48]",
    price: "text-[15px] font-semibold text-[#9b3d22]",
    box: "border-2 border-dashed border-[#9b3d22] bg-[#fbf6ec]",
    rule: "bg-[#9b3d22]/40",
    badge: "text-[#9b3d22]",
    marker: "underline decoration-wavy decoration-[#9b3d22]/70 decoration-2 underline-offset-[5px]",
  },
};

const ROLE_UI: Record<NudgeRole, { label: string; className: string }> = {
  push: { label: "Spingi", className: "bg-basil-soft text-basil" },
  neutral: { label: "Neutro", className: "bg-paper text-muted ring-1 ring-line" },
  steer: { label: "Defila", className: "bg-tomato-soft text-tomato" },
};

/** Prezzo senza simbolo € e senza zeri inutili: sposta l'attenzione dal costo al piatto. */
const formatPrice = (p: number | null) => (p == null ? "" : Number.isInteger(p) ? String(p) : p.toFixed(2).replace(".", ",").replace(/0$/, ""));
const norm = (s: string) => s.trim().toLowerCase();

function Icon({ kind }: { kind: "chef" | "social" | "house" }) {
  const d = {
    chef: "M7 18h10v3H7zM6 14a4 4 0 01.5-8A5 5 0 0112 3a5 5 0 015.5 3A4 4 0 0118 14v4H6z",
    social: "M12 21s-7-4.4-9.3-9A5.3 5.3 0 0112 6.6 5.3 5.3 0 0121.3 12C19 16.6 12 21 12 21z",
    house: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z",
  }[kind];
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="-mt-px inline-block">
      <path d={d} />
    </svg>
  );
}

export function MenuDesigner(props: Props) {
  const [theme, setTheme] = useState<Theme>("classico");
  const [columns, setColumns] = useState<1 | 2>(1);
  const [useAiText, setUseAiText] = useState(Object.keys(props.aiDescriptions).length > 0);
  const [hideRemoved, setHideRemoved] = useState(false);
  const [enable, setEnable] = useState({ order: true, hooks: true, social: true, underline: true });
  const [overrides, setOverrides] = useState<Record<string, NudgeRole | "auto">>({});
  const [title, setTitle] = useState(props.restaurantName);
  const [footer, setFooter] = useState("Coperto 2 · Informazioni sugli allergeni disponibili su richiesta al personale di sala.");
  const t = THEMES[theme];
  const hasSales = props.dishes.some((d) => (d.monthlySales ?? 0) > 0);

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
    const sorted = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([name, dishes]) => ({ name, dishes }));
    return nudgeMenu(sorted, {
      targetFoodCost: props.targetFoodCost,
      aiHighlights: props.aiHighlights,
      overrides,
      enable: { ...enable, social: enable.social && hasSales },
    });
  }, [props.dishes, props.aiOrder, props.aiRemove, props.aiHighlights, props.targetFoodCost, hideRemoved, enable, overrides, hasSales]);

  // Le descrizioni riscritte valorizzano solo i piatti da spingere o neutri, mai quelli da defilare.
  const desc = (d: PlacedDish) => (useAiText && d.role !== "steer" && props.aiDescriptions[norm(d.name)]) || d.description;
  const toggle = (k: keyof typeof enable) => setEnable((e) => ({ ...e, [k]: !e[k] }));

  const DishLine = ({ d }: { d: PlacedDish }) => {
    const badge = d.hooks.includes("social")
      ? { icon: "social" as const, text: d.socialTop ? "Il più scelto dai nostri clienti" : HOOK_LABELS.social }
      : d.hooks.includes("house")
        ? { icon: "house" as const, text: HOOK_LABELS.house }
        : null;
    const quiet = d.role === "steer";
    return (
      <div className="break-inside-avoid">
        {badge && (
          <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${t.badge}`}>
            <Icon kind={badge.icon} /> {badge.text}
          </p>
        )}
        {/* Prezzo subito dopo il nome, non in colonna: evita il confronto "dal più economico". */}
        <div>
          <span className={`${quiet ? t.nameQuiet : t.name} ${d.hooks.includes("underline") ? t.marker : ""}`}>{d.name}</span>{" "}
          <span className={`ml-2 ${t.price} ${quiet ? "font-normal" : ""}`}>{formatPrice(d.price)}</span>
        </div>
        {desc(d) && <p className={t.desc}>{desc(d)}</p>}
      </div>
    );
  };

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

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Leve di vendita</label>
          <div className="flex flex-wrap gap-2">
            {([
              ["order", "Ordine strategico", "Piatti redditizi in cima e in fondo, food cost alto in mezzo"],
              ["hooks", "Ganci visivi", "Box dello chef e badge sui piatti da spingere"],
              ["social", "Riprova sociale", hasSales ? "Solo sui piatti davvero tra i più venduti" : "Servono le vendite mensili"],
              ["underline", "Sottolineature", "Evidenzia il nome di un piatto redditizio per sezione"],
            ] as const).map(([k, label, hint]) => (
              <button
                key={k}
                onClick={() => toggle(k)}
                disabled={k === "social" && !hasSales}
                title={hint}
                className={`btn border text-left ${enable[k] && !(k === "social" && !hasSales) ? "border-basil bg-basil-soft text-basil" : "border-line bg-card text-muted"}`}
              >
                <span className={`h-3.5 w-3.5 rounded-sm border ${enable[k] && !(k === "social" && !hasSales) ? "border-basil bg-basil" : "border-line"}`} />
                <span>{label}<span className="block text-[11px] font-normal opacity-80">{hint}</span></span>
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2"><label className="label">Titolo</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Note a piè di pagina</label><input value={footer} onChange={(e) => setFooter(e.target.value)} className="input" /></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
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
                  <div className="space-y-3.5">
                    {s.dishes.map((d) =>
                      d.hooks.includes("chef") ? (
                        <div key={d.id} className={`rounded-md px-4 py-3 ${t.box}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80"><Icon kind="chef" /> {HOOK_LABELS.chef}</p>
                          <div className="mt-1">
                            <span className={t.name}>{d.name}</span> <span className={`ml-2 ${t.price}`}>{formatPrice(d.price)}</span>
                          </div>
                          {desc(d) && <p className={`mt-0.5 ${t.desc}`}>{desc(d)}</p>}
                        </div>
                      ) : (
                        <DishLine key={d.id} d={d} />
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>

            <footer className="mt-10 text-center text-[11px] opacity-60">{footer}</footer>
          </article>
        </div>

        <aside className="no-print card h-fit p-4 xl:sticky xl:top-6">
          <h2 className="font-semibold">Perché questo menu</h2>
          <p className="mt-1 text-xs text-muted">
            La prima e l&apos;ultima voce di ogni sezione sono le più lette. Lì mettiamo i piatti con più margine, in mezzo quelli con food cost alto. Puoi cambiare il ruolo di ogni piatto.
          </p>
          <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {sections.map((s) => (
              <div key={s.name}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{s.name}</h3>
                <ol className="mt-1.5 space-y-2">
                  {s.dishes.map((d, i) => (
                    <li key={d.id} className="rounded-lg bg-paper p-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium"><span className="tabular mr-1 text-muted">{i + 1}.</span>{d.name}</span>
                        <select
                          value={overrides[d.id] ?? "auto"}
                          onChange={(e) => setOverrides((o) => ({ ...o, [d.id]: e.target.value as NudgeRole | "auto" }))}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_UI[d.role].className}`}
                          aria-label={`Ruolo di ${d.name}`}
                        >
                          <option value="auto">Auto · {ROLE_UI[d.role].label}</option>
                          <option value="push">Spingi</option>
                          <option value="neutral">Neutro</option>
                          <option value="steer">Defila</option>
                        </select>
                      </div>
                      <p className="mt-1 text-xs text-muted">{d.reason}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink/70">
                        {d.foodCostPct != null && <span>FC {d.foodCostPct.toFixed(0)}%</span>}
                        {d.margin != null && <span>margine {d.margin.toFixed(2).replace(".", ",")} €</span>}
                        {d.monthlySales != null && <span>{d.monthlySales}/mese</span>}
                        {d.hooks.map((h) => <span key={h} className="font-medium text-basil">{h === "social" && d.socialTop ? "Il più scelto" : HOOK_LABELS[h]}</span>)}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </aside>
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
