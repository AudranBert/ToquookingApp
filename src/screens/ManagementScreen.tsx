import { useMemo, useState } from "react";
import { GitMerge, Pencil, Trash2 } from "lucide-react";
import { SectionToggleHeader } from "../components/SectionToggleHeader";
import { t } from "../i18n";
import type { IngredientUsage } from "../hooks/useIngredientsManagement";
import type { TagCategory } from "../hooks/useTags";
import type { RecipeTag } from "../types";

type Props = {
  tags: RecipeTag[];
  categories: TagCategory[];
  protectedTags: readonly string[];
  onCreateTag: (name: string, category?: string) => Promise<unknown>;
  onRenameTag: (oldName: string, newName: string) => Promise<unknown>;
  onMergeTags: (sourceName: string, targetName: string) => Promise<unknown>;
  onDeleteTag: (name: string) => Promise<unknown>;
  onUpdateTagMeta: (name: string, meta: { category?: string; color?: string }) => Promise<unknown>;
  ingredients: IngredientUsage[];
  onRenameIngredient: (oldName: string, newName: string) => Promise<unknown>;
  onMergeIngredients: (sourceName: string, targetName: string) => Promise<unknown>;
  onDeleteIngredient: (name: string) => Promise<unknown>;
};

export function ManagementScreen({
  tags,
  categories,
  protectedTags,
  onCreateTag,
  onRenameTag,
  onMergeTags,
  onDeleteTag,
  onUpdateTagMeta,
  ingredients,
  onRenameIngredient,
  onMergeIngredients,
  onDeleteIngredient,
}: Props) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");
  const [tagsVisible, setTagsVisible] = useState(true);
  const [ingredientsVisible, setIngredientsVisible] = useState(false);
  const protectedSet = useMemo(() => new Set(protectedTags.map((tag) => tag.toLowerCase())), [protectedTags]);
  const categoryOptions = useMemo(() => [...new Set(categories.map((category) => category.name))], [categories]);

  async function setCategoryColor(category: TagCategory, color: string) {
    await Promise.all(category.tags.map((tag) => onUpdateTagMeta(tag.name, { category: tag.category, color })));
  }

  return (
    <section className="workspace panel management-screen">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("manage.eyebrow")}</span>
          <h2>{t("manage.title")}</h2>
        </div>
      </div>

      <section className="form-section">
        <SectionToggleHeader className="management-section-title" open={tagsVisible} onToggle={() => setTagsVisible((c) => !c)} title={<h3>{t("manage.tags")}</h3>} />
        {tagsVisible && (
          <>
            <div className="management-row">
              <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Nom du tag" />
              <input list="management-categories" value={newTagCategory} onChange={(event) => setNewTagCategory(event.target.value)} placeholder="Catégorie" />
              <button className="button button--primary" type="button" onClick={async () => { await onCreateTag(newTagName, newTagCategory); setNewTagName(""); }}>
                {t("manage.tag.create")}
              </button>
            </div>
            <datalist id="management-categories">{categoryOptions.map((category) => <option key={category} value={category} />)}</datalist>
            <div className="management-categories">
              {categories.map((category) => (
                <details className="panel management-category" key={category.name} open>
                  <summary className="management-category__summary">
                    <div className="management-category__title">
                      <strong>{category.name}</strong>
                      <span className="muted">{category.tags.length} tag(s)</span>
                    </div>
                    <label className="management-category__color" onClick={(event) => event.stopPropagation()}>
                      {t("manage.tag.categoryColor")}
                      <input type="color" value={category.color ?? "#f6ead8"} onChange={(event) => void setCategoryColor(category, event.target.value)} />
                    </label>
                  </summary>
                  <div className="management-tags-grid">
                    {category.tags.map((tag) => (
                      <TagRow key={tag.id} tag={tag} allTags={tags} protectedTag={protectedSet.has(tag.name.toLowerCase())} onRenameTag={onRenameTag} onMergeTags={onMergeTags} onDeleteTag={onDeleteTag} onUpdateTagMeta={onUpdateTagMeta} />
                    ))}
                  </div>
                </details>
              ))}
              {categories.length === 0 && <p className="muted">{t("manage.empty.tags")}</p>}
            </div>
          </>
        )}
      </section>

      <section className="form-section">
        <SectionToggleHeader className="management-section-title" open={ingredientsVisible} onToggle={() => setIngredientsVisible((c) => !c)} title={<h3>{t("manage.ingredients")}</h3>} />
        {ingredientsVisible && (
          <div className="stack">
            {ingredients.map((ingredient) => (
              <div className="panel management-line" key={ingredient.name}>
                <span>{ingredient.name} <span className="muted">({ingredient.usageCount})</span></span>
                <div className="action-bar">
                  <button className="button button--ghost management-action-button" type="button" onClick={async () => { const next = window.prompt(t("manage.prompt.newName"), ingredient.name); if (next) await onRenameIngredient(ingredient.name, next); }}>
                    <Pencil size={16} /><span className="management-action-button__label">{t("manage.tag.rename")}</span>
                  </button>
                  <button className="button button--ghost management-action-button" type="button" onClick={async () => { const target = window.prompt(t("manage.prompt.mergeTo", { name: ingredient.name }), ""); if (target) await onMergeIngredients(ingredient.name, target); }}>
                    <GitMerge size={16} /><span className="management-action-button__label">{t("manage.tag.merge")}</span>
                  </button>
                  <button className="button button--danger management-action-button" type="button" onClick={async () => { if (!window.confirm(t("manage.confirm.deleteIngredientGlobal", { name: ingredient.name }))) return; await onDeleteIngredient(ingredient.name); }}>
                    <Trash2 size={16} /><span className="management-action-button__label">{t("manage.tag.delete")}</span>
                  </button>
                </div>
              </div>
            ))}
            {ingredients.length === 0 && <p className="muted">{t("manage.empty.ingredients")}</p>}
          </div>
        )}
      </section>
    </section>
  );
}

function TagRow({ tag, allTags, protectedTag, onRenameTag, onMergeTags, onDeleteTag, onUpdateTagMeta }: {
  tag: RecipeTag;
  allTags: RecipeTag[];
  protectedTag: boolean;
  onRenameTag: (oldName: string, newName: string) => Promise<unknown>;
  onMergeTags: (sourceName: string, targetName: string) => Promise<unknown>;
  onDeleteTag: (name: string) => Promise<unknown>;
  onUpdateTagMeta: (name: string, meta: { category?: string; color?: string }) => Promise<unknown>;
}) {
  return (
    <div className="panel management-tag-card">
      <span className="management-tag-name">{tag.name}{tag.color && <span className="chip" style={{ background: tag.color, color: "#111", borderColor: tag.color }} />}</span>
      <div className="action-bar">
        <select value={tag.category ?? ""} onChange={(event) => void onUpdateTagMeta(tag.name, { category: event.target.value, color: tag.color })}>
          <option value="">{t("manage.tag.none")}</option>
          {allTags.map((item) => item.category).filter((category, index, source) => Boolean(category) && source.indexOf(category) === index).map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <button className="button button--ghost management-action-button" type="button" onClick={async () => { const next = window.prompt(t("manage.prompt.newName"), tag.name); if (next) await onRenameTag(tag.name, next); }}>
          <Pencil size={16} /><span className="management-action-button__label">{t("manage.tag.rename")}</span>
        </button>
        <button className="button button--ghost management-action-button" type="button" onClick={async () => { const target = window.prompt(t("manage.prompt.mergeTo", { name: tag.name }), ""); if (target) await onMergeTags(tag.name, target); }}>
          <GitMerge size={16} /><span className="management-action-button__label">{t("manage.tag.merge")}</span>
        </button>
        <button className="button button--danger management-action-button" type="button" disabled={protectedTag} onClick={async () => { if (!window.confirm(t("manage.confirm.deleteTagGlobal", { name: tag.name }))) return; await onDeleteTag(tag.name); }}>
          <Trash2 size={16} /><span className="management-action-button__label">{t("manage.tag.delete")}</span>
        </button>
      </div>
    </div>
  );
}
