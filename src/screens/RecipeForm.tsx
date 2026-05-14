import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Check, RefreshCcw, Replace, Plus, X } from "lucide-react";
import { RECIPE_ORIGINS } from "../origins";
import type { Ingredient, RecipeDraft } from "../types";
import { createId } from "../utils/id";

type Props = {
  draft: RecipeDraft;
  editing: boolean;
  warnings: string[];
  onReimport: (mode: "replace" | "fill-blanks") => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  setDraft: Dispatch<SetStateAction<RecipeDraft>>;
};

export function RecipeForm({ draft, editing, warnings, onSubmit, onCancel, onReimport, setDraft }: Props) {
  function updateIngredient(id: string, field: keyof Ingredient, value: string) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, [field]: value } : ingredient,
      ),
    }));
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

      <div className="reimport-bar">
        <TextField label="Lien source" value={draft.sourceUrl ?? ""} onChange={(sourceUrl) => setDraft((current) => ({ ...current, sourceUrl }))} />
        <button className="button" onClick={() => onReimport("fill-blanks")} type="button">
          <RefreshCcw size={18} /> Compléter les champs vides
        </button>
        <button className="button button--ghost" onClick={() => onReimport("replace")} type="button">
          <Replace size={18} /> Remplacer depuis le lien
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="notice notice--warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="form-grid">
        <TextField label="Nom" value={draft.name} required onChange={(name) => setDraft((current) => ({ ...current, name }))} />
        <TextField
          label="Tags"
          value={draft.tags.join(", ")}
          placeholder="plat, chaud, dessert..."
          onChange={(value) => setDraft((current) => ({ ...current, tags: value.split(",").map((tag) => tag.trim()) }))}
        />
        <label>
          Pays / région d'origine
          <input
            list="recipe-origins"
            value={draft.origin ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, origin: event.target.value }))}
            placeholder="France, Italie, Maroc..."
          />
        </label>
        <datalist id="recipe-origins">
          {RECIPE_ORIGINS.map((origin) => (
            <option key={origin} value={origin} />
          ))}
        </datalist>
        <TextField label="Vidéo" value={draft.videoUrl ?? ""} onChange={(videoUrl) => setDraft((current) => ({ ...current, videoUrl }))} />
        <TextField label="Image" value={draft.imageUrl ?? ""} onChange={(imageUrl) => setDraft((current) => ({ ...current, imageUrl }))} />
        <NumberField label="Personnes" value={draft.servings} onChange={(servings) => setDraft((current) => ({ ...current, servings }))} />
        <NumberField label="Préparation" value={draft.prepTime} onChange={(prepTime) => setDraft((current) => ({ ...current, prepTime }))} />
        <NumberField label="Cuisson" value={draft.cookTime} onChange={(cookTime) => setDraft((current) => ({ ...current, cookTime }))} />
        <NumberField label="Temps total" value={draft.totalTime} onChange={(totalTime) => setDraft((current) => ({ ...current, totalTime }))} />
      </div>

      <section className="form-section">
        <h3>Ingrédients</h3>
        <div className="stack">
          {draft.ingredients.map((ingredient) => (
            <div className="ingredient-line" key={ingredient.id}>
              <input placeholder="Quantité" value={ingredient.quantity ?? ""} onChange={(event) => updateIngredient(ingredient.id, "quantity", event.target.value)} />
              <input placeholder="Unité" value={ingredient.unit ?? ""} onChange={(event) => updateIngredient(ingredient.id, "unit", event.target.value)} />
              <input placeholder="Ingrédient" value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, "name", event.target.value)} />
              <button
                className="button button--icon"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    ingredients: current.ingredients.filter((candidate) => candidate.id !== ingredient.id),
                  }))
                }
                type="button"
                title="Retirer"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="button button--ghost"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              ingredients: [...current.ingredients, { id: createId(), name: "" }],
            }))
          }
          type="button"
        >
          <Plus size={18} /> Ajouter un ingrédient
        </button>
      </section>

      <section className="form-section">
        <h3>Instructions</h3>
        <div className="stack">
          {draft.instructions.map((step, index) => (
            <div className="step-line" key={index}>
              <textarea
                value={step}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    instructions: current.instructions.map((candidate, candidateIndex) =>
                      candidateIndex === index ? event.target.value : candidate,
                    ),
                  }))
                }
                placeholder={`Étape ${index + 1}`}
              />
              <button
                className="button button--icon"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    instructions: current.instructions.filter((_, candidateIndex) => candidateIndex !== index),
                  }))
                }
                type="button"
                title="Retirer"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button className="button button--ghost" onClick={() => setDraft((current) => ({ ...current, instructions: [...current.instructions, ""] }))} type="button">
          <Plus size={18} /> Ajouter une étape
        </button>
      </section>

      <label>
        Notes
        <textarea value={draft.notes ?? ""} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
      </label>
    </form>
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
