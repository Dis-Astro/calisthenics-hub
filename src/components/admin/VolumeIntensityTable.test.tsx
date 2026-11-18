import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VolumeIntensityTable from "./VolumeIntensityTable";

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), loadError: null as { code: string; message: string } | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "coach" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "volume_tables"
        ? [{ id: "table", title: "Trazioni", position: 0 }]
        : [
          { id: "latest", table_id: "table", label: "Questa settimana", dates: {}, cells: {}, created_at: "2026-11-17T10:00:00Z" },
          { id: "old", table_id: "table", label: "Settimana precedente", dates: {}, cells: {}, created_at: "2026-11-10T10:00:00Z" },
        ];
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        then: (resolve: (value: unknown) => void) => Promise.resolve({ data: mocks.loadError ? null : result, error: mocks.loadError }).then(resolve),
        update: (changes: unknown) => ({ eq: (field: string, id: string) => mocks.save(table, id, changes) }),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue({ error: null });
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

describe("VolumeIntensityTable", () => {
  it("blocks creation when the database tables are missing and supports reloading after activation", async () => {
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

  it("serializes saves so a slow request cannot overwrite newer edits", async () => {
    await openTable();
    vi.useFakeTimers();
    let finishFirst!: (value: { error: null }) => void;
    mocks.save.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    const cell = screen.getByRole("textbox", { name: "Volume 10%-30%" });
    fireEvent.change(cell, { target: { value: "4x3" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    fireEvent.change(cell, { target: { value: "5x3" } });
    fireEvent.blur(cell);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ error: null }); });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1]).toEqual([
      "volume_table_rows", "latest", { cells: { band_10_30: "5x3" } },
    ]);
  });

  it("keeps a failed edit and retries it together with the next change", async () => {
    await openTable();
    vi.useFakeTimers();
    mocks.save.mockResolvedValueOnce({ error: { message: "Offline" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Volume 10%-30%" }), { target: { value: "4x3" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(screen.getByRole("button", { name: /Non salvato/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Volume TOT." }), { target: { value: "12 ripetizioni" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Riprova/ })); });
    expect(mocks.save.mock.calls[1]).toEqual([
      "volume_table_rows", "latest", { cells: { band_10_30: "4x3", total: "12 ripetizioni" } },
    ]);
    expect(screen.queryByRole("button", { name: /Non salvato/ })).not.toBeInTheDocument();
  });
});
