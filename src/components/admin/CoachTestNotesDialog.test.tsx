import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachTestNotesDialog from "./CoachTestNotesDialog";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), updated: vi.fn(), save: vi.fn(), rows: new Map<string, Record<string, unknown>>() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { user_id: "coach" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let pending: Record<string, unknown>[] | undefined;
    const query = {
      select: () => query, eq: () => query, order: () => query,
      upsert: (values: Record<string, unknown>[]) => { pending = values; return query; },
      then: (resolve: (value: unknown) => void) => pending ? mocks.save(pending).then(resolve) : Promise.resolve({
        data: table === "workout_plan_exercises" ? [{ id: "exercise", exercise_name: "Trazioni", day_of_week: 1, order_index: 0 }] : [...mocks.rows.values()],
        error: null,
      }).then(resolve),
    };
    return query;
  },
} }));
beforeEach(() => {
  mocks.toast.mockClear(); mocks.updated.mockClear(); mocks.rows.clear();
  mocks.save.mockReset().mockImplementation(async values => {
    const rows = values.map((value: Record<string, unknown>) => {
      const id = String(value.workout_plan_exercise_id);
      const row = { id: mocks.rows.get(id)?.id ?? "note", ...value };
      mocks.rows.set(id, row); return row;
    });
    return { data: rows, error: null };
  });
});
afterEach(cleanup);
async function openNote() {
  render(<CoachTestNotesDialog planId="plan" planName="Test" onNotesUpdated={mocks.updated} />);
  fireEvent.click(screen.getByRole("button", { name: /Note Test/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Trazioni/ }));
  return screen.getByPlaceholderText("Movimento, massimale, correzioni...");
}
describe("note del coach", () => {
  it("salva due volte e permette di cancellare il testo mantenendo la stessa nota", async () => {
    const input = await openNote();
    fireEvent.change(input, { target: { value: "Prima correzione" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Note" }));
    await waitFor(() => expect(mocks.updated).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "Nuova correzione" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Note" }));
    await waitFor(() => expect(mocks.updated).toHaveBeenCalledTimes(2));
    expect(mocks.rows.size).toBe(1);
    expect(mocks.rows.get("exercise")).toMatchObject({ id: "note", note: "Nuova correzione" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Note" }));
    await waitFor(() => expect(mocks.updated).toHaveBeenCalledTimes(3));
    expect(mocks.rows.get("exercise")?.note).toBeNull();
  });

  it("mantiene la nota da riprovare e non annuncia successo se il database la rifiuta", async () => {
    mocks.save.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
    const input = await openNote();
    fireEvent.change(input, { target: { value: "Non perdere" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva Note" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Note non salvate" })));
    expect(mocks.updated).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Non perdere")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salva Note" })).toBeEnabled();
  });
});
