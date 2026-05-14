import { useMemo, useState } from "react";
import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from "react";
import { Check, Link, Plus, RefreshCcw, Replace, X } from "lucide-react";
import { RECIPE_ORIGINS } from "../origins";
import type { Ingredient, RecipeDraft, ReimportMode } from "../types";
import { createId } from "../utils/id";

type Props = {
  draft: RecipeDraft;
  editing: boolean;
  warnings: string[];
  allTags: string[];
  onCreateTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onDeleteTag: (name: string) => void;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  onImport: () => void;
  onReimport: (mode: ReimportMode) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  setDraft: Dispatch<SetStateAction<RecipeDraft>>;
};

export function RecipeForm({
  draft,
  editing,
  warnings,
  allTags,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  importUrl,
  onImportUrlChange,
  onImport,
  onSubmit,
  onCancel,
  onReimport,
  setDraft,
}: Props) {
  function updateField<K extends keyof RecipeDraft>(field: K, value: RecipeDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
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
        <div>
          <span className="eyebrow">{editing ? "Modification" : "Nouvelle recette"}</span>
          <h2>{draft.name || "Recette sans titre"}</h2>
        </div>
        <div className="action-bar">
          <button className="button button--ghost" onClick={onCancel} type="button">
            Annuler
          </button>
          <button className="button button--primary" type="submit">
            <Check size={18} /> Enregistrer
          </button>
        </div>
      </div>

      {!editing && (
        <section className="form-section form-section--import">
          <label htmlFor="new-recipe-import-url">Importer depuis un lien</label>
          <div className="inline-control">
            <input
              id="new-recipe-import-url"
              value={importUrl}
              onChange={(event) => onImportUrlChange(event.target.value)}
              placeholder="Marmiton, CuisineAZ, YouTube..."
            />
            <button className="button button--primary" onClick={onImport} type="button">
              <Link size={18} /> Importer
            </button>
          </div>
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
          onCreateTag={onCreateTag}
          onRenameTag={onRenameTag}
          onDeleteTag={onDeleteTag}
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
        <TextField label="Image" value={draft.imageUrl ?? ""} onChange={(imageUrl) => updateField("imageUrl", imageUrl)} />
        <NumberField label="Personnes" value={draft.servings} onChange={(servings) => updateField("servings", servings)} />
        <NumberField label="Préparation" value={draft.prepTime} onChange={(prepTime) => updateField("prepTime", prepTime)} />
        <NumberField label="Cuisson" value={draft.cookTime} onChange={(cookTime) => updateField("cookTime", cookTime)} />
        <NumberField label="Temps total" value={draft.totalTime} onChange={(totalTime) => updateField("totalTime", totalTime)} />
      </div>

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
      <button className="button" onClick={() => onReimport("fill-blanks")} type="button">
        <RefreshCcw size={18} /> Compléter les champs vides
      </button>
      <button className="button button--ghost" onClick={() => onReimport("replace")} type="button">
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
      <button className="button button--icon" onClick={onRemove} type="button" title="Retirer">
        <X size={16} />
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
        <X size={16} />
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
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onChange,
}: {
  tags: string[];
  allTags: string[];
  onCreateTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onDeleteTag: (name: string) => void;
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

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
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
      addTag(input);
    } else if (event.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  function createGlobalTag() {
    onCreateTag(input);
    setInput("");
  }

  return (
    <label className="tag-field">
      Tags
      <div className="tag-field__box">
        {tags.map((tag) => (
          <span className="chip tag-field__chip" key={tag}>
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
        <summary>Gerer la liste globale</summary>
        <div className="tag-manager__list">
          {allTags.map((tag) => (
            <span className="tag-manager__row" key={tag}>
              <span>{tag}</span>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => {
                  const next = window.prompt("Nouveau nom du tag", tag);
                  if (next) onRenameTag(tag, next);
                }}
              >
                Renommer
              </button>
              <button className="button button--danger" type="button" onClick={() => onDeleteTag(tag)}>
                Supprimer
              </button>
            </span>
          ))}
          {allTags.length === 0 && <span className="muted">Aucun tag pour l'instant.</span>}
        </div>
      </details>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label>
      {label}
      <input min="0" type="number" value={value ?? ""} onChange={(event) => onChange(Number(event.target.value) || undefined)} />
    </label>
  );
}
