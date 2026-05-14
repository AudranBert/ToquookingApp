import type { RefObject } from "react";
import { BookOpen, Edit3, FileDown, FileImage, Plus, Trash2 } from "lucide-react";
import type { Recipe } from "../types";
import { currentSeasonalIngredients, recipeContainsSeasonalIngredient } from "../seasonal";
import { proxiedImageUrl } from "../utils/images";
import { isPantryIngredient } from "../utils/ingredients";
import { ingredientLabel } from "../utils/recipes";

type Props = {
  recipe?: Recipe;
  printRef: RefObject<HTMLDivElement>;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onExport: (format: "pdf" | "png") => void;
};

export function RecipeDetail({ recipe, printRef, onEdit, onDelete, onDuplicate, onExport }: Props) {
  if (!recipe) {
    return (
      <section className="empty-state panel">
        <BookOpen size={44} />
        <h2>Ton carnet est prêt</h2>
        <p>Ajoute une recette manuellement ou importe un lien pour commencer.</p>
      </section>
    );
  }

  return (
    <article className="recipe-detail">
      <div className="action-bar">
        <button className="button" onClick={() => onEdit(recipe)} title="Modifier">
          <Edit3 size={18} /> Modifier
        </button>
        <button className="button" onClick={() => onDuplicate(recipe)} title="Dupliquer">
          <Plus size={18} /> Dupliquer
        </button>
        <button className="button" onClick={() => onExport("pdf")} title="Exporter en PDF">
          <FileDown size={18} /> PDF
        </button>
        <button className="button" onClick={() => onExport("png")} title="Exporter en PNG">
          <FileImage size={18} /> PNG
        </button>
        <button className="button button--danger" onClick={() => onDelete(recipe)} title="Supprimer">
          <Trash2 size={18} /> Supprimer
        </button>
      </div>

      <div className="recipe-card" ref={printRef}>
        {recipe.imageUrl && <img className="recipe-image" src={proxiedImageUrl(recipe.imageUrl)} crossOrigin="anonymous" alt="" />}
        <div className="recipe-title">
          <span className="eyebrow">Recette</span>
          <h2>{recipe.name}</h2>
        </div>
        <div className="chip-list">
          {recipe.tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="meta-list">
          {hasValue(recipe.servings) && <span>{recipe.servings} personne(s)</span>}
          {hasPositiveValue(recipe.prepTime) && <span>Préparation {recipe.prepTime} min</span>}
          {hasPositiveValue(recipe.cookTime) && <span>Cuisson {recipe.cookTime} min</span>}
          {hasPositiveValue(recipe.totalTime) && <span>Total {recipe.totalTime} min</span>}
        </div>
        <div className="recipe-columns">
          <section>
            <h3>Ingrédients</h3>
            <ul>
              {recipe.ingredients.map((ingredient) => (
                <li className="ingredient-status-row" key={ingredient.id}>
                  <span>{ingredientLabel(ingredient)}</span>
                  <span className="ingredient-badges">
                    {recipeContainsSeasonalIngredient([ingredient.name], currentSeasonalIngredients()) && (
                      <span className="chip chip--seasonal">De saison</span>
                    )}
                    {isPantryIngredient(ingredient) && <span className="chip chip--pantry">Placard</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Instructions</h3>
            <ol>
              {recipe.instructions.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          </section>
        </div>
        {recipe.notes && (
          <section>
            <h3>Notes</h3>
            <p>{recipe.notes}</p>
          </section>
        )}
        {(recipe.sourceUrl || recipe.videoUrl) && (
          <footer className="link-row">
            {recipe.sourceUrl && <a href={recipe.sourceUrl}>Source</a>}
            {recipe.videoUrl && <a href={recipe.videoUrl}>Vidéo</a>}
          </footer>
        )}
      </div>
    </article>
  );
}

function hasValue(value: number | undefined) {
  return value !== undefined && value !== null;
}

function hasPositiveValue(value: number | undefined) {
  return value !== undefined && value > 0;
}
