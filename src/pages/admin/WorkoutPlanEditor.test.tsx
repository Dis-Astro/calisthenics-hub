import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutPlanEditor from "./WorkoutPlanEditor";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), copy: vi.fn(), mutation: vi.fn(), volumeMounts: 0, volumeUnmounts: 0 }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { user_id: "coach" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/copyExerciseText", () => ({ copyExerciseText: (text: string) => mocks.copy(text) }));
vi.mock("@/components/admin/AdminLayout", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ui/slider", () => ({ Slider: () => null }));
vi.mock("@/components/admin/ExerciseNameInput", () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
  <textarea aria-label="Bozza esercizio" value={value} onChange={event => onChange(event.target.value)} />,
}));

// Native controls keep these tests focused on independent selections, rather than Radix's pointer handling.
vi.mock("@/components/ui/select", () => ({
  Select: function SelectMock({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (value: string) => void }) {
    const nodes = Children.toArray(children).filter(isValidElement);
    const trigger = nodes[0]?.props as Record<string, unknown>;
    const content = nodes[1]?.props as { children?: ReactNode } | undefined;
    return <select aria-label={trigger?.["aria-label"] as string | undefined} value={value} onChange={event => onValueChange(event.target.value)}>
      {Children.toArray(content?.children).filter(isValidElement).map(node => {
        const props = node.props as { value: string; children: ReactNode };
        return <option key={props.value} value={props.value}>{props.children}</option>;
      })}
    </select>;
  },
  SelectTrigger: () => null, SelectValue: () => null, SelectContent: () => null, SelectItem: () => null,
}));

vi.mock("@/components/admin/VolumeIntensityTable", () => ({
  default: function VolumeControllerMock({ compactTarget, showFull = true }: { compactTarget?: HTMLElement | null; showFull?: boolean }) {
    const [value, setValue] = useState("");
    useEffect(() => { mocks.volumeMounts++; return () => { mocks.volumeUnmounts++; }; }, []);
    const cell = (label: string) => <input aria-label={label} value={value} onChange={event => setValue(event.target.value)} />;
    return <>
      {showFull && cell("Volume standard")}
      {compactTarget && createPortal(cell("Volume compatto"), compactTarget)}
    </>;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const plans = [
      { id: "plan", name: "Scheda precedente", start_date: "2026-11-01", end_date: "2026-11-30", plan_type: "workout_plan", coach_notes: "Nota scheda esclusa dalla copia" },
      { id: "test-a", name: "Test A", start_date: "2026-11-02", end_date: "2026-11-30", plan_type: "test", coach_notes: "Nota Test A" },
      { id: "test-b", name: "Test B", start_date: "2026-11-03", end_date: "2026-11-30", plan_type: "test", coach_notes: "Nota Test B" },
    ];
    const exercises = [
      { id: "exercise-plan", workout_plan_id: "plan", exercise_name: "Trazioni blu\n4x5 recupero 90s", day_of_week: 1, order_index: 0 },
      { id: "exercise-a", workout_plan_id: "test-a", exercise_name: "Muscle up\n3x2", day_of_week: 1, order_index: 0 },
      { id: "exercise-b", workout_plan_id: "test-b", exercise_name: "Dip verde\n5x5", day_of_week: 1, order_index: 0 },
    ];
    const data = () => {
      if (table === "profiles") return { first_name: "Cliente", last_name: "Prova" };
      if (table === "workout_plans") return filters.plan_type ? plans.filter(plan => plan.plan_type === filters.plan_type) : plans;
      if (table === "workout_plan_exercises") return exercises.filter(exercise => !filters.workout_plan_id || (filters.workout_plan_id as string[]).includes(exercise.workout_plan_id));
      if (table === "workout_completions") return [{ workout_plan_exercise_id: "exercise-plan", set_number: 2, client_notes: "Feedback da conservare", difficulty_rating: 7, completed_at: "2026-11-10T12:00:00Z" }];
      if (table === "coach_test_notes") return [{ workout_plan_exercise_id: "exercise-a", note: "Valutazione originale", rating: 6 }];
      return [];
    };
    const query = {
      select: () => query, order: () => query, is: () => query, or: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      in: (key: string, value: unknown) => { filters[key] = value; return query; },
      single: async () => ({ data: data(), error: null }),
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: data(), error: null }).then(resolve),
      insert: mocks.mutation, update: mocks.mutation, delete: mocks.mutation,
    };
    return query;
  },
} }));

beforeEach(() => {
  mocks.toast.mockClear(); mocks.copy.mockReset().mockResolvedValue(true); mocks.mutation.mockClear();
  mocks.volumeMounts = 0; mocks.volumeUnmounts = 0;
});
afterEach(cleanup);

async function openEditor() {
  render(<MemoryRouter initialEntries={["/admin/utenti/client/scheda/nuova"]}><Routes>
    <Route path="/admin/utenti/:userId/scheda/nuova" element={<WorkoutPlanEditor />} />
  </Routes></MemoryRouter>);
  await screen.findByPlaceholderText("Es. Scheda Forza - Febbraio");
}

describe("riferimenti dell'editor schede", () => {
  it("condivide un solo controller Volume tra centro e destra e conserva la bozza cambiando vista", async () => {
    await openEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Bozza esercizio" }), { target: { value: "Bozza da mantenere" } });
    fireEvent.click(screen.getByRole("button", { name: "Volume & Intensità" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Volume standard" }), { target: { value: "4x3" } });
    fireEvent.click(screen.getByRole("button", { name: "Mostra Volume & Intensità" }));
    expect(await screen.findByRole("textbox", { name: "Volume compatto" })).toHaveValue("4x3");
    fireEvent.change(screen.getByRole("textbox", { name: "Volume compatto" }), { target: { value: "6x2" } });
    expect(screen.getByRole("textbox", { name: "Volume standard" })).toHaveValue("6x2");
    fireEvent.click(screen.getByRole("button", { name: "Torna alla scheda" }));
    expect(screen.getByRole("textbox", { name: "Bozza esercizio" })).toHaveValue("Bozza da mantenere");
    expect(screen.getByRole("textbox", { name: "Volume compatto" })).toHaveValue("6x2");
    fireEvent.click(screen.getByRole("button", { name: "Torna a Test & Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Volume & Intensità" }));
    expect(screen.getByRole("textbox", { name: "Volume standard" })).toHaveValue("6x2");
    expect(mocks.volumeMounts).toBe(1);
    expect(mocks.volumeUnmounts).toBe(0);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("mantiene selezioni e feedback indipendenti e copia soltanto il testo dell'esercizio", async () => {
    await openEditor();
    const left = screen.getByRole("combobox", { name: "Seleziona scheda laterale" });
    expect(within(left).getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Trazioni blu/ }));
    expect(screen.getByText("Feedback da conservare")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Copia esercizio 1 (scheda laterale)" }));
    await waitFor(() => expect(mocks.copy).toHaveBeenLastCalledWith("Trazioni blu\n4x5 recupero 90s"));
    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Seleziona test laterale" }), { target: { value: "test-b" } });
    expect(screen.getByRole("combobox", { name: "Seleziona test Test & Note" })).toHaveValue("test-a");
    fireEvent.click(screen.getByRole("button", { name: "Copia esercizio 1 (test laterale)" }));
    await waitFor(() => expect(mocks.copy).toHaveBeenLastCalledWith("Dip verde\n5x5"));
    fireEvent.click(screen.getByRole("button", { name: "Copia esercizio 1 (Test & Note)" }));
    await waitFor(() => expect(mocks.copy).toHaveBeenLastCalledWith("Muscle up\n3x2"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schede" }));
    expect(screen.getByText("Feedback da conservare")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(screen.getByRole("combobox", { name: "Seleziona test laterale" })).toHaveValue("test-b");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
});
