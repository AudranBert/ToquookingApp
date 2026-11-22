import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import type { TagCategory } from "../hooks/useTags";
import { getTagStyle } from "../utils/tagStyle";
import { displayTagName } from "../utils/tags";
import { t } from "../i18n";

export function TagField({
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
  const formatTag = (value: string) => displayTagName(value);
  const formatCategory = (value: string) =>
    value.toLowerCase() === "tools" ? t("recipe.form.tools") : value;
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
      {t("manage.tags")}
      <div className="tag-field__box">
        {tags.map((tag) => (
          <span className="chip tag-field__chip" key={tag} style={getTagStyle(tag, tagColorByName)}>
            {formatTag(tag)}
            <button
              className="tag-field__remove"
              onClick={() => removeTag(tag)}
              type="button"
              aria-label={`${t("recipe.form.image.remove")} ${tag}`}
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
          placeholder={tags.length === 0 ? t("recipe.form.tags.placeholder") : ""}
        />
      </div>
      {input.trim() && !allTags.some((tag) => tag.toLowerCase() === input.trim().toLowerCase()) && (
        <button
          className="button button--ghost tag-field__create"
          type="button"
          onClick={createGlobalTag}
        >
          <Plus size={16} /> {t("recipe.form.tags.addToList", { name: input.trim() })}
        </button>
      )}
      <datalist id="recipe-tags">
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <details className="tag-manager">
        <summary>{t("recipe.form.tags.globalList")}</summary>
        <div className="tag-reference">
          {categories.map((category) => (
            <div className="tag-reference__group" key={category.name}>
              <strong>{formatCategory(category.name)}</strong>
              <div className="chip-list">
                {category.tags.map((tag) => {
                  const selected = hasTag(tag.name);
                  return (
                    <button
                      className={
                        selected
                          ? "chip tag-reference__chip tag-reference__chip--active"
                          : "chip tag-reference__chip"
                      }
                      key={tag.id}
                      style={selected ? undefined : getTagStyle(tag.name, undefined, tag.color)}
                      onClick={() => {
                        if (selected) {
                          onChange(
                            tags.filter(
                              (existing) => existing.toLowerCase() !== tag.name.toLowerCase()
                            )
                          );
                          return;
                        }
                        onChange([...tags, tag.name]);
                      }}
                      type="button"
                    >
                      {formatTag(tag.name)}
                    </button>
                  );
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
