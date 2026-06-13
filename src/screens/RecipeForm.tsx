import { useMemo, useState } from "react";
import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from "react";
import { Check, ChefHat, Clock3, Flame, Hourglass, Image as ImageIcon, Info, Link, PenSquare, Plus, RefreshCcw, Replace, Text, Trash2, Upload, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TagCategory } from "../hooks/useTags";
import { RECIPE_ORIGINS } from "../origins";
import type { Ingredient, RecipeDraft, ReimportMode } from "../types";
import { createId } from "../utils/id";
import { mergedRecipeImageUrls } from "../utils/images";
import { getTagStyle } from "../utils/tagStyle";
import { t } from "../i18n";
import { DEFAULT_RECIPE_TOOLS } from "../constants";

type Props = {
  draft: RecipeDraft;
  editing: boolean;
  warnings: string[];
  allTags: string[];
  categories: TagCategory[];
  tagColorByName: Map<string, string>;
  onCreateTag: (name: string) => Promise<string | undefined> | string | undefined;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  onImport: () => void;
  importText: string;
  onImportTextChange: (text: string) => void;
  onImportText: () => void;
  onImportFile: (file: File) => void;
  onReimport: (mode: ReimportMode) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  setDraft: Dispatch<SetStateAction<RecipeDraft>>;
  onStatus: (message: string) => void;
};

export function RecipeForm({ draft, editing, warnings, allTags, categories, tagColorByName, onCreateTag, importUrl, onImportUrlChange, onImport, importText, onImportTextChange, onImportText, onImportFile, onSubmit, onCancel, onReimport, setDraft, onStatus }: Props) {
  const [isImportSupportOpen, setIsImportSupportOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<"manual" | "url" | "text" | "file">("manual");

  function updateField<K extends keyof RecipeDraft>(field: K, value: RecipeDraft[K]) { setDraft((current) => ({ ...current, [field]: value })); }
  function updateIngredient(id: string, patch: Partial<Ingredient>) { setDraft((current) => ({ ...current, ingredients: current.ingredients.map((ingredient) => ingredient.id === id ? { ...ingredient, ...patch } : ingredient) })); }
  function removeIngredient(id: string) { setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((ingredient) => ingredient.id !== id) })); }
  function addIngredient() { setDraft((current) => ({ ...current, ingredients: [...current.ingredients, { id: createId(), name: "" }] })); }
  function updateInstruction(index: number, value: string) { setDraft((current) => ({ ...current, instructions: current.instructions.map((step, i) => (i === index ? value : step)) })); }
  function removeInstruction(index: number) { setDraft((current) => ({ ...current, instructions: current.instructions.filter((_, i) => i !== index) })); }
  function addInstruction() { setDraft((current) => ({ ...current, instructions: [...current.instructions, ""] })); }

  function setImageOverride(imageUrls: string[]) {
    const next = mergedRecipeImageUrls({ imageUrls });
    setDraft((current) => ({
      ...current,
      imageUrl: next[0],
      imageUrls: next,
      sourceImageUrl: current.sourceImageUrl ?? (current.imageUrl && current.sourceUrl ? current.imageUrl : undefined),
      sourceImageUrls: current.sourceImageUrls ?? mergedRecipeImageUrls({ imageUrl: current.sourceImageUrl ?? current.imageUrl, imageUrls: current.imageUrls }),
    }));
  }

  function resetImageOverride() {
    setDraft((current) => {
      const sourceImages = mergedRecipeImageUrls({ imageUrl: current.sourceImageUrl ?? current.imageUrl, imageUrls: current.sourceImageUrls });
      return { ...current, imageUrl: sourceImages[0], imageUrls: sourceImages, sourceImageUrl: sourceImages[0], sourceImageUrls: sourceImages };
    });
  }

  return (
    <form className="panel workspace recipe-form" onSubmit={onSubmit}>
      <div className="section-heading">
        <div className="recipe-form__title-wrap">
          <span className="eyebrow">{editing ? t("recipe.form.editing") : t("recipe.form.new")}</span>
          <h2 className="recipe-form__title">{draft.name || t("recipe.form.untitled")}</h2>
        </div>
        <div className="action-bar recipe-form__actions">
          <button className="button button--ghost button--icon-mobile" onClick={onCancel} type="button" aria-label={t("recipe.form.cancel")}><X size={18} /></button>
          <button className="button button--primary button--icon-mobile" type="submit"><Check size={18} /> {t("recipe.form.save")}</button>
        </div>
      </div>

      {!editing && (
        <section className="form-section form-section--import">
          <div className="creation-mode-tabs" role="tablist" aria-label={t("recipe.form.creationMode")}>
            <button className={creationMode === "manual" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("manual")}><PenSquare size={16} /> <span className="creation-mode-tabs__label">{t("recipe.form.mode.manual")}</span></button>
            <button className={creationMode === "url" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("url")}><Link size={16} /> <span className="creation-mode-tabs__label">{t("recipe.form.mode.url")}</span></button>
            <button className={creationMode === "text" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("text")}><Text size={16} /> <span className="creation-mode-tabs__label">{t("recipe.form.mode.text")}</span></button>
            <button className={creationMode === "file" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("file")}><Upload size={16} /> <span className="creation-mode-tabs__label">{t("recipe.form.mode.file")}</span></button>
          </div>

          {creationMode === "url" && (
            <>
              <label htmlFor="new-recipe-import-url">{t("recipe.form.importFromUrl")}</label>
              <div className="inline-control">
                <input id="new-recipe-import-url" value={importUrl} onChange={(event) => onImportUrlChange(event.target.value)} placeholder={t("recipe.form.importUrlPlaceholder")} />
                <button className="button button--primary button--icon-mobile" onClick={onImport} type="button"><Link size={18} /> {t("recipe.form.import")}</button>
                <button aria-label={t("recipe.form.importSupport")} aria-expanded={isImportSupportOpen} aria-controls="import-support-panel" className="button button--ghost button--icon-mobile" onClick={() => setIsImportSupportOpen((current) => !current)} type="button"><Info size={18} /></button>
              </div>
              {isImportSupportOpen && (
                <div className="import-support" id="import-support-panel" role="status">
                  <p className="import-support__title">{t("recipe.form.importSupport")}</p>
                  <ul>
                    <li>{t("recipe.form.importSupport.marmiton")}</li>
                    <li>{t("recipe.form.importSupport.cuisineaz")}</li>
                    <li>{t("recipe.form.importSupport.cuisineactuelle")}</li>
                    <li>{t("recipe.form.importSupport.cuisinelibre")}</li>
                    <li>{t("recipe.form.importSupport.papilles")}</li>
                    <li>{t("recipe.form.importSupport.youtube")}</li>
                  </ul>
                </div>
              )}
            </>
          )}

          {creationMode === "text" && (
            <>
              <label htmlFor="new-recipe-import-text">{t("recipe.form.importFromText")}</label>
              <div className="text-import-control">
                <textarea id="new-recipe-import-text" value={importText} onChange={(event) => onImportTextChange(event.target.value)} placeholder={t("recipe.form.importTextPlaceholder")} />
                <button className="button button--primary" onClick={onImportText} type="button">{t("recipe.form.importTextAction")}</button>
              </div>
            </>
          )}

          {creationMode === "file" && (
            <div className="text-import-control">
              <label className="button button--ghost">
                <Upload size={18} /> {t("recipe.form.importFileAction")}
                <input accept=".zip,.json,.txt,application/zip,application/json,text/plain" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.currentTarget.value = ""; }} style={{ display: "none" }} />
              </label>
              <p className="muted">{t("recipe.form.importFileHint")}</p>
            </div>
          )}
        </section>
      )}

      {creationMode === "url" && <ReimportControls sourceUrl={draft.sourceUrl ?? ""} onSourceUrlChange={(sourceUrl) => updateField("sourceUrl", sourceUrl)} onReimport={onReimport} />}

      {warnings.length > 0 && <div className="notice notice--warning">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}

      <div className="form-grid">
        <TextField label={t("recipe.form.name")} value={draft.name} required onChange={(name) => updateField("name", name)} />
        <TagField tags={draft.tags} allTags={allTags} categories={categories} tagColorByName={tagColorByName} onCreateTag={onCreateTag} onChange={(tags) => updateField("tags", tags)} />
        <label>
          {t("recipe.form.origin")}
          <input list="recipe-origins" value={draft.origin ?? ""} onChange={(event) => updateField("origin", event.target.value)} placeholder={t("recipe.form.originPlaceholder")} />
        </label>
        <datalist id="recipe-origins">{RECIPE_ORIGINS.map((origin) => <option key={origin} value={origin} />)}</datalist>
        <TextField label={t("recipe.form.video")} value={draft.videoUrl ?? ""} onChange={(videoUrl) => updateField("videoUrl", videoUrl)} />
        <div className="timing-grid form-grid__full" aria-label={t("recipe.form.timingAria")}>
          <NumberField label={t("recipe.detail.parts")} icon={Users} value={draft.servings} onChange={(servings) => updateField("servings", servings)} />
          <NumberField label={t("recipe.detail.prepShort")} icon={ChefHat} value={draft.prepTime} onChange={(prepTime) => updateField("prepTime", prepTime)} />
          <NumberField label={t("recipe.detail.rest")} icon={Hourglass} value={draft.restTime} onChange={(restTime) => updateField("restTime", restTime)} />
          <NumberField label={t("recipe.detail.cook")} icon={Flame} value={draft.cookTime} onChange={(cookTime) => updateField("cookTime", cookTime)} />
          <NumberField label={t("recipe.detail.total")} icon={Clock3} value={draft.totalTime} onChange={(totalTime) => updateField("totalTime", totalTime)} />
        </div>
      </div>

      <ImageField values={mergedRecipeImageUrls({ imageUrl: draft.imageUrl, imageUrls: draft.imageUrls })} sourceValues={mergedRecipeImageUrls({ imageUrl: draft.sourceImageUrl, imageUrls: draft.sourceImageUrls })} onChange={setImageOverride} onReset={resetImageOverride} onStatus={onStatus} />

      <section className="form-section">
        <h3>{t("recipe.detail.ingredients")}</h3>
        <div className="stack">{draft.ingredients.map((ingredient) => <IngredientRow key={ingredient.id} ingredient={ingredient} onChange={(patch) => updateIngredient(ingredient.id, patch)} onRemove={() => removeIngredient(ingredient.id)} />)}</div>
        <button className="button button--ghost" onClick={addIngredient} type="button"><Plus size={18} /> {t("recipe.form.addIngredient")}</button>
      </section>

      <section className="form-section">
        <h3>{t("recipe.detail.instructions")}</h3>
        <div className="stack">{draft.instructions.map((step, index) => <InstructionRow key={index} step={step} index={index} onChange={(value) => updateInstruction(index, value)} onRemove={() => removeInstruction(index)} />)}</div>
        <button className="button button--ghost" onClick={addInstruction} type="button"><Plus size={18} /> {t("recipe.form.addStep")}</button>
      </section>

      <label>
        {t("recipe.detail.notes")}
        <textarea value={draft.notes ?? ""} onChange={(event) => updateField("notes", event.target.value)} />
      </label>
    </form>
  );
}

function ImageField({ values, sourceValues, onChange, onReset, onStatus }: { values: string[]; sourceValues: string[]; onChange: (value: string[]) => void; onReset: () => void; onStatus: (message: string) => void; }) {
  const [newImageUrl, setNewImageUrl] = useState("");
  const hasImage = values.length > 0;
  const hasCustomImage = values.join("|") !== sourceValues.join("|");

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    try { const image = await imageFileToDataUrl(file); onChange([...values, image]); } catch { onStatus(t("recipe.form.imageReadError")); }
  }

  return (
    <section className="form-section image-field">
      <div className="image-field__header">
        <div>
          <h3>{t("recipe.form.photos")}</h3>
          <p className="muted">{t("recipe.form.photosHint")}</p>
        </div>
        {hasCustomImage && <button className="button button--danger button--icon-mobile" type="button" onClick={onReset}><Trash2 size={18} /> {sourceValues.length > 0 ? t("recipe.form.image.resetSource") : t("recipe.form.image.remove")}</button>}
      </div>

      <div className="image-field__body">
        {hasImage ? <img className="image-field__preview" src={values[0]} alt="" /> : <div className="image-field__empty"><ImageIcon size={30} /></div>}
        <div className="image-field__controls">
          <label>
            {t("recipe.form.image.urlLabel")}
            <input value={newImageUrl} placeholder="https://..." onChange={(event) => setNewImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const next = newImageUrl.trim(); if (!next) return; onChange([...values, next]); setNewImageUrl(""); }} />
          </label>
          <label className="image-field__file-label">
            {t("recipe.form.image.device")}
            <input className="image-field__file-input" accept="image/*" type="file" onChange={(event) => { void handleUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
          {values.length > 0 && <div className="stack">{values.map((imageUrl, index) => <div className="image-field__list-row" key={`${imageUrl}-${index}`}><input value={imageUrl} onChange={(event) => onChange(values.map((value, i) => (i === index ? event.target.value : value)))} /><button className="button" type="button" onClick={() => onChange([imageUrl, ...values.filter((_, i) => i !== index)])}>{t("recipe.form.image.main")}</button><button className="button button--danger" type="button" onClick={() => onChange(values.filter((_, i) => i !== index))}>{t("recipe.form.image.remove")}</button></div>)}</div>}
        </div>
      </div>
    </section>
  );
}

async function imageFileToDataUrl(file: File) {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return rawDataUrl;
  try {
    const image = await loadImage(rawDataUrl);
    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return rawDataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } catch { return rawDataUrl; }
}

function readFileAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new window.Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }

function ReimportControls({ sourceUrl, onSourceUrlChange, onReimport }: { sourceUrl: string; onSourceUrlChange: (value: string) => void; onReimport: (mode: ReimportMode) => void; }) {
  return (
    <div className="reimport-bar">
      <TextField label={t("recipe.form.sourceUrl")} value={sourceUrl} onChange={onSourceUrlChange} />
      <button className="button button--icon-mobile" onClick={() => onReimport("fill-blanks")} type="button"><RefreshCcw size={18} /> {t("recipe.form.reimport.fillBlanks")}</button>
      <button className="button button--ghost button--icon-mobile" onClick={() => onReimport("replace")} type="button"><Replace size={18} /> {t("recipe.form.reimport.replace")}</button>
    </div>
  );
}

function IngredientRow({ ingredient, onChange, onRemove }: { ingredient: Ingredient; onChange: (patch: Partial<Ingredient>) => void; onRemove: () => void; }) {
  return <div className="ingredient-line"><input placeholder={t("recipe.form.ingredient.quantity")} value={ingredient.quantity ?? ""} onChange={(event) => onChange({ quantity: event.target.value })} /><input placeholder={t("recipe.form.ingredient.unit")} value={ingredient.unit ?? ""} onChange={(event) => onChange({ unit: event.target.value })} /><input placeholder={t("recipe.form.ingredient.name")} value={ingredient.name} onChange={(event) => onChange({ name: event.target.value })} /><button className="button button--icon ingredient-line__remove" onClick={onRemove} type="button" title={t("recipe.form.image.remove")}><Trash2 size={16} /></button></div>;
}

function InstructionRow({ step, index, onChange, onRemove }: { step: string; index: number; onChange: (value: string) => void; onRemove: () => void; }) {
  return <div className="step-line"><textarea value={step} onChange={(event) => onChange(event.target.value)} placeholder={`${t("recipe.form.step")} ${index + 1}`} /><button className="button button--icon" onClick={onRemove} type="button" title={t("recipe.form.image.remove")}><Trash2 size={16} /></button></div>;
}

function TextField({ label, value, required, placeholder, onChange }: { label: string; value: string; required?: boolean; placeholder?: string; onChange: (value: string) => void; }) {
  return <label>{label}<input value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TagField({ tags, allTags, categories, tagColorByName, onCreateTag, onChange }: { tags: string[]; allTags: string[]; categories: TagCategory[]; tagColorByName: Map<string, string>; onCreateTag: (name: string) => Promise<string | undefined> | string | undefined; onChange: (tags: string[]) => void; }) {
  const [input, setInput] = useState("");
  const toolKeys = new Set(DEFAULT_RECIPE_TOOLS.map((tool) => tool.toLowerCase()));
  const formatTag = (value: string) => (toolKeys.has(value.toLowerCase()) ? t(`recipe.tools.${value.toLowerCase()}` as never) : value);
  const formatCategory = (value: string) => (value.toLowerCase() === "tools" ? t("recipe.form.tools") : value);
  const suggestions = useMemo(() => {
    const selected = new Set(tags);
    const query = input.trim().toLowerCase();
    return allTags.filter((tag) => !selected.has(tag) && (!query || tag.toLowerCase().includes(query))).slice(0, 8);
  }, [allTags, tags, input]);

  function hasTag(value: string) { return tags.some((existing) => existing.toLowerCase() === value.toLowerCase()); }
  function addTag(raw: string) { const tag = raw.trim(); if (!tag) return; if (hasTag(tag)) { setInput(""); return; } const match = allTags.find((existing) => existing.toLowerCase() === tag.toLowerCase()); if (!match) return; onChange([...tags, match]); setInput(""); }
  function removeTag(tag: string) { onChange(tags.filter((existing) => existing !== tag)); }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); void addOrCreateTag(input); } else if (event.key === "Backspace" && !input && tags.length > 0) { removeTag(tags[tags.length - 1]); } }
  async function addOrCreateTag(raw: string) { const tag = raw.trim(); if (!tag) return; const existing = allTags.find((candidate) => candidate.toLowerCase() === tag.toLowerCase()); if (existing) { if (!hasTag(existing)) onChange([...tags, existing]); setInput(""); return; } const created = await onCreateTag(tag); const resolved = created ?? tag; if (!hasTag(resolved)) onChange([...tags, resolved]); setInput(""); }
  function createGlobalTag() { void addOrCreateTag(input); setInput(""); }

  return (
    <label className="tag-field">
      {t("manage.tags")}
      <div className="tag-field__box">
        {tags.map((tag) => (
          <span className="chip tag-field__chip" key={tag} style={getTagStyle(tag, tagColorByName)}>
            {formatTag(tag)}
            <button className="tag-field__remove" onClick={() => removeTag(tag)} type="button" aria-label={`${t("recipe.form.image.remove")} ${tag}`}><X size={12} /></button>
          </span>
        ))}
        <input className="tag-field__input" list="recipe-tags" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} onBlur={() => addTag(input)} placeholder={tags.length === 0 ? t("recipe.form.tags.placeholder") : ""} />
      </div>
      {input.trim() && !allTags.some((tag) => tag.toLowerCase() === input.trim().toLowerCase()) && <button className="button button--ghost tag-field__create" type="button" onClick={createGlobalTag}><Plus size={16} /> {t("recipe.form.tags.addToList", { name: input.trim() })}</button>}
      <datalist id="recipe-tags">{suggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
      <details className="tag-manager">
        <summary>{t("recipe.form.tags.globalList")}</summary>
        <div className="tag-reference">
          {categories.map((category) => (
            <div className="tag-reference__group" key={category.name}>
              <strong>{formatCategory(category.name)}</strong>
              <div className="chip-list">
                {category.tags.map((tag) => {
                  const selected = hasTag(tag.name);
                  return <button className={selected ? "chip tag-reference__chip tag-reference__chip--active" : "chip tag-reference__chip"} key={tag.id} style={selected ? undefined : getTagStyle(tag.name, undefined, tag.color)} onClick={() => { if (selected) { onChange(tags.filter((existing) => existing.toLowerCase() !== tag.name.toLowerCase())); return; } onChange([...tags, tag.name]); }} type="button">{formatTag(tag.name)}</button>;
                })}
              </div>
            </div>
          ))}
          {categories.length === 0 && <span className="muted">{t("manage.empty.tags")}</span>}
        </div>
      </details>
    </label>
  );
}

function NumberField({ label, icon: Icon, value, onChange }: { label: string; icon: LucideIcon; value?: number; onChange: (value: number | undefined) => void; }) {
  return <label className="number-field" aria-label={label}><span className="number-field__label"><Icon size={16} /><span className="number-field__label-text">{label}</span></span><input min="0" type="number" value={value ?? ""} onChange={(event) => onChange(Number(event.target.value) || undefined)} /></label>;
}
