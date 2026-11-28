import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VolumeIntensityTable from "./VolumeIntensityTable";

interface MockRecord { id: string; [key: string]: unknown }
const mocks = vi.hoisted(() => ({
  save: vi.fn(), remove: vi.fn(), insert: vi.fn(), toast: vi.fn(),
  tables: [] as MockRecord[], rows: [] as MockRecord[],
  loadError: null as { code: string; message: string } | null,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "coach" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let operation = "read";
      let changes: Record<string, unknown> = {};
      const filters: Record<string, string> = {};
      let parentIds: string[] | undefined;
      const ordering: { key: string; ascending: boolean }[] = [];
      const execute = async () => {
        const records = table === "volume_tables" ? mocks.tables : mocks.rows;
        const matches = records.filter(record => Object.entries(filters).every(([key, value]) => record[key] === value)
          && (!parentIds || parentIds.includes(String(record.table_id))));
        if (operation === "read") {
          matches.sort((left, right) => {
            for (const { key, ascending } of ordering) {
              const a = left[key] as string | number;
              const b = right[key] as string | number;
              if (a < b) return ascending ? -1 : 1;
              if (a > b) return ascending ? 1 : -1;
            }
            return 0;
          });
          return { data: mocks.loadError ? null : matches, error: mocks.loadError };
        }
        if (operation === "insert") {
          const result = await mocks.insert(table, changes);
          if (!result.error && result.data) records.push(result.data);
          return result;
        }
        if (operation === "update") {
          const result = await mocks.save(table, filters.id, changes, { ...filters });
          if (!result.error && result.data) matches.forEach(record => Object.assign(record, changes));
          return result;
        }
        const result = await mocks.remove(table, { ...filters });
        if (!result.error && result.data) {
          const ids = new Set(matches.map(record => record.id));
          if (table === "volume_tables") {
            mocks.tables = mocks.tables.filter(record => !ids.has(record.id));
            mocks.rows = mocks.rows.filter(record => !ids.has(String(record.table_id)));
          } else mocks.rows = mocks.rows.filter(record => !ids.has(record.id));
        }
        return result;
      };
      const query = {
        select: () => query,
        eq: (key: string, value: string) => { filters[key] = value; return query; },
        in: (_key: string, values: string[]) => { parentIds = values; return query; },
        order: (key: string, { ascending }: { ascending: boolean }) => { ordering.push({ key, ascending }); return query; },
        update: (value: Record<string, unknown>) => { operation = "update"; changes = value; return query; },
        delete: () => { operation = "delete"; return query; },
        insert: (value: Record<string, unknown>) => { operation = "insert"; changes = value; return query; },
        single: execute,
        then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => execute().then(resolve, reject),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  mocks.tables = [{ id: "table", client_id: "client", title: "Trazioni", position: 0, created_at: "2026-11-17T10:00:00Z" }];
  mocks.rows = [
    { id: "latest", table_id: "table", label: "Questa settimana", dates: { band_10_30: "2026-11-17" }, cells: {}, created_at: "2026-11-17T10:00:00Z" },
    { id: "old", table_id: "table", label: "Settimana precedente", dates: {}, cells: {}, created_at: "2026-11-10T10:00:00Z" },
  ];
  mocks.save.mockReset().mockImplementation(async (_table, id) => ({ data: { id }, error: null }));
  mocks.remove.mockReset().mockImplementation(async (table, filters) => ({
    data: (table === "volume_tables" ? mocks.tables : mocks.rows).find(record =>
      Object.entries(filters).every(([key, value]) => record[key] === value)) ?? null, error: null,
  }));
  mocks.insert.mockReset().mockImplementation(async (table, changes) => ({ data: {
    id: table === "volume_tables" ? "new-table" : "new-row", ...changes, created_at: "2026-11-18T10:00:00Z",
  }, error: null }));
  mocks.toast.mockClear();
  mocks.loadError = null;
});

afterEach(async () => {
  await act(async () => { cleanup(); });
  vi.useRealTimers();
});

async function openTable() {
  render(<VolumeIntensityTable clientId="client" />);
  await screen.findByDisplayValue("Trazioni");
}

const scope = { id: "latest", table_id: "table" };
const success = (id = "latest") => ({ data: { id }, error: null });
async function confirmDelete(button: HTMLElement) {
  fireEvent.click(button);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Elimina$/ })); });
}

describe("VolumeIntensityTable", () => {
  it("uses nine narrow bands and an editable total in compact view, without date fields", async () => {
    render(<VolumeIntensityTable clientId="client" compact />);
    await screen.findByDisplayValue("Trazioni");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    for (const label of ["10%-20%", "20%-30%", "30%-40%", "40%-50%", "50%-60%", "60%-70%", "70%-80%", "80%-90%", "90%-100%", "TOT."]) {
      expect(screen.getByRole("textbox", { name: `Volume ${label}` })).toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/^Data /)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /fascia precedente/ })).not.toBeInTheDocument();
    const cell = screen.getByRole("textbox", { name: "Volume 90%-100%" });
    fireEvent.change(cell, { target: { value: "3x1" } });
    await act(async () => { fireEvent.blur(cell); });
    expect(mocks.save).toHaveBeenCalledWith("volume_table_rows", "latest", { cells: { band_90_100: "3x1" } }, scope);
    expect(mocks.rows[0].dates).toEqual({ band_10_30: "2026-11-17" });
  });

  it("retains original populated wide bands and unknown JSON without splitting values, even after clearing a legacy field", async () => {
    mocks.rows[0].cells = { band_10_30: "old 10-30", band_40_60: "old 40-60", band_50_70: "", band_60_80: "   ", band_90_100: "3x1", total: "12", extra_note: "keep" };
    await openTable();
    const legacy = screen.getByRole("textbox", { name: "Volume 10%-30% (fascia precedente)" });
    expect(legacy).toHaveValue("old 10-30");
    expect(screen.getByRole("textbox", { name: "Volume 40%-60% (fascia precedente)" })).toHaveValue("old 40-60");
    expect(screen.queryByRole("textbox", { name: "Volume 50%-70% (fascia precedente)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Volume 60%-80% (fascia precedente)" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Volume 10%-20%" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Volume TOT." })).toHaveValue("12");
    fireEvent.change(legacy, { target: { value: "" } });
    expect(legacy).toBeInTheDocument();
    fireEvent.change(legacy, { target: { value: "corretto 10-30" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Volume 10%-20%" }), { target: { value: "nuovo 10-20" } });
    await act(async () => { fireEvent.blur(legacy); });
    expect(mocks.save).toHaveBeenLastCalledWith("volume_table_rows", "latest", { cells: {
      band_10_30: "corretto 10-30", band_40_60: "old 40-60", band_50_70: "", band_60_80: "   ",
      band_90_100: "3x1", total: "12", extra_note: "keep", band_10_20: "nuovo 10-20",
    } }, scope);
    expect(mocks.rows[0].dates).toEqual({ band_10_30: "2026-11-17" });
  });

  it("creates an empty table and row with no generated dates or copied values", async () => {
    await openTable();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Nuova tabella" })); });
    expect(mocks.insert).toHaveBeenCalledWith("volume_tables", { client_id: "client", title: "", position: 1, created_by: "coach" });
    expect(mocks.insert).toHaveBeenCalledWith("volume_table_rows", { table_id: "new-table", label: "VOLUME sett.", dates: {}, cells: {}, created_by: "coach" });
    expect(mocks.rows[0].dates).toEqual({ band_10_30: "2026-11-17" });
  });

  it("puts a newly created table first immediately and after reloading", async () => {
    await openTable();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Nuova tabella" })); });
    expect(screen.getAllByRole("textbox", { name: "Nome tabella" }).map(input => input.id))
      .toEqual([expect.stringContaining("volume-title-new-table"), expect.stringContaining("volume-title-table")]);
    await act(async () => { cleanup(); });
    await openTable();
    expect(screen.getAllByRole("textbox", { name: "Nome tabella" }).map(input => input.id))
      .toEqual([expect.stringContaining("volume-title-new-table"), expect.stringContaining("volume-title-table")]);
  });

  it("orders both views by creation date first and descending position only when dates match", async () => {
    mocks.tables[0].position = 99;
    mocks.tables.push(
      { id: "recent", client_id: "client", title: "Recente", position: 1, created_at: "2026-11-18T10:00:00Z" },
      { id: "same-time", client_id: "client", title: "Pari data, posizione maggiore", position: 2, created_at: "2026-11-18T10:00:00Z" },
    );
    const target = document.createElement("div");
    document.body.append(target);
    const view = render(<VolumeIntensityTable clientId="client" compactTarget={target} />);
    await screen.findAllByDisplayValue("Trazioni");
    const titles = (container: HTMLElement) => within(container).getAllByRole("textbox", { name: "Nome tabella" })
      .map(input => (input as HTMLInputElement).value);
    const expected = ["Pari data, posizione maggiore", "Recente", "Trazioni"];
    expect(titles(view.container)).toEqual(expected);
    expect(titles(target)).toEqual(expected);
    view.unmount();
    target.remove();
  });

  it("shares one controller and save queue between the central table and compact portal, with unique ids", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const view = render(<VolumeIntensityTable clientId="client" compactTarget={target} />);
    await screen.findAllByDisplayValue("Trazioni");
    const cells = screen.getAllByRole("textbox", { name: "Volume 10%-20%" });
    fireEvent.change(cells[0], { target: { value: "4x3" } });
    expect(cells[1]).toHaveValue("4x3");
    const total = within(target).getByRole("textbox", { name: "Volume TOT." });
    fireEvent.change(total, { target: { value: "12" } });
    await act(async () => { fireEvent.blur(total); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith("volume_table_rows", "latest", { cells: { band_10_20: "4x3", total: "12" } }, scope);
    const ids = [...document.querySelectorAll("[id]")].map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    view.rerender(<VolumeIntensityTable clientId="client" compactTarget={target} showFull={false} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(target).getByRole("textbox", { name: "Volume 10%-20%" })).toHaveValue("4x3");
    fireEvent.click(within(target).getByRole("button", { name: "Elimina tabella" }));
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    view.unmount();
    target.remove();
  });

  it("blocks creation when database tables are missing and supports reloading after activation", async () => {
    mocks.loadError = { code: "PGRST205", message: "Missing table" };
    render(<VolumeIntensityTable clientId="client" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("non sono ancora disponibili nel database");
    expect(screen.queryByRole("button", { name: "Nuova tabella" })).not.toBeInTheDocument();
    mocks.loadError = null;
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByDisplayValue("Trazioni")).toBeInTheDocument();
  });

  it("shows the latest session and reveals older rows on request", async () => {
    await openTable();
    expect(screen.getByDisplayValue("Questa settimana")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Settimana precedente")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: /Mostra precedenti/ }));
    expect(screen.getByDisplayValue("Settimana precedente")).toBeInTheDocument();
  });

  it("keeps newest rows first on load and insertion while history shows older days without hiding same-day rows", async () => {
    mocks.rows.reverse();
    mocks.rows.push({ id: "same-day", table_id: "table", label: "Stesso giorno, prima", dates: {}, cells: {}, created_at: "2026-11-17T09:00:00Z" });
    await openTable();
    const labels = () => screen.getAllByRole("textbox", { name: "Etichetta volume" })
      .map(input => (input as HTMLTextAreaElement).value);
    expect(labels()).toEqual(["Questa settimana", "Stesso giorno, prima"]);
    expect(screen.getByRole("switch", { name: /Mostra precedenti/ })).toHaveAccessibleName("Mostra precedenti (1 nascoste)");
    fireEvent.click(screen.getByRole("switch", { name: /Mostra precedenti/ }));
    expect(labels()).toEqual(["Questa settimana", "Stesso giorno, prima", "Settimana precedente"]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Riga" })); });
    expect(labels()).toEqual(["VOLUME sett.", "Questa settimana", "Stesso giorno, prima", "Settimana precedente"]);
    fireEvent.click(screen.getByRole("switch", { name: /Mostra precedenti/ }));
    expect(labels()).toEqual(["VOLUME sett."]);
    await act(async () => { cleanup(); });
    await openTable();
    expect(labels()).toEqual(["VOLUME sett."]);
    fireEvent.click(screen.getByRole("switch", { name: /Mostra precedenti/ }));
    expect(labels()).toEqual(["VOLUME sett.", "Questa settimana", "Stesso giorno, prima", "Settimana precedente"]);
  });

  it("serializes saves so a slow request cannot overwrite newer edits", async () => {
    await openTable();
    vi.useFakeTimers();
    let finishFirst!: (value: ReturnType<typeof success>) => void;
    mocks.save.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    const cell = screen.getByRole("textbox", { name: "Volume 10%-20%" });
    fireEvent.change(cell, { target: { value: "4x3" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    fireEvent.change(cell, { target: { value: "5x3" } });
    fireEvent.blur(cell);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst(success()); });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1]).toEqual(["volume_table_rows", "latest", { cells: { band_10_20: "5x3" } }, scope]);
  });

  it("keeps a failed edit and retries it together with the next change", async () => {
    await openTable();
    vi.useFakeTimers();
    mocks.save.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Volume 10%-20%" }), { target: { value: "4x3" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(screen.getByRole("button", { name: /Non salvato/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Volume TOT." }), { target: { value: "12 ripetizioni" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Riprova/ })); });
    expect(mocks.save.mock.calls[1]).toEqual(["volume_table_rows", "latest", { cells: { band_10_20: "4x3", total: "12 ripetizioni" } }, scope]);
    expect(screen.queryByRole("button", { name: /Non salvato/ })).not.toBeInTheDocument();
  });

  it("does not report a save as successful when the database matches no row", async () => {
    await openTable();
    mocks.save.mockResolvedValueOnce({ data: null, error: null });
    const cell = screen.getByRole("textbox", { name: "Volume 10%-20%" });
    fireEvent.change(cell, { target: { value: "draft" } });
    await act(async () => { fireEvent.blur(cell); });
    expect(screen.getByRole("button", { name: /Non salvato/ })).toBeInTheDocument();
    expect(cell).toHaveValue("draft");
  });

  it("deletes only the new empty table while preserving another row's pending and in-flight changes", async () => {
    mocks.rows[0].cells = { band_10_30: "legacy", total: "10" };
    await openTable();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Nuova tabella" })); });
    vi.useFakeTimers();
    let finishFirst!: (value: ReturnType<typeof success>) => void;
    mocks.save.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    const existing = screen.getAllByRole("textbox", { name: "Volume 10%-20%" })[1];
    fireEvent.change(existing, { target: { value: "first" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    fireEvent.change(existing, { target: { value: "newer draft" } });
    await confirmDelete(screen.getAllByRole("button", { name: "Elimina tabella" })[0]);
    expect(mocks.remove).toHaveBeenCalledWith("volume_tables", { id: "new-table", client_id: "client" });
    expect(screen.getByDisplayValue("Trazioni")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Volume 10%-20%" })).toHaveValue("newer draft");
    expect(mocks.tables.map(table => table.id)).toEqual(["table"]);
    expect(mocks.rows.map(row => row.id)).toEqual(["latest", "old"]);
    await act(async () => { finishFirst(success()); await vi.advanceTimersByTimeAsync(800); });
    expect(mocks.rows[0].cells).toEqual({ band_10_30: "legacy", total: "10", band_10_20: "newer draft" });
  });

  it("scopes row deletion to its parent and preserves sibling drafts", async () => {
    mocks.rows.splice(1, 0, { id: "sibling", table_id: "table", label: "Altra riga", dates: {}, cells: { total: "originale" }, created_at: "2026-11-17T09:00:00Z" });
    await openTable();
    vi.useFakeTimers();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Volume TOT." })[1], { target: { value: "bozza sorella" } });
    await confirmDelete(screen.getAllByRole("button", { name: "Elimina riga" })[0]);
    expect(mocks.remove).toHaveBeenCalledWith("volume_table_rows", { id: "latest", table_id: "table" });
    expect(screen.getByDisplayValue("Altra riga")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(mocks.rows.find(row => row.id === "sibling")?.cells).toEqual({ total: "bozza sorella" });
  });

  it("keeps the table and pending draft if deletion is not confirmed by the database", async () => {
    await openTable();
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Volume 10%-20%" }), { target: { value: "keep me" } });
    mocks.remove.mockResolvedValueOnce({ data: null, error: null });
    await confirmDelete(screen.getByRole("button", { name: "Elimina tabella" }));
    expect(screen.getByDisplayValue("Trazioni")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Volume 10%-20%" })).toHaveValue("keep me");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Eliminazione non riuscita") }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(mocks.rows[0].cells).toEqual({ band_10_20: "keep me" });
  });
});
