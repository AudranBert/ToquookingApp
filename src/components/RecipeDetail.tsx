import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { BookOpen, ChefHat, Clock3, Copy, Edit3, FileDown, FileImage, Flame, Hourglass, MessageSquareText, Share2, Trash2, Users } from "lucide-react";
import type { Recipe } from "../types";
import { currentSeasonalIngredients, recipeContainsSeasonalIngredient } from "../seasonal";
import { mergedRecipeImageUrls, proxiedImageUrl, shouldUseImageCrossOrigin } from "../utils/images";
import { isPantryIngredient } from "../utils/ingredients";
import { ingredientLabel } from "../utils/recipes";
import { getTagStyle } from "../utils/tagStyle";
import { t } from "../i18n";

type Props = {
  recipe?: Recipe;
  printRef: RefObject<HTMLDivElement>;
  tagColorByName: Map<string, string>;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onExportPdf: () => void;
  onShareImage: () => void;
  onShareText: () => void;
  onExportRecipeFile: () => void;
};

export function RecipeDetail({
  recipe,
  printRef,
  tagColorByName,
  onEdit,
  onDelete,
  onDuplicate,
  onExportPdf,
  onShareImage,
  onShareText,
  onExportRecipeFile,
}: Props) {
  if (!recipe) {
    return (
      <section className="empty-state panel">
        <BookOpen size={44} />
        <h2>{t("recipe.detail.emptyTitle")}</h2>
        <p>{t("recipe.detail.emptyBody")}</p>
      </section>
    );
  }
  const images = mergedRecipeImageUrls(recipe);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [recipe.id]);

  const hasSeveralImages = images.length > 1;
  const activeImage = images[Math.min(activeImageIndex, Math.max(0, images.length - 1))];

  return (
    <article className="recipe-detail">
      <div className="action-bar">
        <button className="button button--icon-mobile" onClick={() => onEdit(recipe)} title={t("recipe.detail.edit")}>
          <Edit3 size={18} /> {t("recipe.detail.edit")}
        </button>
        <button className="button button--icon-mobile" onClick={() => onDuplicate(recipe)} title={t("recipe.detail.duplicate")}>
          <Copy size={18} /> {t("recipe.detail.duplicate")}
        </button>
        <button className="button button--icon-mobile" onClick={onExportPdf} title={t("recipe.detail.exportPdf")}>
          <FileDown size={18} /> PDF
        </button>
        <button className="button button--icon-mobile" onClick={onShareImage} title={t("recipe.detail.sharePng")}>
          <FileImage size={18} /> PNG
        </button>
        <button className="button button--primary button--icon-mobile" onClick={onShareText} title={t("recipe.detail.shareSms")}>
          <MessageSquareText size={18} /> SMS
        </button>
        <button className="button button--icon-mobile" onClick={onExportRecipeFile} title={t("recipe.detail.shareRecipe")}>
          <Share2 size={18} /> {t("recipe.detail.link")}
        </button>
        <button className="button button--danger button--icon-mobile" onClick={() => onDelete(recipe)} title={t("recipe.detail.delete")}>
          <Trash2 size={18} /> {t("recipe.detail.delete")}
        </button>
      </div>

      <div className="recipe-card" ref={printRef}>
        {images.length > 0 && (
          <div className="recipe-carousel">
            <img
              className="recipe-image"
              src={proxiedImageUrl(activeImage, recipe.sourceUrl)}
              crossOrigin={shouldUseImageCrossOrigin(activeImage, recipe.sourceUrl) ? "anonymous" : undefined}
              alt=""
            />
            {hasSeveralImages && (
              <>
                <button
                  className="recipe-carousel__nav recipe-carousel__nav--prev"
                  type="button"
                  onClick={() => setActiveImageIndex((current) => (current - 1 + images.length) % images.length)}
                  aria-label={t("recipe.detail.prevImage")}
                >
                  ‹
                </button>
                <button
                  className="recipe-carousel__nav recipe-carousel__nav--next"
                  type="button"
                  onClick={() => setActiveImageIndex((current) => (current + 1) % images.length)}
                  aria-label={t("recipe.detail.nextImage")}
                >
                  ›
                </button>
                <div className="recipe-carousel__dots" role="tablist" aria-label={t("recipe.detail.imagesNav")}>
                  {images.map((_, index) => (
                    <button
                      key={index}
                      className={index === activeImageIndex ? "recipe-carousel__dot recipe-carousel__dot--active" : "recipe-carousel__dot"}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={t("recipe.detail.goImage", { index: index + 1 })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className="recipe-title">
          <span className="eyebrow">{t("recipe.detail.eyebrow")}</span>
          <h2>{recipe.name}</h2>
        </div>
        <div className="chip-list">
          {recipe.origin && <span className="chip chip--origin">{recipe.origin}</span>}
          {recipe.tags.map((tag) => (
            <span className="chip" key={tag} style={getTagStyle(tag, tagColorByName)}>
              {tag}
            </span>
          ))}
        </div>
        <div className="meta-list" role="list" aria-label={t("recipe.detail.infoAria")}>
          {hasValue(recipe.servings) && (
            <span className="meta-pill" role="listitem" title={t("recipe.detail.servings")} aria-label={`${recipe.servings} personne(s)`}>
              <Users size={15} />
              <strong>{recipe.servings}</strong>
              <span className="meta-pill__label">{t("recipe.detail.parts")}</span>
            </span>
          )}
          {hasPositiveValue(recipe.prepTime) && (
            <span className="meta-pill" role="listitem" title={t("recipe.detail.prep")} aria-label={`${t("recipe.detail.prep")} ${recipe.prepTime} min`}>
              <ChefHat size={15} />
              <strong>{recipe.prepTime} min</strong>
              <span className="meta-pill__label">{t("recipe.detail.prepShort")}</span>
            </span>
          )}
          {hasPositiveValue(recipe.restTime) && (
            <span className="meta-pill" role="listitem" title={t("recipe.detail.rest")} aria-label={`${t("recipe.detail.rest")} ${recipe.restTime} min`}>
              <Hourglass size={15} />
              <strong>{recipe.restTime} min</strong>
              <span className="meta-pill__label">{t("recipe.detail.rest")}</span>
            </span>
          )}
          {hasPositiveValue(recipe.cookTime) && (
            <span className="meta-pill" role="listitem" title={t("recipe.detail.cook")} aria-label={`${t("recipe.detail.cook")} ${recipe.cookTime} min`}>
              <Flame size={15} />
              <strong>{recipe.cookTime} min</strong>
              <span className="meta-pill__label">{t("recipe.detail.cook")}</span>
            </span>
          )}
          {hasPositiveValue(recipe.totalTime) && (
            <span className="meta-pill" role="listitem" title={t("recipe.detail.total")} aria-label={`${t("recipe.detail.total")} ${recipe.totalTime} min`}>
              <Clock3 size={15} />
              <strong>{recipe.totalTime} min</strong>
              <span className="meta-pill__label">{t("recipe.detail.total")}</span>
            </span>
          )}
        </div>
        <div className="recipe-columns">
          <section>
            <h3>{t("recipe.detail.ingredients")}</h3>
            <ul>
              {recipe.ingredients.map((ingredient) => (
                <li className="ingredient-status-row" key={ingredient.id}>
                  <span>{ingredientLabel(ingredient)}</span>
                  <span className="ingredient-badges">
                    {recipeContainsSeasonalIngredient([ingredient.name], currentSeasonalIngredients()) && (
                      <span className="chip chip--seasonal">{t("recipe.detail.seasonal")}</span>
                    )}
                    {isPantryIngredient(ingredient) && <span className="chip chip--pantry">{t("recipe.detail.pantry")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>{t("recipe.detail.instructions")}</h3>
            <ol>
              {recipe.instructions.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          </section>
        </div>
        {recipe.notes && (
          <section>
            <h3>{t("recipe.detail.notes")}</h3>
            <p>{recipe.notes}</p>
          </section>
        )}
        {recipe.videoUrl && <VideoEmbed url={recipe.videoUrl} />}
        {(recipe.sourceUrl || recipe.videoUrl) && (
          <footer className="link-row">
            {recipe.sourceUrl && <a href={recipe.sourceUrl}>{t("recipe.detail.source")}</a>}
            {recipe.videoUrl && <a href={recipe.videoUrl}>{t("recipe.detail.video")}</a>}
          </footer>
        )}
      </div>
    </article>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const embed = youtubeEmbedUrl(url);
  if (!embed) return null;
  return (
    <section className="recipe-video">
      <iframe
        src={embed}
        title={t("recipe.detail.videoTitle")}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </section>
  );
}

function youtubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function hasValue(value: number | undefined) {
  return value !== undefined && value !== null;
}

function hasPositiveValue(value: number | undefined) {
  return value !== undefined && value > 0;
}
