import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/** Lettura documenti: il modello più economico, adatto a OCR + estrazione strutturata. */
export const SCAN_MODEL = process.env.SCAN_MODEL ?? "claude-haiku-5-5";
/** Agente strategia: ragionamento sui numeri e piano d'azione. */
export const STRATEGY_MODEL = process.env.STRATEGY_MODEL ?? "claude-opus-5-5";

export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "Chiave API di Claude non valida.";
  if (error instanceof Anthropic.RateLimitError) return "Troppe richieste in poco tempo: riprova tra qualche secondo.";
  if (error instanceof Anthropic.BadRequestError) return `Richiesta non valida: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Errore del servizio AI (${error.status ?? "rete"}). Riprova.`;
  return error instanceof Error ? error.message : "Errore sconosciuto";
}
