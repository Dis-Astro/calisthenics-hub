import { describe, expect, it } from "vitest";
import { buildContactMailto, telHref, whatsappHref, GYM_EMAIL } from "./contactRequest";

describe("contactRequest", () => {
  it("calls the same number that the page shows", () => {
    expect(telHref()).toBe("tel:+393484157414");
  });

  it("builds a wa.me link with digits only", () => {
    expect(whatsappHref("Ciao!")).toBe("https://wa.me/393484157414?text=Ciao!");
  });

  it("puts every field in the email to the gym", () => {
    const href = buildContactMailto({
      nome: " Anna Rossi ",
      email: "anna@example.com",
      telefono: "333 000 1111",
      obiettivo: "forza",
      messaggio: "Orari serali & corsi?",
    });
    expect(href.startsWith(`mailto:${GYM_EMAIL}?subject=`)).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Richiesta informazioni - Anna Rossi");
    const body = params.get("body") ?? "";
    expect(body).toContain("Nome: Anna Rossi");
    expect(body).toContain("Email: anna@example.com");
    expect(body).toContain("Telefono: 333 000 1111");
    expect(body).toContain("Obiettivo: Aumentare la forza");
    expect(body).toContain("Orari serali & corsi?");
    expect(href).not.toContain("+");
  });
});
