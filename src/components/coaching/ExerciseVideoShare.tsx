import { useRef, useState } from "react";
import { Copy, Film, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { canShareVideoFiles, formatFileSize } from "@/lib/exerciseVideoShare";

interface ExerciseVideoShareProps {
  /** Testo inviato insieme ai video: il nome dell'esercizio. */
  shareText: string;
  className?: string;
}

const ExerciseVideoShare = ({ shareText, className }: ExerciseVideoShareProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sharing, setSharing] = useState(false);

  const pickVideos = () => {
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  };

  const onFilesSelected = (list: FileList | null) => {
    // Selezione annullata: si tiene la scelta precedente.
    if (!list || list.length === 0) return;
    const videos = Array.from(list).filter((file) => file.type.startsWith("video/") || file.type === "");
    if (videos.length === 0) {
      toast.error("Seleziona file video");
      return;
    }
    setFiles(videos);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Testo copiato: incollalo nel messaggio al coach");
    } catch {
      toast.error("Copia non riuscita: seleziona il testo e copialo a mano");
    }
  };

  // Il menu di condivisione va aperto direttamente dal tocco su "Invia": i browser
  // lo bloccano se prima si attende un'altra operazione asincrona.
  const share = async () => {
    if (!canShareVideoFiles(files)) {
      toast.error("Questo browser non può inviare video. Apri la webapp da Chrome (Android) o Safari (iPhone).");
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ files, text: shareText });
      toast.success(files.length > 1 ? "Video inviati" : "Video inviato");
      setFiles([]);
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === "AbortError") return; // L'utente ha chiuso il menu: nessun errore.
      toast.error("Invio non riuscito. Riprova o copia il testo e allega il video da Telegram.");
    } finally {
      setSharing(false);
    }
  };

  const removeFile = (index: number) => setFiles((current) => current.filter((_, i) => i !== index));
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        data-testid="exercise-video-input"
        onChange={(event) => onFilesSelected(event.target.files)}
      />
      <Button type="button" variant="outline" size="sm" className={cn("h-10 gap-2 rounded-xl", className)} onClick={pickVideos}>
        <Send className="h-4 w-4" />
        Invia video
      </Button>

      <Dialog open={files.length > 0} onOpenChange={(open) => { if (!open && !sharing) setFiles([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invia {files.length > 1 ? `${files.length} video` : "il video"} al coach</DialogTitle>
            <DialogDescription>
              Tocca Invia, scegli Telegram e la chat del coach: il nome dell'esercizio è già incluso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <pre className="whitespace-pre-wrap break-words rounded-xl border bg-muted/40 p-3 font-sans text-sm">{shareText}</pre>

            <ul className="space-y-2" aria-label="Video selezionati">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border p-2">
                  <Film className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label={`Rimuovi ${file.name}`}
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            {files.length > 1 && (
              <p className="text-xs text-muted-foreground">Totale {formatFileSize(totalSize)}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => void copyText()}>
              <Copy className="h-4 w-4" />
              Copia testo
            </Button>
            <Button type="button" variant="outline" onClick={pickVideos} disabled={sharing}>
              Cambia video
            </Button>
            <Button type="button" className="gap-2" onClick={() => void share()} disabled={sharing}>
              <Send className="h-4 w-4" />
              Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExerciseVideoShare;
