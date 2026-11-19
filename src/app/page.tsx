import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/session";

const steps = [
  { n: "1", title: "Fotografa il menu", text: "Piatti, sezioni e prezzi entrano da soli. Controlli tutto in una tabella prima di salvare." },
  { n: "2", title: "Carica le fatture", text: "Foto, PDF o fattura elettronica XML: i prezzi vengono riportati al kg, al litro o al pezzo e aggiornati a ogni acquisto." },
  { n: "3", title: "Fotografa le ricette", text: "Anche scritte a mano. Le quantità vengono divise per porzione e collegate agli ingredienti." },
];

const outcomes = [
  { title: "Food cost reale per piatto", text: "Con scarti, cali peso e semilavorati (fondi, sughi, impasti) calcolati in proporzione.", tone: "bg-basil-soft text-basil" },
  { title: "Matrice del menu", text: "Ogni piatto classificato per popolarità e margine: quali spingere, quali correggere, quali togliere.", tone: "bg-sky-soft text-sky" },
  { title: "Ingredienti che pesano di più", text: "Dove rinegoziare col fornitore o rivedere le grammature, e quanto vale farlo.", tone: "bg-amber-soft text-amber" },
  { title: "Allarme rincari", text: "Quando un fornitore aumenta un prezzo vedi subito quali piatti ne risentono.", tone: "bg-tomato-soft text-tomato" },
];

export default async function Home() {
  const session = await getSession();
  const cta = session ? { href: "/app", label: "Vai alla tua dashboard" } : { href: "/registrati", label: "Inizia gratis" };

  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {!session && <Link href="/login" className="btn-ghost">Accedi</Link>}
          <Link href={cta.href} className="btn-primary">{session ? "Dashboard" : "Registrati"}</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full bg-basil-soft px-3 py-1 text-xs font-medium text-basil">
            Food cost · Menu engineering · Menu design
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-6xl">
            Il tuo menu può guadagnare di più. Ti mostriamo dove.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Carica le foto di menu, fatture e ricette. Menu Engine calcola il costo reale di ogni piatto, fa l&apos;audit del
            menu e un agente AI ti prepara un piano d&apos;azione: prezzi, porzioni, fornitori e una nuova impaginazione del menu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={cta.href} className="btn-primary px-6 py-3 text-base">{cta.label}</Link>
            <a href="#come-funziona" className="btn-secondary px-6 py-3 text-base">Come funziona</a>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { k: "+0,50 €", v: "su un piatto da 20 porzioni al giorno", r: "≈ 3.600 € l'anno" },
            { k: "3 foto", v: "menu, fattura, ricetta", r: "per partire" },
            { k: "1 piano", v: "azioni ordinate per impatto", r: "non solo numeri" },
          ].map((s) => (
            <div key={s.k} className="card p-5">
              <div className="font-serif text-3xl font-semibold text-basil">{s.k}</div>
              <div className="mt-1 text-sm text-muted">{s.v}</div>
              <div className="mt-3 text-sm font-medium">{s.r}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="come-funziona" className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold">Tre caricamenti, zero data entry</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-basil font-semibold text-white">{s.n}</div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold">Cosa scopri</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {outcomes.map((o) => (
            <div key={o.title} className="card p-6">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${o.tone}`}>{o.title}</span>
              <p className="mt-3 text-sm text-muted">{o.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl font-semibold">Un consulente AI che legge i tuoi numeri</h2>
            <p className="mt-4 text-paper/70">
              Niente soglie rigide: l&apos;agente valuta il tuo tipo di locale, le categorie e i volumi. Ti dice cosa fare
              subito, entro 30 giorni ed entro 90, con una stima prudente del margine recuperabile.
            </p>
          </div>
          <div>
            <h2 className="font-serif text-3xl font-semibold">Un menu ridisegnato per vendere</h2>
            <p className="mt-4 text-paper/70">
              Dall&apos;audit nasce un nuovo menu stampabile: sezioni nell&apos;ordine giusto, piatti da spingere in evidenza,
              prezzi senza simbolo €, descrizioni riscritte per i piatti più redditizi.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-serif text-3xl font-semibold">Scopri quanto vale davvero il tuo menu</h2>
        <Link href={cta.href} className="btn-primary mt-8 px-6 py-3 text-base">{cta.label}</Link>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">© {new Date().getFullYear()} Menu Engine</footer>
    </div>
  );
}
