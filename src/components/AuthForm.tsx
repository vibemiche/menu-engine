"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode, googleEnabled }: { mode: "login" | "register"; googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get("identifier") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    try {
      if (mode === "register") {
        const username = String(fd.get("username") ?? "").trim();
        const { error } = await authClient.signUp.email({
          name: String(fd.get("name") ?? "").trim() || username,
          email: String(fd.get("email") ?? "").trim(),
          username,
          password,
        });
        if (error) throw new Error(translate(error.message ?? error.code ?? "Errore"));
      } else {
        const { error } = identifier.includes("@")
          ? await authClient.signIn.email({ email: identifier, password })
          : await authClient.signIn.username({ username: identifier, password });
        if (error) throw new Error(translate(error.message ?? error.code ?? "Errore"));
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore");
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    await authClient.signIn.social({ provider: "google", callbackURL: "/app" });
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl font-semibold">{mode === "login" ? "Bentornato" : "Crea il tuo account"}</h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "login" ? "Accedi per vedere i margini del tuo menu." : "In pochi minuti hai il food cost di ogni piatto."}
      </p>

      {googleEnabled && (
        <>
          <button type="button" onClick={google} disabled={loading} className="btn-secondary mt-6 w-full py-2.5">
            <GoogleIcon /> Continua con Google
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> oppure <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className={`space-y-4 ${googleEnabled ? "" : "mt-6"}`}>
        {mode === "register" ? (
          <>
            <div>
              <label className="label" htmlFor="name">Nome e cognome</label>
              <input id="name" name="name" className="input" autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="username">Nome utente</label>
              <input id="username" name="username" className="input" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.]+" title="Lettere, numeri, punto e trattino basso" autoComplete="username" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" required autoComplete="email" />
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="identifier">Nome utente o email</label>
            <input id="identifier" name="identifier" className="input" required autoComplete="username" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error && <p className="rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? "Attendi…" : mode === "login" ? "Accedi" : "Crea account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>Non hai un account? <Link href="/registrati" className="font-medium text-basil hover:underline">Registrati</Link></>
        ) : (
          <>Hai già un account? <Link href="/login" className="font-medium text-basil hover:underline">Accedi</Link></>
        )}
      </p>
    </div>
  );
}

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid") && (m.includes("password") || m.includes("username") || m.includes("email"))) return "Credenziali non valide.";
  if (m.includes("already") && m.includes("username")) return "Questo nome utente è già in uso.";
  if (m.includes("already") || m.includes("exists")) return "Esiste già un account con questa email.";
  if (m.includes("password") && m.includes("short")) return "La password deve avere almeno 8 caratteri.";
  if (m.includes("username")) return "Nome utente non valido (3-30 caratteri: lettere, numeri, _ e .).";
  return msg;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
