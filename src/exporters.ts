import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { Recipe } from "./types";

export async function exportElementAsPng(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, { backgroundColor: "#fffdf7", scale: 2, useCORS: true, allowTaint: false });
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function exportElementAsPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, { backgroundColor: "#fffdf7", scale: 2, useCORS: true, allowTaint: false });
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
  pdf.save(filename);
}

export function recipeFileName(recipe: Recipe, extension: "pdf" | "png") {
  const slug = recipe.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "recette"}.${extension}`;
}
