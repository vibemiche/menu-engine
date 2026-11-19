# Menu Engine

Gestionale per ristoratori: food cost reale da foto di menu, fatture e ricette, audit del menu,
agente AI che prepara la strategia e generatore del nuovo menu stampabile.

## Funzioni

| Area | Cosa fa |
|---|---|
| **Account** | Registrazione con nome utente + email + password, login con nome utente **o** email, login con Google (Better Auth). |
| **Import da foto** | Menu (foto/PDF) → piatti, sezioni, prezzi. Fatture (foto/PDF/**XML FatturaPA**) → prezzi normalizzati a €/kg, €/l, €/pz con storico. Ricette (anche a mano) → ingredienti e quantità divise per porzione. Ogni import passa da una schermata di revisione con abbinamento automatico agli elementi già presenti. |
| **Food cost** | Scarti/cali peso per ingrediente, semilavorati (preparazioni con resa) ripartiti in proporzione, IVA inclusa/esclusa, simulatore di prezzo, prezzo consigliato arrotondato ai 50 centesimi. |
| **Audit menu** | Punteggio, problemi di economia/struttura/testi/dati, matrice popolarità × margine (Star, Cavalli da tiro, Enigmi, Cani), ingredienti critici, rincari dei fornitori. |
| **Agente strategia** | Legge i numeri e il contesto del locale (senza soglie rigide) e produce diagnosi, punti forti/deboli, piano d'azione a 3 orizzonti con impatto stimato, verdetto piatto per piatto, indicazioni di menu design e descrizioni riscritte. |
| **Nuovo menu** | Menu A4 stampabile/PDF in 3 stili, sezioni ordinate dall'agente, piatti da spingere in box in cima alla sezione, prezzi senza € e non incolonnati, piatti da eliminare nascondibili. |

## Costi AI (scelta qualità/prezzo)

- **Lettura documenti:** `claude-haiku-5-5` con output strutturato e sforzo `low`. Le foto vengono ridimensionate nel
  browser a ~1600 px JPEG prima dell'invio: una pagina costa circa 2.000 token in ingresso, cioè **frazioni di
  centesimo** per scansione.
- **Fatture XML:** lette gratis in modo deterministico. L'AI viene usata solo sul testo delle righe per normalizzare
  unità e nomi (costo trascurabile). Senza chiave API l'import XML funziona comunque.
- **Agente strategia:** `claude-opus-5-5` con sforzo `medium` (configurabile con `STRATEGY_EFFORT`), una chiamata per
  report. Il fallback lato server è attivo in caso di rifiuto.
- Ogni chiamata viene registrata in `ai_usage` (Impostazioni → Utilizzo AI): serve a fissare i limiti dei piani.

I modelli si cambiano da `.env` (`SCAN_MODEL`, `STRATEGY_MODEL`).

## Stack

Next.js 16 (App Router, Server Actions) · Tailwind CSS 4 · Better Auth · Drizzle ORM + libSQL (SQLite in locale,
Turso in produzione) · Anthropic SDK · Zod.

## Avvio in locale

```bash
npm install
```

```bash
cp .env.example .env
```

Poi compila `.env`: `BETTER_AUTH_SECRET` (stringa casuale lunga), `ANTHROPIC_API_KEY` e, se serve, le credenziali Google.

```bash
npm run db:push
```

```bash
npm run dev
```

Apri http://localhost:3000.

### Login con Google

1. Google Cloud Console → API e servizi → Credenziali → *Crea ID client OAuth* (applicazione web).
2. URI di reindirizzamento autorizzato: `http://localhost:3000/api/auth/callback/google` (e quello di produzione).
3. Copia ID e secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Il pulsante compare solo se sono impostati.

## Produzione

- Database: crea un database Turso e imposta `DATABASE_URL=libsql://...` e `DATABASE_AUTH_TOKEN`, poi `npm run db:push`.
- Hosting: Vercel (o qualsiasi host Node). Imposta `BETTER_AUTH_URL` sul dominio pubblico.

## Struttura

```
src/lib/costing.ts      motore di calcolo (puro, testabile)
src/lib/audit.ts        regole dell'audit del menu
src/lib/ai/scan.ts      lettura di menu, fatture e ricette (schemi + prompt)
src/lib/ai/strategy.ts  agente strategia
src/lib/fatturapa.ts    parser della fattura elettronica XML
src/app/app/actions.ts  azioni server (CRUD, import, agente)
src/app/app/*           pagine del gestionale
```

## Prossimi passi

- Pagamenti (Stripe) e limiti per piano basati su `ai_usage`.
- Import CSV delle vendite dal gestionale cassa.
- Più locali per account e ruoli (titolare, cucina).
- Menu digitale con QR code generato dallo stesso layout.
