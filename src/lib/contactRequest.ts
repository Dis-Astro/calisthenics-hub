// Recapiti pubblici della palestra: un'unica fonte per testo visibile e link.
export const GYM_PHONE_DISPLAY = "+39 348 415 7414";
export const GYM_PHONE_E164 = "+393484157414";
export const GYM_EMAIL = "mariano@superpowergym.it";

export const GOAL_LABELS: Record<string, string> = {
  iniziare: "Iniziare il calisthenics",
  migliorare: "Migliorare le mie skills",
  dimagrire: "Dimagrire e tonificare",
  forza: "Aumentare la forza",
  altro: "Altro",
};

export interface ContactRequest {
  nome: string;
  email: string;
  telefono: string;
  obiettivo: string;
  messaggio: string;
}

export const telHref = () => `tel:${GYM_PHONE_E164}`;

// wa.me accetta solo cifre: niente "+", spazi o trattini.
export const whatsappHref = (text: string) =>
  `https://wa.me/${GYM_PHONE_E164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export function buildContactMailto(request: ContactRequest): string {
  const goal = GOAL_LABELS[request.obiettivo] ?? request.obiettivo;
  const subject = `Richiesta informazioni - ${request.nome.trim()}`;
  const body = [
    `Nome: ${request.nome.trim()}`,
    `Email: ${request.email.trim()}`,
    `Telefono: ${request.telefono.trim()}`,
    `Obiettivo: ${goal}`,
    "",
    request.messaggio.trim() || "(nessun messaggio)",
  ].join("\r\n");
  // encodeURIComponent, non URLSearchParams: gli spazi devono diventare %20, non "+".
  return `mailto:${GYM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
