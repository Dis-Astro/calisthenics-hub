import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutDayDetail from "./WorkoutDayDetail";

const mocks = vi.hoisted(() => ({
  save: vi.fn(), success: vi.fn(), error: vi.fn(), writes: vi.fn(),
  rows: new Map<number, Record<string, unknown>>(), loadError: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { user_id: "client" } }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let payload: Record<string, unknown>;
    const query = {
      select: () => query, eq: () => query, is: () => query, lte: () => query,
      gte: () => query, in: () => query, order: () => query, limit: () => query,
      upsert: (value: Record<string, unknown>, options: unknown) => {
        payload = value; mocks.writes(value, options); return query;
      },
      single: () => mocks.save(payload),
      then: (resolve: (value: unknown) => void) => {
        const start = new Date();
        const end = new Date(start); end.setDate(end.getDate() + 6);
        const data = table === "workout_plans"
          ? [{ id: "plan", name: "Scheda", start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) }]
          : table === "workout_plan_exercises"
            ? [{ id: "exercise", exercise_name: "Trazioni", notes: "Nota coach", rest_seconds: 90, order_index: 0, video: null }]
            : table === "workout_completions" ? [...mocks.rows.values()] : [];
        const failed = table === "workout_completions" && mocks.loadError;
        return Promise.resolve({ data: failed ? null : data, error: failed ? { message: "Offline" } : null }).then(resolve);
      },
    };
    return query;
  },
} }));

beforeEach(() => {
  mocks.rows.clear(); mocks.loadError = false;
  mocks.success.mockClear(); mocks.error.mockClear(); mocks.writes.mockClear();
  mocks.save.mockReset().mockImplementation(async payload => {
    if (payload.difficulty_rating === 0) return { data: null, error: { code: "23514" } };
    const previous = mocks.rows.get(payload.set_number);
    const row = { id: previous?.id ?? "completion", ...previous, ...payload };
    mocks.rows.set(payload.set_number, row);
    return { data: { id: row.id }, error: null };
  });
});
afterEach(cleanup);

async function openExercise() {
  render(<MemoryRouter initialEntries={["/giorno/1?planId=plan"]}>
    <Routes><Route path="/giorno/:dayId" element={<WorkoutDayDetail />} /></Routes>
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Trazioni/ }));
  return screen.getByPlaceholderText("Note sulla settimana (opzionale)...");
}

describe("salvataggio commenti settimanali", () => {
  it("salva una nota senza voto e la ritrova alla riapertura", async () => {
    const input = await openExercise();
    fireEvent.change(input, { target: { value: "Recupero troppo breve" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Valutazione" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.rows.get(1)?.difficulty_rating).toBeNull();
    cleanup();
    await openExercise();
    expect(screen.getByDisplayValue("Recupero troppo breve")).toBeInTheDocument();
  });

  it("mantiene la bozza e non segnala successo se il database rifiuta il salvataggio", async () => {
    mocks.save.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Denied" } });
    const input = await openExercise();
    fireEvent.change(input, { target: { value: "Da conservare" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Valutazione" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Da conservare")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salva Valutazione" })).toBeEnabled();
  });

  it("aggiorna la stessa settimana senza duplicarla e conserva gli altri dati", async () => {
    mocks.rows.set(1, { id: "original", workout_plan_exercise_id: "exercise", set_number: 1, actual_sets: 3, client_notes: "Prima", difficulty_rating: 7 });
    const input = await openExercise();
    expect(screen.getByRole("button", { name: "Aggiorna" })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Dopo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Valutazione" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.rows.size).toBe(1);
    expect(mocks.rows.get(1)).toMatchObject({ id: "original", actual_sets: 3, client_notes: "Dopo" });
    expect(mocks.writes).toHaveBeenCalledWith(expect.anything(), { onConflict: "workout_plan_exercise_id,client_id,set_number" });
  });

  it("non marca come salvata una modifica digitata durante la richiesta", async () => {
    let finish!: (value: unknown) => void;
    mocks.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const input = await openExercise();
    fireEvent.change(input, { target: { value: "Prima" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Valutazione" }));
    fireEvent.change(input, { target: { value: "Ultima bozza" } });
    await act(async () => { finish({ data: { id: "completion" }, error: null }); });
    expect(screen.getByDisplayValue("Ultima bozza")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salva Valutazione" })).toBeEnabled();
  });

  it("non mostra commenti vuoti quando la lettura fallisce e permette di riprovare", async () => {
    mocks.loadError = true;
    render(<MemoryRouter initialEntries={["/giorno/1?planId=plan"]}><Routes><Route path="/giorno/:dayId" element={<WorkoutDayDetail />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossibile caricare i commenti");
    mocks.loadError = false;
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByRole("button", { name: /Trazioni/ })).toBeInTheDocument();
  });
});
