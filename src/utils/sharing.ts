import { copyText } from "./clipboard";

export function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  // Leave the browser time to start reading the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function shareText(text: string, filename: string, title: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && text.length <= 1_800) {
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    return "sms" as const;
  }
  try {
    await copyText(text);
    return "copied" as const;
  } catch {
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
    return "downloaded" as const;
  }
}
