import { useMemo, useState } from "react";
import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from "react";
import { Check, ChefHat, Clock3, Flame, Hourglass, Image as ImageIcon, Info, Link, PenSquare, Plus, RefreshCcw, Replace, Text, Trash2, Upload, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TagCategory } from "../hooks/useTags";
import { RECIPE_ORIGINS } from "../origins";
import type { Ingredient, RecipeDraft, ReimportMode } from "../types";
import { createId } from "../utils/id";
import { getTagStyle } from "../utils/tagStyle";

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

export function RecipeForm({
  draft,
  editing,
  warnings,
  allTags,
  categories,
  tagColorByName,
  onCreateTag,
  importUrl,
  onImportUrlChange,
  onImport,
  importText,
  onImportTextChange,
  onImportText,
  onImportFile,
  onSubmit,
  onCancel,
  onReimport,
  setDraft,
  onStatus,
}: Props) {
  const [isImportSupportOpen, setIsImportSupportOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<"manual" | "url" | "text" | "file">("manual");

  function updateField<K extends keyof RecipeDraft>(field: K, value: RecipeDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setImageOverride(imageUrl: string) {
    setDraft((current) => ({
      ...current,
      imageUrl: imageUrl || undefined,
      sourceImageUrl:
        current.sourceImageUrl ?? (current.imageUrl && current.sourceUrl ? current.imageUrl : undefined),
    }));
  }

  function resetImageOverride() {
    setDraft((current) => ({
      ...current,
      imageUrl: current.sourceImageUrl,
      sourceImageUrl: current.sourceImageUrl,
    }));
  }

  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...patch } : ingredient,
      ),
    }));
  }

  function removeIngredient(id: string) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.filter((ingredient) => ingredient.id !== id),
    }));
  }

  function addIngredient() {
    setDraft((current) => ({
      ...current,
      ingredients: [...current.ingredients, { id: createId(), name: "" }],
    }));
  }

  function updateInstruction(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      instructions: current.instructions.map((step, i) => (i === index ? value : step)),
    }));
  }

  function removeInstruction(index: number) {
    setDraft((current) => ({
      ...current,
      instructions: current.instructions.filter((_, i) => i !== index),
    }));
  }

  function addInstruction() {
    setDraft((current) => ({ ...current, instructions: [...current.instructions, ""] }));
  }

  return (
    <form className="panel workspace recipe-form" onSubmit={onSubmit}>
      <div className="section-heading">
        <div className="recipe-form__title-wrap">
          <span className="eyebrow">{editing ? "Modification" : "Nouvelle recette"}</span>
          <h2 className="recipe-form__title">{draft.name || "Recette sans titre"}</h2>
        </div>
        <div className="action-bar recipe-form__actions">
          <button className="button button--ghost button--icon-mobile" onClick={onCancel} type="button" aria-label="Annuler">
            <X size={18} />
          </button>
          <button className="button button--primary button--icon-mobile" type="submit">
            <Check size={18} /> Enregistrer
          </button>
        </div>
      </div>

      {!editing && (
        <section className="form-section form-section--import">
          <div className="creation-mode-tabs" role="tablist" aria-label="Mode de creation de recette">
            <button className={creationMode === "manual" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("manual")}>
              <PenSquare size={16} /> <span className="creation-mode-tabs__label">Manuel</span>
            </button>
            <button className={creationMode === "url" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("url")}>
              <Link size={16} /> <span className="creation-mode-tabs__label">Lien</span>
            </button>
            <button className={creationMode === "text" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("text")}>
              <Text size={16} /> <span className="creation-mode-tabs__label">Texte</span>
            </button>
            <button className={creationMode === "file" ? "button button--primary" : "button"} type="button" onClick={() => setCreationMode("file")}>
              <Upload size={16} /> <span className="creation-mode-tabs__label">Fichier</span>
            </button>
          </div>

          {creationMode === "url" && (
            <>
              <label htmlFor="new-recipe-import-url">Importer depuis un lien</label>
              <div className="inline-control">
                <input
                  id="new-recipe-import-url"
                  value={importUrl}
                  onChange={(event) => onImportUrlChange(event.target.value)}
                  placeholder="Marmiton, CuisineAZ, YouTube..."
                />
                <button className="button button--primary button--icon-mobile" onClick={onImport} type="button">
                  <Link size={18} /> Importer
                </button>
                <button
                  aria-label="Niveaux de support des sites d'import"
                  aria-expanded={isImportSupportOpen}
                  aria-controls="import-support-panel"
                  className="button button--ghost button--icon-mobile"
                  onClick={() => setIsImportSupportOpen((current) => !current)}
                  type="button"
                >
                  <Info size={18} />
                </button>
              </div>
              {isImportSupportOpen && (
                <div className="import-support" id="import-support-panel" role="status">
                  <p className="import-support__title">Niveaux de support</p>
                  <ul>
                    <li>marmiton.org: bon</li>
                    <li>cuisineaz.com: bon</li>
                    <li>cuisineactuelle.fr: bon</li>
                    <li>cuisine-libre.org: bon</li>
                    <li>papillesetpupilles.fr: bon a partiel selon la page</li>
                    <li>youtube.com/shorts: partiel (titre/description)</li>
                  </ul>
                </div>
              )}
            </>
          )}

          {creationMode === "text" && (
            <>
              <label htmlFor="new-recipe-import-text">Importer depuis un texte (SMS / partage)</label>
              <div className="text-import-control">
                <textarea
                  id="new-recipe-import-text"
                  value={importText}
                  onChange={(event) => onImportTextChange(event.target.value)}
                  placeholder="Colle ici le texte partage par SMS (titre, ingredients, etapes...)"
                />
                <button className="button button--primary" onClick={onImportText} type="button">
                  Importer le texte
                </button>
              </div>
            </>
          )}

          {creationMode === "file" && (
            <div className="text-import-control">
              <label className="button button--ghost">
                <Upload size={18} /> Importer un fichier JSON/ZIP
                <input
                  accept=".zip,.json,application/zip,application/json,text/plain,.toquooking,.txt"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImportFile(file);
                    event.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <p className="muted">Pour un fichier avec plusieurs recettes, utilise le menu Sauvegardes.</p>
            </div>
          )}
        </section>
      )}

      <ReimportControls
        sourceUrl={draft.sourceUrl ?? ""}
        onSourceUrlChange={(sourceUrl) => updateField("sourceUrl", sourceUrl)}
        onReimport={onReimport}
      />

      {warnings.length > 0 && (
        <div className="notice notice--warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="form-grid">
        <TextField label="Nom" value={draft.name} required onChange={(name) => updateField("name", name)} />
        <TagField
          tags={draft.tags}
          allTags={allTags}
          categories={categories}
          tagColorByName={tagColorByName}
          onCreateTag={onCreateTag}
          onChange={(tags) => updateField("tags", tags)}
        />
        <label>
          Pays / région d'origine
          <input
            list="recipe-origins"
            value={draft.origin ?? ""}
            onChange={(event) => updateField("origin", event.target.value)}
            placeholder="France, Italie, Maroc..."
          />
        </label>
        <datalist id="recipe-origins">
          {RECIPE_ORIGINS.map((origin) => (
            <option key={origin} value={origin} />
          ))}
        </datalist>
        <TextField label="Vidéo" value={draft.videoUrl ?? ""} onChange={(videoUrl) => updateField("videoUrl", videoUrl)} />
        <div className="timing-grid form-grid__full" aria-label="Temps et portions">
          <NumberField label="Parts" icon={Users} value={draft.servings} onChange={(servings) => updateField("servings", servings)} />
          <NumberField label="Prep" icon={ChefHat} value={draft.prepTime} onChange={(prepTime) => updateField("prepTime", prepTime)} />
          <NumberField label="Repos" icon={Hourglass} value={draft.restTime} onChange={(restTime) => updateField("restTime", restTime)} />
          <NumberField label="Cuisson" icon={Flame} value={draft.cookTime} onChange={(cookTime) => updateField("cookTime", cookTime)} />
          <NumberField label="Total" icon={Clock3} value={draft.totalTime} onChange={(totalTime) => updateField("totalTime", totalTime)} />
        </div>
      </div>

      <ImageField
        value={draft.imageUrl ?? ""}
        sourceValue={draft.sourceImageUrl}
        onChange={setImageOverride}
        onReset={resetImageOverride}
        onStatus={onStatus}
      />

      <section className="form-section">
        <h3>Ingrédients</h3>
        <div className="stack">
          {draft.ingredients.map((ingredient) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              onChange={(patch) => updateIngredient(ingredient.id, patch)}
              onRemove={() => removeIngredient(ingredient.id)}
            />
          ))}
        </div>
        <button className="button button--ghost" onClick={addIngredient} type="button">
          <Plus size={18} /> Ajouter un ingrédient
        </button>
      </section>

      <section className="form-section">
        <h3>Instructions</h3>
        <div className="stack">
          {draft.instructions.map((step, index) => (
            <InstructionRow
              key={index}
              step={step}
              index={index}
              onChange={(value) => updateInstruction(index, value)}
              onRemove={() => removeInstruction(index)}
            />
          ))}
        </div>
        <button className="button button--ghost" onClick={addInstruction} type="button">
          <Plus size={18} /> Ajouter une étape
        </button>
      </section>

      <label>
        Notes
        <textarea value={draft.notes ?? ""} onChange={(event) => updateField("notes", event.target.value)} />
      </label>
    </form>
  );
}

function ImageField({
  value,
  sourceValue,
  onChange,
  onReset,
  onStatus,
}: {
  value: string;
  sourceValue?: string;
  onChange: (value: string) => void;
  onReset: () => void;
  onStatus: (message: string) => void;
}) {
  const hasImage = Boolean(value);
  const hasCustomImage = hasImage && value !== sourceValue;

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    try {
      onChange(await imageFileToDataUrl(file));
    } catch {
      onStatus("Image impossible a lire. Essaie un autre fichier.");
    }
  }

  return (
    <section className="form-section image-field">
      <div className="image-field__header">
        <div>
          <h3>Photo</h3>
          <p className="muted">Cette image remplace l'apercu importe depuis le site source.</p>
        </div>
        {hasCustomImage && (
          <button className="button button--danger button--icon-mobile" type="button" onClick={onReset}>
            <Trash2 size={18} /> {sourceValue ? "Revenir a l'image source" : "Retirer"}
          </button>
        )}
      </div>

      <div className="image-field__body">
        {hasImage ? (
          <img className="image-field__preview" src={value} alt="" />
        ) : (
          <div className="image-field__empty">
            <ImageIcon size={30} />
          </div>
        )}
        <div className="image-field__controls">
          <label>
            URL de l'image
            <input value={value.startsWith("data:") ? "" : value} placeholder="https://..." onChange={(event) => onChange(event.target.value)} />
          </label>
          <label className="image-field__file-label">
            Image depuis l'appareil
            <input
              className="image-field__file-input"
              accept="image/*"
              type="file"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
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
  } catch {
    return rawDataUrl;
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function ReimportControls({
  sourceUrl,
  onSourceUrlChange,
  onReimport,
}: {
  sourceUrl: string;
  onSourceUrlChange: (value: string) => void;
  onReimport: (mode: ReimportMode) => void;
}) {
  return (
    <div className="reimport-bar">
      <TextField label="Lien source" value={sourceUrl} onChange={onSourceUrlChange} />
      <button className="button button--icon-mobile" onClick={() => onReimport("fill-blanks")} type="button">
        <RefreshCcw size={18} /> Compléter les champs vides
      </button>
      <button className="button button--ghost button--icon-mobile" onClick={() => onReimport("replace")} type="button">
        <Replace size={18} /> Remplacer depuis le lien
      </button>
    </div>
  );
}

function IngredientRow({
  ingredient,
  onChange,
  onRemove,
}: {
  ingredient: Ingredient;
  onChange: (patch: Partial<Ingredient>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ingredient-line">
      <input placeholder="Quantité" value={ingredient.quantity ?? ""} onChange={(event) => onChange({ quantity: event.target.value })} />
      <input placeholder="Unité" value={ingredient.unit ?? ""} onChange={(event) => onChange({ unit: event.target.value })} />
      <input placeholder="Ingrédient" value={ingredient.name} onChange={(event) => onChange({ name: event.target.value })} />
      <button className="button button--icon ingredient-line__remove" onClick={onRemove} type="button" title="Retirer">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function InstructionRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="step-line">
      <textarea value={step} onChange={(event) => onChange(event.target.value)} placeholder={`Étape ${index + 1}`} />
      <button className="button button--icon" onClick={onRemove} type="button" title="Retirer">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function TextField({
  label,
  value,
  required,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TagField({
  tags,
  allTags,
  categories,
  tagColorByName,
  onCreateTag,
  onChange,
}: {
  tags: string[];
  allTags: string[];
  categories: TagCategory[];
  tagColorByName: Map<string, string>;
  onCreateTag: (name: string) => Promise<string | undefined> | string | undefined;
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const suggestions = useMemo(() => {
    const selected = new Set(tags);
    const query = input.trim().toLowerCase();
    return allTags
      .filter((tag) => !selected.has(tag) && (!query || tag.toLowerCase().includes(query)))
      .slice(0, 8);
  }, [allTags, tags, input]);

  function hasTag(value: string) {
    return tags.some((existing) => existing.toLowerCase() === value.toLowerCase());
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (hasTag(tag)) {
      setInput("");
      return;
    }
    const match = allTags.find((existing) => existing.toLowerCase() === tag.toLowerCase());
    if (!match) return;
    onChange([...tags, match]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((existing) => existing !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      void addOrCreateTag(input);
    } else if (event.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  async function addOrCreateTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    const existing = allTags.find((candidate) => candidate.toLowerCase() === tag.toLowerCase());
    if (existing) {
      if (!hasTag(existing)) onChange([...tags, existing]);
      setInput("");
      return;
    }
    const created = await onCreateTag(tag);
    const resolved = created ?? tag;
    if (!hasTag(resolved)) onChange([...tags, resolved]);
    setInput("");
  }

  function createGlobalTag() {
    void addOrCreateTag(input);
    setInput("");
  }

  return (
    <label className="tag-field">
      Tags
      <div className="tag-field__box">
        {tags.map((tag) => (
          <span className="chip tag-field__chip" key={tag} style={getTagStyle(tag, tagColorByName)}>
            {tag}
            <button
              className="tag-field__remove"
              onClick={() => removeTag(tag)}
              type="button"
              aria-label={`Retirer ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="tag-field__input"
          list="recipe-tags"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? "plat, chaud, dessert..." : ""}
        />
      </div>
      {input.trim() && !allTags.some((tag) => tag.toLowerCase() === input.trim().toLowerCase()) && (
        <button className="button button--ghost tag-field__create" type="button" onClick={createGlobalTag}>
          <Plus size={16} /> Ajouter "{input.trim()}" a la liste
        </button>
      )}
      <datalist id="recipe-tags">
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <details className="tag-manager">
        <summary>Liste globale des tags</summary>
        <div className="tag-reference">
          {categories.map((category) => (
            <div className="tag-reference__group" key={category.name}>
              <strong>{category.name}</strong>
              <div className="chip-list">
                {category.tags.map((tag) => {
                  const selected = hasTag(tag.name);
                  return (
                    <button
                      className={selected ? "chip tag-reference__chip tag-reference__chip--active" : "chip tag-reference__chip"}
                      key={tag.id}
                      style={selected ? undefined : getTagStyle(tag.name, undefined, tag.color)}
                      onClick={() => {
                        if (selected) {
                          onChange(tags.filter((existing) => existing.toLowerCase() !== tag.name.toLowerCase()));
                          return;
                        }
                        onChange([...tags, tag.name]);
                      }}
                      type="button"
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {categories.length === 0 && <span className="muted">Aucun tag pour l'instant.</span>}
        </div>
      </details>
    </label>
  );
}

function NumberField({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="number-field" aria-label={label}>
      <span className="number-field__label">
        <Icon size={16} />
        <span className="number-field__label-text">{label}</span>
      </span>
      <input min="0" type="number" value={value ?? ""} onChange={(event) => onChange(Number(event.target.value) || undefined)} />
    </label>
  );
}


