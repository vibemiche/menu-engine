"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { importInvoice, importMenu, importRecipe, scanDocuments, type ScanPayload } from "@/app/app/actions";
import type { InvoiceScan, MenuScan, RecipeScan } from "@/lib/ai/scan";
import { bestMatch } from "@/lib/match";

type Kind = "menu" | "invoice" | "recipe";
interface Named { id: string; name: string }
interface Props {
  initialKind: Kind;
  targetRecipeId: string | null;
  aiEnabled: boolean;
  ingredients: (Named & { unit: string; price: number })[];
  dishes: Named[];
  preps: Named[];
}

const TABS: { kind: Kind; label: string; hint: string; accept: string }[] = [
  { kind: "menu", label: "Menu", hint: "Foto o PDF del menu: anche più pagine insieme.", accept: "image/*,application/pdf" },
  { kind: "invoice", label: "Fattura", hint: "Foto, PDF o fattura elettronica XML (dal cassetto fiscale o dal commercialista).", accept: "image/*,application/pdf,.xml,text/xml,application/xml" },
  { kind: "recipe", label: "Ricetta", hint: "Scheda ricetta stampata o scritta a mano.", accept: "image/*,application/pdf" },
];

/* --------------------------- Preparazione file --------------------------- */

async function compressImage(file: File): Promise<{ mediaType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  // ~1600px sul lato lungo: abbastanza per leggere testi piccoli, molto meno token di una foto originale.
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1] };
}

async function readFile(file: File) {
  const isXml = file.name.toLowerCase().endsWith(".xml") || file.type.includes("xml");
  if (isXml) return { name: file.name, mediaType: "application/xml", data: await file.text() };
  if (file.type === "application/pdf") {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { name: file.name, mediaType: "application/pdf", data: btoa(bin) };
  }
  if (file.type.startsWith("image/")) {
    const img = await compressImage(file);
    return { name: file.name, ...img };
  }
  throw new Error(`Formato non supportato: ${file.name}`);
}

/* -------------------------------- Wizard --------------------------------- */

export function ImportWizard(props: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(props.initialKind);
  const [files, setFiles] = useState<File[]>([]);
  const [scan, setScan] = useState<ScanPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<React.ReactNode>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const tab = TABS.find((t) => t.kind === kind)!;

  function reset(next?: Kind) {
    setFiles([]);
    setScan(null);
    setError(null);
    setDone(null);
    if (next) setKind(next);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((f) => [...f, ...Array.from(list)].slice(0, 6));
    setError(null);
  }

  function analyze() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = await Promise.all(files.map(readFile));
        const res = await scanDocuments(kind, payload);
        if (!res.ok) setError(res.error);
        else setScan(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore durante la lettura dei file");
      }
    });
  }

  const onImported = (msg: React.ReactNode) => {
    setScan(null);
    setFiles([]);
    setDone(msg);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border border-line bg-card p-1">
        {TABS.map((t) => (
          <button key={t.kind} onClick={() => reset(t.kind)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${kind === t.kind ? "bg-basil text-white" : "text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {done && (
        <div className="card mb-6 border-basil/40 bg-basil-soft p-5 text-sm text-basil">
          {done}
          <button onClick={() => reset()} className="ml-3 font-medium underline">Importa altro</button>
        </div>
      )}

      {!scan && (
        <div className="card p-6">
          <p className="text-sm text-muted">{tab.hint}</p>
          {!props.aiEnabled && (
            <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
              Lettura AI non configurata (manca ANTHROPIC_API_KEY): {kind === "invoice" ? "le fatture XML funzionano comunque." : "puoi inserire i dati a mano."}
            </p>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line px-6 py-10 text-center"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6b6258" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="4" /></svg>
            <p className="mt-3 text-sm">Trascina qui i file oppure</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>Scegli file</button>
              <button type="button" className="btn-secondary sm:hidden" onClick={() => cameraRef.current?.click()}>Scatta foto</button>
            </div>
            <input ref={inputRef} type="file" multiple accept={tab.accept} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-paper px-3 py-1.5">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} className="text-muted hover:text-tomato" aria-label="Rimuovi">✕</button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-4 rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato">{error}</p>}
          <button onClick={analyze} disabled={!files.length || pending} className="btn-primary mt-5">
            {pending ? "Sto leggendo il documento…" : "Leggi documento"}
          </button>
        </div>
      )}

      {scan?.kind === "menu" && <MenuReview scan={scan.data} dishes={props.dishes} onCancel={() => setScan(null)} onDone={onImported} />}
      {scan?.kind === "invoice" && <InvoiceReview scan={scan.data} source={scan.source} ingredients={props.ingredients} onCancel={() => setScan(null)} onDone={onImported} />}
      {scan?.kind === "recipe" && (
        <RecipeReview scan={scan.data} ingredients={props.ingredients} dishes={props.dishes} preps={props.preps} targetRecipeId={props.targetRecipeId} onCancel={() => setScan(null)} onDone={onImported} />
      )}
    </div>
  );
}

/* ------------------------------ Revisioni -------------------------------- */

type ReviewProps<T> = { scan: T; onCancel: () => void; onDone: (msg: React.ReactNode) => void };

function ReviewShell({ title, subtitle, children, onCancel, onConfirm, pending, error, confirmLabel }: {
  title: string; subtitle: string; children: React.ReactNode; onCancel: () => void; onConfirm: () => void; pending: boolean; error: string | null; confirmLabel: string;
}) {
  return (
    <div className="card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
        {error && <p className="mr-auto text-sm text-tomato">{error}</p>}
        <button onClick={onCancel} className="btn-ghost">Annulla</button>
        <button onClick={onConfirm} disabled={pending} className="btn-primary">{pending ? "Salvo…" : confirmLabel}</button>
      </div>
    </div>
  );
}

const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function MenuReview({ scan, dishes, onCancel, onDone }: ReviewProps<MenuScan> & { dishes: Named[] }) {
  const [rows, setRows] = useState(() =>
    scan.dishes.map((d) => ({ ...d, include: true, matchId: bestMatch(d.name, dishes, 0.75)?.id ?? null })),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const confirm = () =>
    start(async () => {
      const res = await importMenu(rows.filter((r) => r.include && r.name.trim()).map(({ include: _i, ...r }) => r));
      if (!res.ok) setError(res.error);
      else onDone(<>Menu importato: {res.data.created} piatti nuovi, {res.data.updated} aggiornati. <Link href="/app/piatti" className="font-medium underline">Vai ai piatti</Link></>);
    });

  return (
    <ReviewShell title={`${rows.length} piatti trovati`} subtitle="Controlla nomi e prezzi prima di salvare. I piatti già presenti vengono aggiornati." onCancel={onCancel} onConfirm={confirm} pending={pending} error={error} confirmLabel="Salva nel menu">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-b border-line"><th className="th w-8"></th><th className="th">Piatto</th><th className="th">Sezione</th><th className="th">Descrizione</th><th className="th w-24">Prezzo</th><th className="th">Già presente?</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-line ${r.include ? "" : "opacity-40"}`}>
              <td className="td"><input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="accent-[#2f6b4f]" aria-label="Includi" /></td>
              <td className="td"><input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="input py-1" /></td>
              <td className="td"><input value={r.category ?? ""} onChange={(e) => update(i, { category: e.target.value || null })} className="input py-1" /></td>
              <td className="td"><input value={r.description ?? ""} onChange={(e) => update(i, { description: e.target.value || null })} className="input py-1" /></td>
              <td className="td"><input value={r.price ?? ""} onChange={(e) => update(i, { price: num(e.target.value) })} inputMode="decimal" className="input tabular py-1" /></td>
              <td className="td">
                <select value={r.matchId ?? ""} onChange={(e) => update(i, { matchId: e.target.value || null })} className="input py-1">
                  <option value="">Nuovo piatto</option>
                  {dishes.map((d) => <option key={d.id} value={d.id}>Aggiorna: {d.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReviewShell>
  );
}

function InvoiceReview({ scan, source, ingredients, onCancel, onDone }: ReviewProps<InvoiceScan> & { source: "foto" | "xml"; ingredients: Props["ingredients"] }) {
  const [supplier, setSupplier] = useState(scan.supplier ?? "");
  const [date, setDate] = useState(scan.date ?? "");
  const [rows, setRows] = useState(() =>
    scan.lines.map((l) => ({ ...l, include: true, matchId: bestMatch(l.name, ingredients, 0.5)?.id ?? null })),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const confirm = () =>
    start(async () => {
      const res = await importInvoice({
        supplier: supplier || null,
        date: date || null,
        source,
        lines: rows.filter((r) => r.include && r.name.trim()).map((r) => ({ name: r.name, category: r.category, unit: r.unit, unitPrice: r.unitPrice, matchId: r.matchId })),
      });
      if (!res.ok) setError(res.error);
      else onDone(<>Fattura importata: {res.data.updated} prezzi aggiornati, {res.data.created} ingredienti nuovi. I food cost sono già ricalcolati. <Link href="/app" className="font-medium underline">Vedi la dashboard</Link></>);
    });

  return (
    <ReviewShell title={`${rows.length} righe lette${source === "xml" ? " dalla fattura elettronica" : ""}`} subtitle="Prezzi netti IVA riportati al kg, litro o pezzo. Abbina ogni riga a un ingrediente esistente per aggiornarne il prezzo." onCancel={onCancel} onConfirm={confirm} pending={pending} error={error} confirmLabel="Aggiorna prezzi">
      <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2">
        <div><label className="label">Fornitore</label><input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input" /></div>
        <div><label className="label">Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></div>
      </div>
      <table className="w-full min-w-[820px] text-sm">
        <thead><tr className="border-b border-line"><th className="th w-8"></th><th className="th">Riga fattura</th><th className="th">Ingrediente</th><th className="th w-24">Unità</th><th className="th w-28">€ / unità</th><th className="th">Abbina a</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const match = r.matchId ? ingById.get(r.matchId) : null;
            const delta = match && match.price > 0 && match.unit === r.unit ? ((r.unitPrice - match.price) / match.price) * 100 : null;
            return (
              <tr key={i} className={`border-b border-line ${r.include ? "" : "opacity-40"}`}>
                <td className="td"><input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="accent-[#2f6b4f]" aria-label="Includi" /></td>
                <td className="td max-w-[14rem] text-xs text-muted">{r.description}</td>
                <td className="td"><input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="input py-1" /></td>
                <td className="td">
                  <select value={r.unit} onChange={(e) => update(i, { unit: e.target.value as "kg" })} className="input py-1"><option>kg</option><option>l</option><option>pz</option></select>
                </td>
                <td className="td">
                  <input value={r.unitPrice} onChange={(e) => update(i, { unitPrice: num(e.target.value) ?? 0 })} inputMode="decimal" className="input tabular py-1" />
                  {delta != null && Math.abs(delta) >= 1 && <div className={`mt-0.5 text-[11px] font-medium ${delta > 0 ? "text-tomato" : "text-basil"}`}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs {match!.price.toFixed(2)}</div>}
                </td>
                <td className="td">
                  <select value={r.matchId ?? ""} onChange={(e) => update(i, { matchId: e.target.value || null })} className="input py-1">
                    <option value="">Nuovo ingrediente</option>
                    {ingredients.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ReviewShell>
  );
}

function RecipeReview({ scan, ingredients, dishes, preps, targetRecipeId, onCancel, onDone }: ReviewProps<RecipeScan> & { ingredients: Named[]; dishes: Named[]; preps: Named[]; targetRecipeId: string | null }) {
  const autoTarget = targetRecipeId ?? (scan.title ? bestMatch(scan.title, [...dishes, ...preps], 0.6)?.id : null) ?? "new";
  const [target, setTarget] = useState<string>(autoTarget);
  const [newKind, setNewKind] = useState<"dish" | "prep">(scan.isPreparation ? "prep" : "dish");
  const [title, setTitle] = useState(scan.title ?? "");
  const [portions, setPortions] = useState<number | null>(scan.portions);
  const [yieldQty, setYieldQty] = useState<number | null>(scan.yieldQty);
  const [yieldUnit, setYieldUnit] = useState(scan.yieldUnit ?? "kg");
  const [replace, setReplace] = useState(true);
  const options = [...ingredients.map((i) => ({ value: `ing:${i.id}`, name: i.name })), ...preps.map((p) => ({ value: `prep:${p.id}`, name: `↳ ${p.name}` }))];
  const [rows, setRows] = useState(() =>
    scan.ingredients.map((l) => {
      const ing = bestMatch(l.name, ingredients, 0.5);
      const prep = ing ? null : bestMatch(l.name, preps, 0.6);
      return { ...l, include: l.quantity > 0, matchId: ing ? `ing:${ing.id}` : prep ? `prep:${prep.id}` : null };
    }),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const targetKind: "dish" | "prep" = target === "new" ? newKind : preps.some((p) => p.id === target) ? "prep" : "dish";

  const confirm = () =>
    start(async () => {
      const res = await importRecipe({
        target,
        kind: targetKind,
        title: title || "Nuova ricetta",
        portions,
        yieldQty,
        yieldUnit: yieldUnit as "kg",
        replace,
        lines: rows.filter((r) => r.include).map((r) => ({ name: r.name, quantity: r.quantity, unit: r.unit, matchId: r.matchId })),
      });
      if (!res.ok) setError(res.error);
      else {
        const href = res.data.kind === "dish" ? `/app/piatti/${res.data.recipeId}` : `/app/preparazioni/${res.data.recipeId}`;
        onDone(<>Ricetta salvata. Gli ingredienti senza prezzo vanno completati con una fattura. <Link href={href} className="font-medium underline">Apri la ricetta</Link></>);
      }
    });

  return (
    <ReviewShell title={title || "Ricetta letta"} subtitle="Collega la ricetta a un piatto e controlla le quantità. Gli ingredienti non abbinati verranno creati." onCancel={onCancel} onConfirm={confirm} pending={pending} error={error} confirmLabel="Salva ricetta">
      <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label">Collega a</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="input">
            <option value="new">Crea nuova ricetta</option>
            <optgroup label="Piatti">{dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
            <optgroup label="Preparazioni">{preps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
          </select>
        </div>
        {target === "new" ? (
          <>
            <div><label className="label">Nome</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></div>
            <div><label className="label">Tipo</label><select value={newKind} onChange={(e) => setNewKind(e.target.value as "dish")} className="input"><option value="dish">Piatto</option><option value="prep">Preparazione</option></select></div>
          </>
        ) : (
          <label className="flex items-center gap-2 pt-6 text-sm lg:col-span-2"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-[#2f6b4f]" /> Sostituisci la ricetta attuale</label>
        )}
        {targetKind === "dish" ? (
          <div><label className="label">Porzioni della ricetta</label><input value={portions ?? ""} onChange={(e) => setPortions(num(e.target.value))} inputMode="numeric" className="input" placeholder="1" /><p className="mt-1 text-[11px] text-muted">Le quantità verranno divise per porzione.</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Resa</label><input value={yieldQty ?? ""} onChange={(e) => setYieldQty(num(e.target.value))} inputMode="decimal" className="input" /></div>
            <div><label className="label">Unità</label><select value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value as "kg")} className="input"><option>kg</option><option>l</option><option>pz</option></select></div>
          </div>
        )}
      </div>
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-line"><th className="th w-8"></th><th className="th">Ingrediente letto</th><th className="th w-24">Quantità</th><th className="th w-20">Unità</th><th className="th">Abbina a</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-line ${r.include ? "" : "opacity-40"}`}>
              <td className="td"><input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="accent-[#2f6b4f]" aria-label="Includi" /></td>
              <td className="td"><input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="input py-1" /></td>
              <td className="td"><input value={r.quantity} onChange={(e) => update(i, { quantity: num(e.target.value) ?? 0 })} inputMode="decimal" className="input tabular py-1" /></td>
              <td className="td"><select value={r.unit} onChange={(e) => update(i, { unit: e.target.value as "g" })} className="input py-1">{["g", "kg", "ml", "l", "pz"].map((u) => <option key={u}>{u}</option>)}</select></td>
              <td className="td">
                <select value={r.matchId ?? ""} onChange={(e) => update(i, { matchId: e.target.value || null })} className="input py-1">
                  <option value="">Nuovo ingrediente</option>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReviewShell>
  );
}
