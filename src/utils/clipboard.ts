/** Copy from an explicit user action, with a fallback for older mobile browsers. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard access can be unavailable in installed apps or embedded browsers.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-10000px";
  const focused = document.activeElement;
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Copy failed");
  } finally {
    textarea.remove();
    if (focused instanceof HTMLElement) focused.focus();
  }
}
