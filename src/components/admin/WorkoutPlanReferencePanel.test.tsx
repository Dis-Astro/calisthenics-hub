import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkoutPlanReferencePanel from "./WorkoutPlanReferencePanel";

vi.mock("@/components/admin/VolumeIntensityTable", () => ({
  default: ({ clientId, compact }: { clientId: string; compact?: boolean }) => {
    const [draft, setDraft] = useState("");
    return <div aria-label={`Volume di ${clientId}`}>
      <span>{compact ? "Vista compatta" : "Vista completa"}</span>
      <input aria-label="Volume di prova" value={draft} onChange={event => setDraft(event.target.value)} />
    </div>;
  },
}));

afterEach(cleanup);

describe("WorkoutPlanReferencePanel", () => {
  it("sostituisce Test & Note con il volume dello stesso cliente conservando entrambe le bozze", () => {
    render(
      <WorkoutPlanReferencePanel clientId="cliente-originale" testSelector={
        <select aria-label="Seleziona test" defaultValue="due"><option value="uno">Primo test</option><option value="due">Secondo test</option></select>
      }>
        <input aria-label="Nota test" defaultValue="Nota originale" />
      </WorkoutPlanReferencePanel>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Nota test" }), { target: { value: "Bozza test" } });
    expect(screen.queryByRole("textbox", { name: "Volume di prova" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostra Volume & Intensità" }));
    expect(screen.getByRole("heading", { name: "Volume & Intensità" })).toBeInTheDocument();
    expect(screen.getByLabelText("Volume di cliente-originale")).toBeInTheDocument();
    expect(screen.getByText("Vista compatta")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Nota test" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Volume di prova" }), { target: { value: "4x3" } });

    fireEvent.click(screen.getByRole("button", { name: "Torna a Test & Note" }));
    expect(screen.getByRole("textbox", { name: "Nota test" })).toHaveValue("Bozza test");
    expect(screen.getByRole("combobox", { name: "Seleziona test" })).toHaveValue("due");
    fireEvent.click(screen.getByRole("button", { name: "Mostra Volume & Intensità" }));
    expect(screen.getByRole("textbox", { name: "Volume di prova" })).toHaveValue("4x3");
  });
});
