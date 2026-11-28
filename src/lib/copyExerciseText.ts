/** Both clipboard methods start in the click gesture, including the fallback. */
export async function copyExerciseText(text: string): Promise<boolean> {
  let clipboardResult = Promise.resolve(false);
  try {
    if (navigator.clipboard?.writeText) {
      clipboardResult = navigator.clipboard.writeText(text).then(() => true, () => false);
    }
  } catch {
    // Some embedded browsers expose the API but reject access synchronously.
  }

  const focused = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const inputSelection = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
    ? { start: focused.selectionStart, end: focused.selectionEnd, direction: focused.selectionDirection }
    : null;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.setAttribute("aria-hidden", "true");
  field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
  let fallbackCopied = false;
  try {
    document.body.append(field);
    field.select();
    fallbackCopied = document.execCommand?.("copy") ?? false;
  } catch {
    // Report failure only if neither method succeeds.
  } finally {
    field.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
    if (inputSelection && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)
      && inputSelection.start !== null && inputSelection.end !== null) {
      focused.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction ?? undefined);
    } else if (selection) {
      selection.removeAllRanges();
      ranges.forEach(range => selection.addRange(range));
    }
  }

  return (await clipboardResult) || fallbackCopied;
}
