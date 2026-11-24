/** Testo che accompagna i video: solo l'esercizio, così il coach sa cosa sta guardando. */
export function buildExerciseShareText(exerciseName: string | null): string {
  return exerciseName?.trim() || "Video esercizio";
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** True quando il browser può aprire il menu di condivisione con questi file allegati. */
export function canShareVideoFiles(files: File[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}
