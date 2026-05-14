import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { Recipe } from "./types";

async function elementToCanvas(element: HTMLElement) {
  return html2canvas(element, { backgroundColor: "#fffdf7", scale: 2, useCORS: true, allowTaint: false });
}

async function elementToPngBlob(element: HTMLElement) {
  const canvas = await elementToCanvas(element);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG generation failed"));
      }
    }, "image/png");
  });
}

async function elementToPdfBlob(element: HTMLElement) {
  const canvas = await elementToCanvas(element);
  const image = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  let position = 0;

  pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight);
  let remaining = imageHeight - pageHeight;
  while (remaining > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight);
    remaining -= pageHeight;
  }

  return pdf.output("blob");
}

export async function exportElementAsPng(element: HTMLElement, filename: string) {
  downloadBlob(await elementToPngBlob(element), filename);
}

export async function shareElementAsPng(element: HTMLElement, filename: string, recipeName: string, url: string) {
  const blob = await elementToPngBlob(element);
  const file = new File([blob], filename, { type: "image/png" });
  const shareData: ShareData = {
    title: recipeName,
    text: `Recette Toque: ${recipeName}\n${url}`,
    files: [file],
  };

  if (await tryShare(shareData)) {
    return "shared";
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

export async function exportElementAsPdf(element: HTMLElement, filename: string) {
  downloadBlob(await elementToPdfBlob(element), filename);
}

export function exportTextFile(text: string, filename: string) {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
}

export async function shareElementAsPdf(element: HTMLElement, filename: string, recipeName: string) {
  const blob = await elementToPdfBlob(element);
  const file = new File([blob], filename, { type: "application/pdf" });
  const shareData: ShareData = {
    title: recipeName,
    text: `Recette Toque: ${recipeName}`,
    files: [file],
  };

  if (await tryShare(shareData)) {
    return "shared";
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

export function recipeFileName(recipe: Recipe, extension: "pdf" | "png" | "json") {
  const slug = recipe.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "recette"}.${extension}`;
}

export function basicFileName(label: string, extension: "pdf" | "png" | "txt") {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "export"}.${extension}`;
}

async function tryShare(shareData: ShareData) {
  if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) return false;

  try {
    await navigator.share(shareData);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}
