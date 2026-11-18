import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type VolumeTable = Tables<"volume_tables">;
type DbRow = Tables<"volume_table_rows">;
type DbTableName = "volume_tables" | "volume_table_rows";
type ColumnKey = "band_10_30" | "band_40_60" | "band_50_70" | "band_60_80" | "band_90_100" | "total";
type TextMap = Partial<Record<ColumnKey, string>>;

interface VolumeRow {
  id: string;
  table_id: string;
  label: string;
  dates: TextMap;
  cells: TextMap;
  created_at: string;
}

const COLUMNS: { key: ColumnKey; label: string; sub?: string }[] = [
  { key: "band_10_30", label: "10%-30%", sub: "(KG-BW)" },
  { key: "band_40_60", label: "40%-60%", sub: "(KG-BW)" },
  { key: "band_50_70", label: "50%-70%", sub: "(KG-BW)" },
  { key: "band_60_80", label: "60%-80%", sub: "(KG-BW)" },
  { key: "band_90_100", label: "90%-100%", sub: "(KG-BW)" },
  { key: "total", label: "TOT." },
];

const SAVE_DELAY_MS = 800;
const DEFAULT_LABEL = "VOLUME sett.";
const autoHeight = { fieldSizing: "content" } as CSSProperties;

const asTextMap = (value: unknown): TextMap =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as TextMap) : {};

const toRow = (r: DbRow): VolumeRow => ({
  id: r.id,
  table_id: r.table_id,
  label: r.label,
  dates: asTextMap(r.dates),
  cells: asTextMap(r.cells),
  created_at: r.created_at,
});

const todayDates = (): TextMap => {
  const today = format(new Date(), "yyyy-MM-dd");
  return Object.fromEntries(COLUMNS.map(c => [c.key, today])) as TextMap;
};

const dayOf = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");

type DeleteTarget = { kind: "table" | "row"; id: string } | null;

interface Props {
  clientId: string;
}

/**
 * Tabelle "Volume & Intensità" del coach, sempre attive sul cliente.
 * - "+" rosso in alto a destra: nuova tabella (es. Trazioni, Muscle up, Dip)
 * - "+ Riga" su ogni tabella: nuova riga in cima, con le date già impostate a oggi
 * - cestino con conferma per tabelle e righe
 * - "Mostra precedenti": di default ogni tabella mostra solo l'ultima sessione di lavoro
 * Tutto si salva da solo mentre si scrive. I valori li scrive solo il coach.
 */
const VolumeIntensityTable = ({ clientId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<VolumeTable[]>([]);
  const [rows, setRows] = useState<VolumeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const timers = useRef<Map<string, number>>(new Map());
  const pending = useRef<Map<string, { table: DbTableName; id: string; changes: Record<string, unknown> }>>(new Map());
  const inFlight = useRef<Map<string, Promise<void>>>(new Map());

  const showError = useCallback(
    (description: string) => toast({ title: "Errore", description, variant: "destructive" }),
    [toast],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: tableData, error: tableError } = await supabase
      .from("volume_tables")
      .select("*")
      .eq("client_id", clientId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (tableError) {
      setLoadError(tableError.code === "PGRST205"
        ? "Le tabelle Volume & Intensità non sono ancora disponibili nel database. L'amministratore deve completare l'attivazione del database collegato al sito."
        : "Impossibile caricare le tabelle Volume & Intensità. Riprova tra poco.");
      setLoading(false);
      return;
    }
    const loadedTables = tableData ?? [];
    let loadedRows: VolumeRow[] = [];
    if (loadedTables.length > 0) {
      const { data: rowData, error: rowError } = await supabase
        .from("volume_table_rows")
        .select("*")
        .in("table_id", loadedTables.map(t => t.id))
        .order("created_at", { ascending: false });
      if (rowError) {
        setLoadError(rowError.code === "PGRST205"
          ? "L'attivazione di Volume & Intensità nel database è incompleta: manca l'archivio delle righe."
          : "Impossibile caricare le righe delle tabelle. Riprova tra poco.");
        setLoading(false);
        return;
      }
      loadedRows = (rowData ?? []).map(toRow);
    }
    setTables(loadedTables);
    setRows(loadedRows);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Salvataggio automatico (debounce per singola tabella/riga) ───
  const flush = useCallback(async (key: string) => {
    const active = inFlight.current.get(key);
    if (active) {
      await active;
      return flush(key);
    }
    const job = pending.current.get(key);
    const timer = timers.current.get(key);
    if (timer) window.clearTimeout(timer);
    pending.current.delete(key);
    timers.current.delete(key);
    if (!job) return;
    setFailed(prev => { const n = new Set(prev); n.delete(job.id); return n; });
    setSaved(prev => { const n = new Set(prev); n.delete(job.id); return n; });
    setSaving(prev => new Set(prev).add(job.id));
    const request = (async () => {
      try {
        const { error } = job.table === "volume_tables"
          ? await supabase.from("volume_tables").update(job.changes as Partial<VolumeTable>).eq("id", job.id)
          : await supabase.from("volume_table_rows").update(job.changes as Partial<DbRow>).eq("id", job.id);
        if (error) throw error;
        if (!pending.current.has(key)) setSaved(prev => new Set(prev).add(job.id));
      } catch (error) {
        const newer = pending.current.get(key);
        pending.current.set(key, { ...job, changes: { ...job.changes, ...newer?.changes } });
        setFailed(prev => new Set(prev).add(job.id));
        showError(`Salvataggio non riuscito: ${error instanceof Error ? error.message : "riprova"}`);
      } finally {
        setSaving(prev => { const n = new Set(prev); n.delete(job.id); return n; });
      }
    })();
    inFlight.current.set(key, request);
    await request;
    inFlight.current.delete(key);
  }, [showError]);

  // Allo smontaggio tenta anche il salvataggio delle modifiche fallite.
  useEffect(() => {
    const t = timers.current;
    const jobs = pending.current;
    return () => {
      t.forEach(handle => window.clearTimeout(handle));
      jobs.forEach((_, key) => { void flush(key); });
    };
  }, [flush]);

  const schedule = (table: DbTableName, id: string, changes: Record<string, unknown>) => {
    const key = `${table}:${id}`;
    setSaved(prev => { const n = new Set(prev); n.delete(id); return n; });
    const prev = pending.current.get(key);
    pending.current.set(key, { table, id, changes: { ...(prev?.changes ?? {}), ...changes } });
    const existing = timers.current.get(key);
    if (existing) window.clearTimeout(existing);
    timers.current.set(key, window.setTimeout(() => flush(key), SAVE_DELAY_MS));
  };

  const flushNow = (table: DbTableName, id: string) => {
    const key = `${table}:${id}`;
    const existing = timers.current.get(key);
    if (existing) window.clearTimeout(existing);
    flush(key);
  };

  const dropPending = async (table: DbTableName, id: string) => {
    const key = `${table}:${id}`;
    const existing = timers.current.get(key);
    if (existing) window.clearTimeout(existing);
    await inFlight.current.get(key);
    timers.current.delete(key);
    pending.current.delete(key);
  };

  // ─── Modifiche ───
  const updateTitle = (id: string, title: string) => {
    setTables(prev => prev.map(t => (t.id === id ? { ...t, title } : t)));
    schedule("volume_tables", id, { title });
  };

  const updateRowLabel = (id: string, label: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, label } : r)));
    schedule("volume_table_rows", id, { label });
  };

  const updateRowMap = (id: string, field: "dates" | "cells", key: ColumnKey, value: string) => {
    const current = rows.find(r => r.id === id);
    if (!current) return;
    const nextMap: TextMap = { ...current[field], [key]: value };
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: nextMap } : r)));
    schedule("volume_table_rows", id, { [field]: nextMap });
  };

  const insertRow = async (tableId: string): Promise<VolumeRow | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("volume_table_rows")
      .insert({ table_id: tableId, label: DEFAULT_LABEL, dates: todayDates(), cells: {}, created_by: user.id })
      .select("*")
      .single();
    if (error || !data) {
      showError(error?.message ?? "Impossibile aggiungere la riga");
      return null;
    }
    return toRow(data);
  };

  const addRow = async (tableId: string) => {
    setBusy(true);
    const row = await insertRow(tableId);
    setBusy(false);
    if (row) setRows(prev => [row, ...prev]);
  };

  const addTable = async () => {
    if (!user) return;
    setBusy(true);
    const nextPosition = tables.length ? Math.max(...tables.map(t => t.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("volume_tables")
      .insert({ client_id: clientId, title: "", position: nextPosition, created_by: user.id })
      .select("*")
      .single();
    if (error || !data) {
      setBusy(false);
      showError(error?.message ?? "Impossibile creare la tabella");
      return;
    }
    const firstRow = await insertRow(data.id);
    setBusy(false);
    setTables(prev => [...prev, data]);
    if (firstRow) setRows(prev => [firstRow, ...prev]);
    window.setTimeout(() => document.getElementById(`volume-title-${data.id}`)?.focus(), 50);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target.kind === "table") {
      await dropPending("volume_tables", target.id);
      await Promise.all(rows.filter(r => r.table_id === target.id).map(r => dropPending("volume_table_rows", r.id)));
      const { error } = await supabase.from("volume_tables").delete().eq("id", target.id);
      if (error) return showError(error.message);
      setTables(prev => prev.filter(t => t.id !== target.id));
      setRows(prev => prev.filter(r => r.table_id !== target.id));
    } else {
      await dropPending("volume_table_rows", target.id);
      const { error } = await supabase.from("volume_table_rows").delete().eq("id", target.id);
      if (error) return showError(error.message);
      setRows(prev => prev.filter(r => r.id !== target.id));
    }
  };

  // ─── Righe visibili: di default solo l'ultima sessione (stesso giorno della riga più recente) ───
  const rowsByTable = useMemo(() => {
    const map = new Map<string, { visible: VolumeRow[]; hidden: number }>();
    tables.forEach(t => {
      const all = rows.filter(r => r.table_id === t.id);
      if (showHistory || all.length === 0) {
        map.set(t.id, { visible: all, hidden: 0 });
        return;
      }
      const latestDay = dayOf(all[0].created_at);
      const visible = all.filter(r => dayOf(r.created_at) === latestDay);
      map.set(t.id, { visible, hidden: all.length - visible.length });
    });
    return map;
  }, [tables, rows, showHistory]);

  const hiddenTotal = useMemo(
    () => Array.from(rowsByTable.values()).reduce((sum, v) => sum + v.hidden, 0),
    [rowsByTable],
  );

  const status = (id: string) =>
    saving.has(id) ? (
      <span className="flex items-center text-[10px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin mr-1" />Salvo…</span>
    ) : failed.has(id) ? (
      <button type="button" className="text-xs text-destructive" onClick={() => {
        const table = tables.some(t => t.id === id) ? "volume_tables" : "volume_table_rows";
        flushNow(table, id);
      }}>Non salvato · Riprova</button>
    ) : saved.has(id) ? (
      <span className="flex items-center text-[10px] text-muted-foreground"><Check className="w-3 h-3 mr-1 text-green-500" />Salvato</span>
    ) : null;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (loadError) {
    return (
      <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm">{loadError}</p>
        <Button variant="outline" onClick={() => void load()}>Riprova</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra superiore: storico + nuova tabella */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="volume-history" checked={showHistory} onCheckedChange={setShowHistory} />
          <Label htmlFor="volume-history" className="text-xs cursor-pointer">
            Mostra precedenti{!showHistory && hiddenTotal > 0 ? ` (${hiddenTotal} nascoste)` : ""}
          </Label>
        </div>
        <Button
          onClick={addTable}
          disabled={busy}
          size="icon"
          className="h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md"
          aria-label="Nuova tabella"
          title="Nuova tabella"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
        </Button>
      </div>

      {tables.length === 0 && (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nessuna tabella. Premi il <span className="font-semibold text-red-600">+</span> rosso per crearne una
          (es. Trazioni, Muscle up, Dip).
        </div>
      )}

      {tables.map(table => {
        const group = rowsByTable.get(table.id) ?? { visible: [], hidden: 0 };
        return (
          <div key={table.id} className="rounded-md border">
            {/* Testata tabella: nome, + riga, elimina tabella */}
            <div className="flex items-center gap-2 border-b bg-muted px-2 py-1.5">
              <Input
                id={`volume-title-${table.id}`}
                value={table.title}
                onChange={e => updateTitle(table.id, e.target.value)}
                onBlur={() => flushNow("volume_tables", table.id)}
                placeholder="Nome tabella (es. Trazioni)"
                aria-label="Nome tabella"
                className="h-8 max-w-xs border-0 bg-transparent font-display tracking-wider text-sm shadow-none focus-visible:ring-1"
              />
              {status(table.id)}
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => addRow(table.id)} disabled={busy} className="h-7 gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" />Riga
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => setDeleteTarget({ kind: "table", id: table.id })}
                  aria-label="Elimina tabella"
                  title="Elimina tabella"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-[130px] border-b border-r px-2 py-2 text-left font-display tracking-wider text-red-600">
                      INTENSITÀ
                    </th>
                    {COLUMNS.map(col => (
                      <th key={col.key} className="border-b border-r px-2 py-2 text-left last:border-r-0">
                        <div className="font-display tracking-wider text-red-600">{col.label}</div>
                        {col.sub && <div className="text-[10px] font-normal text-muted-foreground">{col.sub}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                {group.visible.map(row => (
                  <tbody key={row.id} className="border-b-2 last:border-b-0">
                    {/* DATA */}
                    <tr>
                      <td className="border-b border-r px-2 py-1 font-display text-xs tracking-wider text-red-600">
                        <div className="flex items-center justify-between">
                          DATA
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => setDeleteTarget({ kind: "row", id: row.id })}
                            aria-label="Elimina riga"
                            title="Elimina riga"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                      {COLUMNS.map(col => (
                        <td key={col.key} className="border-b border-r p-1 last:border-r-0">
                          <Input
                            type="date"
                            aria-label={`Data ${col.label}`}
                            value={row.dates[col.key] ?? ""}
                            onChange={e => updateRowMap(row.id, "dates", col.key, e.target.value)}
                            onBlur={() => flushNow("volume_table_rows", row.id)}
                            className="h-7 border-0 bg-transparent px-1 text-xs font-semibold shadow-none focus-visible:ring-1"
                          />
                        </td>
                      ))}
                    </tr>
                    {/* VOLUME sett. (etichetta modificabile) */}
                    <tr className="align-top">
                      <td className="border-r px-1 py-1">
                        <Textarea
                          value={row.label}
                          aria-label="Etichetta volume"
                          onChange={e => updateRowLabel(row.id, e.target.value)}
                          onBlur={() => flushNow("volume_table_rows", row.id)}
                          className="min-h-[40px] resize-none border-0 bg-transparent p-1 font-display text-xs tracking-wider text-red-600 shadow-none focus-visible:ring-1"
                          style={autoHeight}
                        />
                        <div className="px-1">{status(row.id)}</div>
                      </td>
                      {COLUMNS.map(col => (
                        <td key={col.key} className="border-r p-1 last:border-r-0">
                          <Textarea
                            value={row.cells[col.key] ?? ""}
                            aria-label={`Volume ${col.label}`}
                            onChange={e => updateRowMap(row.id, "cells", col.key, e.target.value)}
                            onBlur={() => flushNow("volume_table_rows", row.id)}
                            placeholder="—"
                            className="min-h-[100px] resize-y border-0 bg-transparent p-1.5 text-xs leading-snug shadow-none focus-visible:ring-1"
                            style={autoHeight}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                ))}
              </table>
            </div>

            {group.hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="w-full border-t px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted"
              >
                {group.hidden} {group.hidden === 1 ? "riga precedente nascosta" : "righe precedenti nascoste"} — mostra
              </button>
            )}
          </div>
        );
      })}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "table" ? "Eliminare questa tabella?" : "Eliminare questa riga?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "table"
                ? "Verranno cancellate la tabella e tutte le sue righe. L'operazione non si può annullare."
                : "Date e testi della riga verranno cancellati. L'operazione non si può annullare."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VolumeIntensityTable;
