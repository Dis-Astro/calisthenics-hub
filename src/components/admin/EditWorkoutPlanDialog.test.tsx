import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditWorkoutPlanDialog from "./EditWorkoutPlanDialog";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(), success: vi.fn(), close: vi.fn(), deletes: vi.fn(), inserts: vi.fn(),
  rows: new Map<string, Record<string, unknown>>(), fail: false,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/admin/ExerciseNameInput", () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
  <input aria-label="Esercizio" value={value} onChange={event => onChange(event.target.value)} />,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let changes: Record<string, unknown> | undefined;
    const filters: Record<string, string> = {};
    const plan = { id: "plan", name: "Scheda", end_date: "2026-12-31", status: "attiva" };
    const query = {
      select: () => query, order: () => query, in: () => query,
      eq: (key: string, value: string) => { filters[key] = value; return query; },
      update: (value: Record<string, unknown>) => { changes = value; return query; },
      delete: () => { mocks.deletes(); return query; },
      insert: (value: unknown) => { mocks.inserts(value); return query; },
      single: async () => {
        if (!changes) return { data: plan, error: null };
        if (mocks.fail) return { data: null, error: { message: "Offline" } };
        const row = mocks.rows.get(filters.id)!;
        mocks.rows.set(filters.id, { ...row, ...changes });
        return { data: { id: filters.id }, error: null };
      },
      then: (resolve: (value: unknown) => void) => Promise.resolve({
        data: table === "workout_plan_exercises" ? [...mocks.rows.values()] : plan,
        error: null,
      }).then(resolve),
    };
    return query;
  },
} }));

beforeEach(() => {
  mocks.rows.clear(); mocks.fail = false;
  for (const mock of [mocks.toast, mocks.success, mocks.close, mocks.deletes, mocks.inserts]) mock.mockClear();
  mocks.rows.set("day-one", { id: "day-one", exercise_name: "Trazioni", day_of_week: 1, order_index: 0,
    exercise_id: "catalogue", notes: "Nota originale", rest_seconds: 90, sets: 4, reps: "6", video_id: "video" });
  mocks.rows.set("day-two", { id: "day-two", exercise_name: "Dip", day_of_week: 2, order_index: 0,
    notes: "Secondo giorno", rest_seconds: 120 });
});
afterEach(cleanup);

describe("modifica scheda senza perdere dati", () => {
  it("modifica il recupero nel testo conservando ID, prescrizione e note di entrambi i giorni", async () => {
    render(<EditWorkoutPlanDialog planId="plan" open onOpenChange={mocks.close} onSuccess={mocks.success} />);
    const input = await screen.findByDisplayValue("Trazioni");
    fireEvent.change(input, { target: { value: "Trazioni recupero 120s" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Modifiche" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.deletes).not.toHaveBeenCalled();
    expect(mocks.inserts).not.toHaveBeenCalled();
    expect(mocks.rows.get("day-one")).toMatchObject({
      id: "day-one", exercise_name: "Trazioni recupero 120s", exercise_id: "catalogue",
      notes: "Nota originale", rest_seconds: 90, sets: 4, reps: "6", video_id: "video",
    });
    expect(mocks.rows.get("day-two")).toMatchObject({ id: "day-two", notes: "Secondo giorno", rest_seconds: 120 });
  });

  it("non chiude la scheda o segnala successo se un esercizio non viene salvato", async () => {
    mocks.fail = true;
    render(<EditWorkoutPlanDialog planId="plan" open onOpenChange={mocks.close} onSuccess={mocks.success} />);
    await screen.findByDisplayValue("Trazioni");
    fireEvent.click(screen.getByRole("button", { name: "Salva Modifiche" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Trazioni")).toBeInTheDocument();
  });
});
