import { afterEach, describe, expect, it, vi } from "vitest";
import { copyExerciseText } from "./copyExerciseText";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const commandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

afterEach(() => {
  document.body.replaceChildren();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  if (commandDescriptor) Object.defineProperty(document, "execCommand", commandDescriptor);
  else Reflect.deleteProperty(document, "execCommand");
});

describe("copyExerciseText", () => {
  it("avvia il fallback nello stesso gesto prima che la clipboard rifiuti e conserva testo e selezione", async () => {
    let rejectClipboard!: (reason: Error) => void;
    const writeText = vi.fn(() => new Promise<void>((_, reject) => { rejectClipboard = reject; }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const copy = vi.fn(() => {
      expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-hidden="true"]')?.value).toBe("Trazioni blu\n4x5 recupero 90s");
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: copy });
    const draft = document.createElement("textarea");
    draft.value = "Bozza ancora aperta";
    document.body.append(draft);
    draft.focus();
    draft.setSelectionRange(2, 7);

    const result = copyExerciseText("Trazioni blu\n4x5 recupero 90s");
    expect(writeText).toHaveBeenCalledWith("Trazioni blu\n4x5 recupero 90s");
    expect(copy).toHaveBeenCalledWith("copy");
    expect(document.activeElement).toBe(draft);
    expect(draft.selectionStart).toBe(2);
    expect(draft.selectionEnd).toBe(7);
    expect(document.querySelector('textarea[aria-hidden="true"]')).not.toBeInTheDocument();
    rejectClipboard(new Error("Blocked"));
    await expect(result).resolves.toBe(true);
  });

  it("accetta il successo della API anche quando il browser non offre execCommand", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    Object.defineProperty(document, "execCommand", { configurable: true, value: undefined });
    await expect(copyExerciseText("Dip 5x5")).resolves.toBe(true);
  });

  it("segnala il fallimento senza lasciare campi nascosti quando entrambi i metodi sono bloccati", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Blocked")) } });
    Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
    await expect(copyExerciseText("Dip 5x5")).resolves.toBe(false);
    expect(document.body).toBeEmptyDOMElement();
  });
});
