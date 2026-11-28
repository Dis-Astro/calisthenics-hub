import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
type ColumnKey = "band_10_20" | "band_20_30" | "band_30_40" | "band_40_50" | "band_50_60" | "band_60_70" | "band_70_80" | "band_80_90" | "band_90_100" | "total"
  | "band_10_30" | "band_40_60" | "band_50_70" | "band_60_80";
type TextMap = Partial<Record<ColumnKey, string>>;

interface VolumeRow {
  id: string;
  table_id: string;
  label: string;
  cells: TextMap;
  created_at: string;
}

interface Column { key: ColumnKey; label: string; sub?: string; legacy?: boolean }

const COLUMNS: Column[] = [
  { key: "band_10_20", label: "10%-20%", sub: "(KG-BW)" },
  { key: "band_20_30", label: "20%-30%", sub: "(KG-BW)" },
  { key: "band_30_40", label: "30%-40%", sub: "(KG-BW)" },
  { key: "band_40_50", label: "40%-50%", sub: "(KG-BW)" },
  { key: "band_50_60", label: "50%-60%", sub: "(KG-BW)" },
  { key: "band_60_70", label: "60%-70%", sub: "(KG-BW)" },
  { key: "band_70_80", label: "70%-80%", sub: "(KG-BW)" },
  { key: "band_80_90", label: "80%-90%", sub: "(KG-BW)" },
  { key: "band_90_100", label: "90%-100%", sub: "(KG-BW)" },
  { key: "total", label: "TOT." },
];

const LEGACY_COLUMNS: Column[] = [
  { key: "band_10_30", label: "10%-30%", legacy: true, sub: "Fascia precedente · KG-BW" },
  { key: "band_40_60", label: "40%-60%", legacy: true, sub: "Fascia precedente · KG-BW" },
  { key: "band_50_70", label: "50%-70%", legacy: true, sub: "Fascia precedente · KG-BW" },
  { key: "band_60_80", label: "60%-80%", legacy: true, sub: "Fascia precedente · KG-BW" },
];

const columnLabel = (column: Column) => `Volume ${column.label}${column.legacy ? " (fascia precedente)" : ""}`;

const SAVE_DELAY_MS = 800;
const DEFAULT_LABEL = "VOLUME sett.";
const autoHeight = { fieldSizing: "content" } as CSSProperties;

const asTextMap = (value: unknown): TextMap =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as TextMap) : {};

const toRow = (r: DbRow): VolumeRow => ({
  id: r.id,
  table_id: r.table_id,
  label: r.label,
  cells: asTextMap(r.cells),
  created_at: r.created_at,
});

const dayOf = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");

type DeleteTarget = { kind: "table"; id: string } | { kind: "row"; id: string; tableId: string } | null;
interface SaveJob {
  table: DbTableName;
  id: string;
  scope: string;
  changes: Record<string, unknown>;
}

const messageOf = (error: unknown) => error && typeof error === "object" && "message" in error
  ? String(error.message) : "riprova";

interface Props {
  clientId: string;
  compact?: boolean;
  compactTarget?: HTMLElement | null;
  showFull?: boolean;
}

/**
 * Tabelle "Volume & Intensità" del coach, sempre attive sul cliente.
 * - "+" rosso in alto a destra: nuova tabella (es. Trazioni, Muscle up, Dip)
 * - "+ Riga" su ogni tabella: nuova riga vuota in cima
 * - cestino con conferma per tabelle e righe
 * - "Mostra precedenti": di default ogni tabella mostra solo l'ultima sessione di lavoro
 * Tutto si salva da solo mentre si scrive. I valori li scrive solo il coach.
 */
const VolumeIntensityTable = ({ clientId, compact = false, compactTarget = null, showFull = true }: Props) => {
  const instanceId = useId();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<VolumeTable[]>([]);
  const [rows, setRows] = useState<VolumeRow[]>([]);
  // Keep initially populated legacy columns available even while their values are cleared.
  const [legacyColumns, setLegacyColumns] = useState<Map<string, Column[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, number>>(new Map());
  const pending = useRef<Map<string, SaveJob>>(new Map());
  const inFlight = useRef<Map<string, Promise<void>>>(new Map());
  const deletingKeys = useRef<Set<string>>(new Set());

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
      .order("created_at", { ascending: false })
      .order("position", { ascending: false });
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
    setLegacyColumns(new Map(loadedTables.map(table => [table.id, LEGACY_COLUMNS.filter(column =>
      loadedRows.some(row => row.table_id === table.id && typeof row.cells[column.key] === "string" && row.cells[column.key]!.trim() !== ""),
    )])));
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Salvataggio automatico (debounce per singola tabella/riga) ───
  const flush = useCallback(async (key: string): Promise<void> => {
    if (deletingKeys.current.has(key)) return;
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
        const { data, error } = job.table === "volume_tables"
          ? await supabase.from("volume_tables").update(job.changes as Partial<VolumeTable>)
            .eq("id", job.id).eq("client_id", job.scope).select("id").single()
          : await supabase.from("volume_table_rows").update(job.changes as Partial<DbRow>)
            .eq("id", job.id).eq("table_id", job.scope).select("id").single();
        if (error) throw error;
        if (data?.id !== job.id) throw new Error("La modifica non è stata confermata dal database.");
        if (!pending.current.has(key)) setSaved(prev => new Set(prev).add(job.id));
      } catch (error) {
        const newer = pending.current.get(key);
        pending.current.set(key, { ...job, changes: { ...job.changes, ...newer?.changes } });
        setFailed(prev => new Set(prev).add(job.id));
        showError(`Salvataggio non riuscito: ${messageOf(error)}`);
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
    if (deletingKeys.current.has(key)) return;
    const scope = table === "volume_tables" ? clientId : rows.find(row => row.id === id)?.table_id;
    if (!scope) return;
    setSaved(prev => { const n = new Set(prev); n.delete(id); return n; });
    const prev = pending.current.get(key);
    pending.current.set(key, { table, id, scope, changes: { ...(prev?.changes ?? {}), ...changes } });
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

  // ─── Modifiche ───
  const updateTitle = (id: string, title: string) => {
    setTables(prev => prev.map(t => (t.id === id ? { ...t, title } : t)));
    schedule("volume_tables", id, { title });
  };

  const updateRowLabel = (id: string, label: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, label } : r)));
    schedule("volume_table_rows", id, { label });
  };

  const updateRowMap = (id: string, key: ColumnKey, value: string) => {
    const current = rows.find(r => r.id === id);
    if (!current) return;
    const cells: TextMap = { ...current.cells, [key]: value };
    setRows(prev => prev.map(r => (r.id === id ? { ...r, cells } : r)));
    schedule("volume_table_rows", id, { cells });
  };

  const insertRow = async (tableId: string): Promise<VolumeRow | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("volume_table_rows")
      .insert({ table_id: tableId, label: DEFAULT_LABEL, dates: {}, cells: {}, created_by: user.id })
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

  const addTable = async (viewId: string) => {
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
    setTables(prev => [data, ...prev]);
    if (firstRow) setRows(prev => [firstRow, ...prev]);
    window.setTimeout(() => document.getElementById(`${instanceId}-${viewId}-volume-title-${data.id}`)?.focus(), 50);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const tableId = target.kind === "table" ? target.id : target.tableId;
    if (!tables.some(table => table.id === tableId && table.client_id === clientId)) return;
    const keys = target.kind === "table"
      ? [`volume_tables:${target.id}`, ...rows.filter(row => row.table_id === target.id).map(row => `volume_table_rows:${row.id}`)]
      : [`volume_table_rows:${target.id}`];
    keys.forEach(key => {
      deletingKeys.current.add(key);
      const timer = timers.current.get(key);
      if (timer) window.clearTimeout(timer);
      timers.current.delete(key);
    });
    setDeleting(new Set(deletingKeys.current));
    let deleted = false;
    try {
      await Promise.all(keys.map(key => inFlight.current.get(key)));
      const { data, error } = target.kind === "table"
        ? await supabase.from("volume_tables").delete().eq("id", target.id).eq("client_id", clientId).select("id, client_id").single()
        : await supabase.from("volume_table_rows").delete().eq("id", target.id).eq("table_id", target.tableId).select("id, table_id").single();
      if (error) throw error;
      if (!data || data.id !== target.id || (target.kind === "table"
        ? !("client_id" in data) || data.client_id !== clientId
        : !("table_id" in data) || data.table_id !== target.tableId)) {
        throw new Error("L'eliminazione non è stata confermata dal database.");
      }
      deleted = true;
      keys.forEach(key => pending.current.delete(key));
      if (target.kind === "table") {
        setTables(prev => prev.filter(table => table.id !== target.id));
        setRows(prev => prev.filter(row => row.table_id !== target.id));
      } else {
        setRows(prev => prev.filter(row => row.id !== target.id || row.table_id !== target.tableId));
      }
    } catch (error) {
      showError(`Eliminazione non riuscita: ${messageOf(error)}`);
    } finally {
      keys.forEach(key => {
        deletingKeys.current.delete(key);
        if (!deleted && pending.current.has(key)) {
          timers.current.set(key, window.setTimeout(() => void flush(key), SAVE_DELAY_MS));
        }
      });
      setDeleting(new Set(deletingKeys.current));
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

  const renderView = (isCompact: boolean, viewId: string) => {
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
      <div className="min-w-0 space-y-4">
        {/* Barra superiore: storico + nuova tabella */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Switch id={`${instanceId}-${viewId}-volume-history`} checked={showHistory} onCheckedChange={setShowHistory} />
            <Label htmlFor={`${instanceId}-${viewId}-volume-history`} className="text-xs cursor-pointer">
              Mostra precedenti{!showHistory && hiddenTotal > 0 ? ` (${hiddenTotal} nascoste)` : ""}
            </Label>
          </div>
          <Button
            onClick={() => void addTable(viewId)}
            disabled={busy}
            size="icon"
            className={`${isCompact ? "h-8 w-8" : "h-10 w-10"} shrink-0 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md`}
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
          const columns = [...COLUMNS.slice(0, -1), ...(legacyColumns.get(table.id) ?? []), COLUMNS[COLUMNS.length - 1]];
          const tableDeleting = deleting.has(`volume_tables:${table.id}`);
          return (
            <div key={table.id} className="rounded-md border">
              {/* Testata tabella: nome, + riga, elimina tabella */}
              <div className={`flex items-center gap-2 border-b bg-muted px-2 py-1.5 ${isCompact ? "flex-wrap" : ""}`}>
                <Input
                  id={`${instanceId}-${viewId}-volume-title-${table.id}`}
                  disabled={tableDeleting}
                  value={table.title}
                  onChange={e => updateTitle(table.id, e.target.value)}
                  onBlur={() => flushNow("volume_tables", table.id)}
                  placeholder="Nome tabella e data (es. Trazioni 26/11)"
                  aria-label="Nome tabella"
                  className={`h-8 min-w-0 border-0 bg-transparent font-display tracking-wider text-sm shadow-none focus-visible:ring-1 ${isCompact ? "w-full" : "max-w-xs"}`}
                />
                {status(table.id)}
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => addRow(table.id)} disabled={busy || tableDeleting} className="h-7 gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" />Riga
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy || tableDeleting}
                    className="h-7 w-7 text-destructive"
                    onClick={() => setDeleteTarget({ kind: "table", id: table.id })}
                    aria-label="Elimina tabella"
                    title="Elimina tabella"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isCompact ? (
                <div className="divide-y-2">
                  {group.visible.map(row => (
                    <div key={row.id} className="min-w-0">
                      <div className="flex items-start gap-1 border-b px-2 py-1">
                        <div className="min-w-0 flex-1">
                          <Textarea
                            disabled={tableDeleting || deleting.has(`volume_table_rows:${row.id}`)}
                            value={row.label}
                            aria-label="Etichetta volume"
                            onChange={e => updateRowLabel(row.id, e.target.value)}
                            onBlur={() => flushNow("volume_table_rows", row.id)}
                            className="min-h-8 resize-none border-0 bg-transparent p-1 font-display text-xs tracking-wider text-red-600 shadow-none focus-visible:ring-1"
                            style={autoHeight}
                          />
                          <div className="px-1">{status(row.id)}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive"
                          disabled={busy || tableDeleting || deleting.has(`volume_table_rows:${row.id}`)}
                          onClick={() => setDeleteTarget({ kind: "row", id: row.id, tableId: table.id })}
                          aria-label="Elimina riga" title="Elimina riga">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {columns.map(col => (
                        <div key={col.key} className="min-w-0 border-b p-2 last:border-b-0">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div>
                              <span className="font-display text-xs tracking-wide text-red-600">{col.label}</span>
                              {col.sub && <div className="text-[10px] text-muted-foreground">{col.sub}</div>}
                            </div>
                          </div>
                          <Textarea
                            disabled={tableDeleting || deleting.has(`volume_table_rows:${row.id}`)}
                            value={row.cells[col.key] ?? ""}
                            aria-label={columnLabel(col)}
                            onChange={e => updateRowMap(row.id, col.key, e.target.value)}
                            onBlur={() => flushNow("volume_table_rows", row.id)}
                            placeholder="—"
                            className="mt-1 min-h-12 min-w-0 resize-y px-2 py-1 text-xs leading-snug shadow-none"
                            style={autoHeight}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="w-[130px] border-b border-r px-2 py-2 text-left font-display tracking-wider text-red-600">
                        INTENSITÀ
                      </th>
                      {columns.map(col => (
                        <th key={col.key} className="border-b border-r px-2 py-2 text-left last:border-r-0">
                          <div className="font-display tracking-wider text-red-600">{col.label}</div>
                          {col.sub && <div className="text-[10px] font-normal text-muted-foreground">{col.sub}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {group.visible.map(row => (
                    <tbody key={row.id} className="border-b-2 last:border-b-0">
                      {/* VOLUME sett. (etichetta modificabile) */}
                      <tr className="align-top">
                        <td className="border-r px-1 py-1">
                          <Textarea
                            disabled={tableDeleting || deleting.has(`volume_table_rows:${row.id}`)}
                            value={row.label}
                            aria-label="Etichetta volume"
                            onChange={e => updateRowLabel(row.id, e.target.value)}
                            onBlur={() => flushNow("volume_table_rows", row.id)}
                            className="min-h-[40px] resize-none border-0 bg-transparent p-1 font-display text-xs tracking-wider text-red-600 shadow-none focus-visible:ring-1"
                            style={autoHeight}
                          />
                          <div className="px-1">{status(row.id)}</div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                            disabled={busy || tableDeleting || deleting.has(`volume_table_rows:${row.id}`)}
                            onClick={() => setDeleteTarget({ kind: "row", id: row.id, tableId: table.id })}
                            aria-label="Elimina riga" title="Elimina riga">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                        {columns.map(col => (
                          <td key={col.key} className="border-r p-1 last:border-r-0">
                            <Textarea
                              disabled={tableDeleting || deleting.has(`volume_table_rows:${row.id}`)}
                              value={row.cells[col.key] ?? ""}
                              aria-label={columnLabel(col)}
                              onChange={e => updateRowMap(row.id, col.key, e.target.value)}
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
              )}

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

      </div>
    );
  };

  return <>
      {showFull && renderView(compact, "main")}
      {compactTarget && createPortal(renderView(true, "compact"), compactTarget)}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "table" ? "Eliminare questa tabella?" : "Eliminare questa riga?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "table"
                ? "Verranno cancellate la tabella e tutte le sue righe. L'operazione non si può annullare."
                : "La riga verrà cancellata. L'operazione non si può annullare."}
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
    </>;
};

export default VolumeIntensityTable;
