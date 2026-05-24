import type { Dispatch, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import { FileDown, FileImage, MessageSquareText, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react";
import { basicFileName, shareElementAsPdf, shareElementAsPng } from "../exporters";
import { t } from "../i18n";
import type { Recipe, ShoppingItem } from "../types";
import { normalizeText } from "../utils/text";

type Props = {
  recipes: Recipe[];
  selectedRecipeIds: string[];
  items: ShoppingItem[];
  onAddItem: () => void;
  onGenerate: () => void;
  onItemChange: Dispatch<SetStateAction<ShoppingItem[]>>;
  onSelectionChange: Dispatch<SetStateAction<string[]>>;
  onStatus: (message: string) => void;
};

export function ShoppingScreen({ recipes, selectedRecipeIds, items, onAddItem, onGenerate, onItemChange, onSelectionChange, onStatus }: Props) {
  const [recipeQuery, setRecipeQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

  const normalizedRecipeQuery = normalizeText(recipeQuery);
  const normalizedItemQuery = normalizeText(itemQuery);

  const visibleRecipes = useMemo(() =>
    normalizedRecipeQuery
      ? recipes.filter((recipe) => normalizeText([recipe.name, recipe.origin, ...recipe.tags].filter(Boolean).join(" ")).includes(normalizedRecipeQuery))
      : recipes,
  [normalizedRecipeQuery, recipes]);

  const visibleItems = useMemo(() => normalizedItemQuery ? items.filter((item) => normalizeText(item.label).includes(normalizedItemQuery)) : items, [items, normalizedItemQuery]);
  const selectedRecipes = useMemo(() => recipes.filter((recipe) => selectedRecipeIds.includes(recipe.id)), [recipes, selectedRecipeIds]);
  const exportDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
  const exportFilename = basicFileName("liste de courses", "png").replace(".png", "");
  const canExport = items.length > 0;

  async function handleShareText() {
    if (!canExport) return;
    try {
      const result = await shareShoppingListText(formatShoppingListText(items, selectedRecipes, exportDate));
      if (result === "copied") onStatus("Texte de la liste de courses copie.");
      if (result === "sms") onStatus("Ouverture de l'app SMS.");
      if (result === "manual") onStatus("Texte pret a copier.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onStatus("Le partage texte n'a pas abouti.");
    }
  }

  async function handleShareImage() {
    if (!exportRef.current || !canExport) return;
    try {
      const result = await shareElementAsPng(exportRef.current, `${exportFilename}.png`, "Liste de courses", "Liste de courses Toque");
      if (result === "downloaded") onStatus("PNG telecharge. Le partage natif n'est pas disponible sur cet appareil.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onStatus("Le partage n'a pas abouti.");
    }
  }

  async function handleSharePdf() {
    if (!exportRef.current || !canExport) return;
    try {
      const result = await shareElementAsPdf(exportRef.current, `${exportFilename}.pdf`, "Liste de courses", "Liste de courses Toque");
      if (result === "downloaded") onStatus("PDF telecharge. Le partage natif n'est pas disponible sur cet appareil.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onStatus("Le partage PDF n'a pas abouti.");
    }
  }

  return (
    <section className="panel workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("shopping.eyebrow")}</span>
          <h2>{t("shopping.title")}</h2>
        </div>
        <div className="action-bar">
          <button className="button button--icon-mobile" onClick={handleSharePdf} disabled={!canExport} title="Exporter en PDF"><FileDown size={18} /> {t("shopping.action.pdf")}</button>
          <button className="button button--icon-mobile" onClick={handleShareImage} disabled={!canExport} title="Partager ou telecharger le PNG"><FileImage size={18} /> {t("shopping.action.png")}</button>
          <button className="button button--primary button--icon-mobile" onClick={handleShareText} disabled={!canExport} title="Partager par SMS"><MessageSquareText size={18} /> {t("shopping.action.sms")}</button>
          <button className="button button--icon-mobile" onClick={onGenerate}><ShoppingBasket size={18} /> {t("shopping.action.generate")}</button>
        </div>
      </div>

      <div className="layout layout--split">
        <div className="stack">
          <label className="search-field"><span className="label-with-icon"><Search size={16} /> Rechercher une recette</span><input aria-label="Rechercher une recette pour la liste de courses" placeholder="Nom, origine, tag..." type="search" value={recipeQuery} onChange={(event) => setRecipeQuery(event.target.value)} /></label>
          <span className="muted count-label">{visibleRecipes.length} / {recipes.length} recettes</span>
          {visibleRecipes.map((recipe) => (
            <label key={recipe.id} className="check-control">
              <input checked={selectedRecipeIds.includes(recipe.id)} onChange={(event) => onSelectionChange((ids) => event.target.checked ? [...ids, recipe.id] : ids.filter((id) => id !== recipe.id))} type="checkbox" />
              {recipe.name}
            </label>
          ))}
          {visibleRecipes.length === 0 && <p className="empty-inline">Aucune recette ne correspond.</p>}
        </div>

        <div className="stack">
          <label className="search-field"><span className="label-with-icon"><Search size={16} /> Rechercher dans la liste</span><input aria-label="Rechercher une ligne de course" placeholder="Ingrédient..." type="search" value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} /></label>
          <span className="muted count-label">{visibleItems.length} / {items.length} lignes</span>
          {visibleItems.map((item) => (
            <div key={item.id} className={item.checked ? "shopping-item shopping-item--done" : "shopping-item"}>
              <input
                aria-label={`Cocher ${item.label}`}
                checked={item.checked}
                onChange={(event) =>
                  onItemChange((current) =>
                    current.map((candidate) => (candidate.id === item.id ? { ...candidate, checked: event.target.checked } : candidate)),
                  )
                }
                type="checkbox"
              />
              <input
                aria-label="Ligne de course"
                value={item.label}
                onChange={(event) =>
                  onItemChange((current) =>
                    current.map((candidate) => (candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate)),
                  )
                }
              />
              {item.pantry && <span className="chip chip--pantry">Placard</span>}
              <button
                className="button button--icon button--danger shopping-item__delete"
                type="button"
                title="Supprimer cette ligne"
                aria-label={`Supprimer ${item.label}`}
                onClick={() => onItemChange((current) => current.filter((candidate) => candidate.id !== item.id))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {items.length > 0 && visibleItems.length === 0 && <p className="empty-inline">Aucune ligne ne correspond.</p>}
          <button className="button button--ghost button--full button--icon-mobile" onClick={onAddItem}><Plus size={18} /> {t("shopping.action.addLine")}</button>
        </div>
      </div>

      <div className="shopping-export-canvas" aria-hidden="true">
        <div className="shopping-export-sheet" ref={exportRef}>
          <div className="shopping-export-sheet__header"><span className="eyebrow">{exportDate}</span><h2>{t("shopping.eyebrow")}</h2></div>
          {selectedRecipes.length > 0 && <div className="shopping-export-sheet__recipes"><h3>Recettes</h3><p>{selectedRecipes.map((recipe) => recipe.name).join(", ")}</p></div>}
          <div className="shopping-export-sheet__items">{items.map((item) => (
            <div key={item.id} className="shopping-export-row"><span className="shopping-export-row__check">{item.checked ? "x" : ""}</span><span className={item.checked ? "shopping-export-row__label shopping-export-row__label--done" : "shopping-export-row__label"}>{item.label}</span>{item.pantry && <span className="chip chip--pantry">Placard</span>}</div>
          ))}</div>
        </div>
      </div>
    </section>
  );
}

function formatShoppingListText(items: ShoppingItem[], recipes: Recipe[], exportDate: string) {
  const lines = ["Liste de courses", exportDate, ""];
  if (recipes.length > 0) lines.push("Recettes:", ...recipes.map((recipe) => `- ${recipe.name}`), "");
  lines.push("Courses:");
  items.forEach((item) => lines.push(`${item.checked ? "[x]" : "[ ]"} ${item.label}${item.pantry ? " (Placard)" : ""}`));
  return `${lines.join("\n")}\n`;
}

async function shareShoppingListText(text: string) {
  if (navigator.share) {
    try { await navigator.share({ title: "Liste de courses", text }); return "shared"; } catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; }
  }
  if (isLikelyMobile()) { window.location.href = `sms:?&body=${encodeURIComponent(text)}`; return "sms"; }
  try { await copyText(text); return "copied"; } catch { return "manual"; }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch {}
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-10000px";
  document.body.append(textarea);
  textarea.select();
  try { if (!document.execCommand("copy")) throw new Error("Copy failed"); } finally { textarea.remove(); }
}

function isLikelyMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
