import { useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChefHat,
  Clock3,
  Flame,
  GripVertical,
  Hourglass,
  Info,
  Link,
  PenSquare,
  Plus,
  RefreshCcw,
  Replace,
  Text,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TagCategory } from "../hooks/useTags";
import { RECIPE_ORIGINS } from "../origins";
import type { Ingredient, RecipeDraft, ReimportMode } from "../types";
import { createId } from "../utils/id";
import { mergedRecipeImageUrls } from "../utils/images";
import { t } from "../i18n";
import { ImageField } from "../components/ImageField";
import { TagField } from "../components/TagField";

type Props = {
  draft: RecipeDraft;
  importing: boolean;
  saving: boolean;
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
  importing,
  saving,
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
  const [imageProcessing, setImageProcessing] = useState(false);
  const [creationMode, setCreationMode] = useState<"manual" | "url" | "text" | "file">("manual");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ingredientIds = draft.ingredients.map((ingredient) => ingredient.id);
  const instructionIds = draft.instructions.map((_, index) => `instruction-${index}`);

  function updateField<K extends keyof RecipeDraft>(field: K, value: RecipeDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...patch } : ingredient
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
  function reorderIngredients(activeId: string, overId: string) {
    setDraft((current) => {
      const oldIndex = current.ingredients.findIndex((ingredient) => ingredient.id === activeId);
      const newIndex = current.ingredients.findIndex((ingredient) => ingredient.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return current;
      return { ...current, ingredients: arrayMove(current.ingredients, oldIndex, newIndex) };
    });
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
  function reorderInstructions(activeId: string, overId: string) {
    const oldIndex = instructionIds.indexOf(activeId);
    const newIndex = instructionIds.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    setDraft((current) => ({
      ...current,
      instructions: arrayMove(current.instructions, oldIndex, newIndex),
    }));
  }
  function handleIngredientDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderIngredients(String(active.id), String(over.id));
  }
  function handleInstructionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderInstructions(String(active.id), String(over.id));
  }

  function setImageOverride(imageUrls: string[]) {
    const next = mergedRecipeImageUrls({ imageUrls });
    setDraft((current) => ({
      ...current,
      imageUrl: next[0],
      imageUrls: next,
      sourceImageUrl:
        current.sourceImageUrl ??
        (current.imageUrl && current.sourceUrl ? current.imageUrl : undefined),
      sourceImageUrls:
        current.sourceImageUrls ??
        mergedRecipeImageUrls({
          imageUrl: current.sourceImageUrl ?? current.imageUrl,
          imageUrls: current.imageUrls,
        }),
    }));
  }

  function resetImageOverride() {
    setDraft((current) => {
      const sourceImages = mergedRecipeImageUrls({
        imageUrl: current.sourceImageUrl ?? current.imageUrl,
        imageUrls: current.sourceImageUrls,
      });
      return {
        ...current,
        imageUrl: sourceImages[0],
        imageUrls: sourceImages,
        sourceImageUrl: sourceImages[0],
        sourceImageUrls: sourceImages,
      };
    });
  }

  return (
    <form
      className="panel workspace recipe-form"
      aria-busy={saving}
      onSubmit={(event) => {
        if (imageProcessing || saving) event.preventDefault();
        else onSubmit(event);
      }}
    >
      <div className="section-heading">
        <div className="recipe-form__title-wrap">
          <span className="eyebrow">
            {editing ? t("recipe.form.editing") : t("recipe.form.new")}
          </span>
          <h2 className="recipe-form__title">{draft.name || t("recipe.form.untitled")}</h2>
        </div>
        <div className="action-bar recipe-form__actions">
          <button
            className="button button--ghost button--icon-mobile"
            onClick={onCancel}
            type="button"
            aria-label={t("recipe.form.cancel")}
          >
            <X size={18} />
          </button>
          <button
            className="button button--primary button--icon-mobile"
            type="submit"
            disabled={imageProcessing || importing || saving}
          >
            <Check size={18} /> {t(saving ? "recipe.form.saving" : "recipe.form.save")}
          </button>
        </div>
      </div>

      {!editing && (
        <section className="form-section form-section--import">
          <div
            className="creation-mode-tabs"
            role="group"
            aria-label={t("recipe.form.creationMode")}
          >
            <button
              className={creationMode === "manual" ? "button button--primary" : "button"}
              type="button"
              aria-pressed={creationMode === "manual"}
              onClick={() => setCreationMode("manual")}
            >
              <PenSquare size={16} />{" "}
              <span className="creation-mode-tabs__label">{t("recipe.form.mode.manual")}</span>
            </button>
            <button
              className={creationMode === "url" ? "button button--primary" : "button"}
              type="button"
              aria-pressed={creationMode === "url"}
              onClick={() => setCreationMode("url")}
            >
              <Link size={16} />{" "}
              <span className="creation-mode-tabs__label">{t("recipe.form.mode.url")}</span>
            </button>
            <button
              className={creationMode === "text" ? "button button--primary" : "button"}
              type="button"
              aria-pressed={creationMode === "text"}
              onClick={() => setCreationMode("text")}
            >
              <Text size={16} />{" "}
              <span className="creation-mode-tabs__label">{t("recipe.form.mode.text")}</span>
            </button>
            <button
              className={creationMode === "file" ? "button button--primary" : "button"}
              type="button"
              aria-pressed={creationMode === "file"}
              onClick={() => setCreationMode("file")}
            >
              <Upload size={16} />{" "}
              <span className="creation-mode-tabs__label">{t("recipe.form.mode.file")}</span>
            </button>
          </div>

          {creationMode === "url" && (
            <>
              <label htmlFor="new-recipe-import-url">{t("recipe.form.importFromUrl")}</label>
              <div className="inline-control">
                <input
                  id="new-recipe-import-url"
                  value={importUrl}
                  onChange={(event) => onImportUrlChange(event.target.value)}
                  placeholder={t("recipe.form.importUrlPlaceholder")}
                />
                <button
                  className="button button--primary button--icon-mobile"
                  onClick={onImport}
                  disabled={importing || !importUrl.trim()}
                  type="button"
                >
                  <Link size={18} /> {t("recipe.form.import")}
                </button>
                <button
                  aria-label={t("recipe.form.importSupport")}
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
                <textarea
                  id="new-recipe-import-text"
                  value={importText}
                  onChange={(event) => onImportTextChange(event.target.value)}
                  placeholder={t("recipe.form.importTextPlaceholder")}
                />
                <button
                  className="button button--primary"
                  onClick={onImportText}
                  disabled={importing || !importText.trim()}
                  type="button"
                >
                  {t("recipe.form.importTextAction")}
                </button>
              </div>
            </>
          )}

          {creationMode === "file" && (
            <div className="text-import-control">
              <label className="button button--ghost file-button">
                <Upload size={18} /> {t("recipe.form.importFileAction")}
                <input
                  accept=".zip,.json,.txt,application/zip,application/json,text/plain"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImportFile(file);
                    event.currentTarget.value = "";
                  }}
                  className="visually-hidden"
                />
              </label>
              <p className="muted">{t("recipe.form.importFileHint")}</p>
            </div>
          )}
        </section>
      )}

      {(editing || creationMode === "url") && (
        <ReimportControls
          importing={importing}
          sourceUrl={draft.sourceUrl ?? ""}
          onSourceUrlChange={(sourceUrl) => updateField("sourceUrl", sourceUrl)}
          onReimport={onReimport}
        />
      )}

      {importing && (
        <p className="muted" role="status">
          {t("import.status.urlLoading")}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="notice notice--warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="form-grid">
        <TextField
          label={t("recipe.form.name")}
          value={draft.name}
          required
          onChange={(name) => updateField("name", name)}
        />
        <TagField
          tags={draft.tags}
          allTags={allTags}
          categories={categories}
          tagColorByName={tagColorByName}
          onCreateTag={onCreateTag}
          onChange={(tags) => updateField("tags", tags)}
        />
        <label>
          {t("recipe.form.origin")}
          <input
            list="recipe-origins"
            value={draft.origin ?? ""}
            onChange={(event) => updateField("origin", event.target.value)}
            placeholder={t("recipe.form.originPlaceholder")}
          />
        </label>
        <datalist id="recipe-origins">
          {RECIPE_ORIGINS.map((origin) => (
            <option key={origin} value={origin} />
          ))}
        </datalist>
        <TextField
          label={t("recipe.form.video")}
          value={draft.videoUrl ?? ""}
          onChange={(videoUrl) => updateField("videoUrl", videoUrl)}
        />
        <div className="timing-grid form-grid__full" aria-label={t("recipe.form.timingAria")}>
          <TextIconField
            label={t("recipe.detail.parts")}
            icon={Users}
            value={draft.servings ?? ""}
            onChange={(servings) => updateField("servings", servings)}
          />
          <NumberField
            label={t("recipe.detail.prepShort")}
            icon={ChefHat}
            value={draft.prepTime}
            onChange={(prepTime) => updateField("prepTime", prepTime)}
          />
          <NumberField
            label={t("recipe.detail.rest")}
            icon={Hourglass}
            value={draft.restTime}
            onChange={(restTime) => updateField("restTime", restTime)}
          />
          <NumberField
            label={t("recipe.detail.cook")}
            icon={Flame}
            value={draft.cookTime}
            onChange={(cookTime) => updateField("cookTime", cookTime)}
          />
          <NumberField
            label={t("recipe.detail.total")}
            icon={Clock3}
            value={draft.totalTime}
            onChange={(totalTime) => updateField("totalTime", totalTime)}
          />
        </div>
      </div>

      <ImageField
        processing={imageProcessing}
        onProcessingChange={setImageProcessing}
        values={mergedRecipeImageUrls({ imageUrl: draft.imageUrl, imageUrls: draft.imageUrls })}
        sourceValues={mergedRecipeImageUrls({
          imageUrl: draft.sourceImageUrl,
          imageUrls: draft.sourceImageUrls,
        })}
        onChange={setImageOverride}
        onReset={resetImageOverride}
        onStatus={onStatus}
      />

      <section className="form-section">
        <h3>{t("recipe.detail.ingredients")}</h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleIngredientDragEnd}
        >
          <SortableContext items={ingredientIds} strategy={verticalListSortingStrategy}>
            <div className="stack">
              {draft.ingredients.map((ingredient) => (
                <IngredientRow
                  key={ingredient.id}
                  id={ingredient.id}
                  ingredient={ingredient}
                  onChange={(patch) => updateIngredient(ingredient.id, patch)}
                  onRemove={() => removeIngredient(ingredient.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button className="button button--ghost" onClick={addIngredient} type="button">
          <Plus size={18} /> {t("recipe.form.addIngredient")}
        </button>
      </section>

      <section className="form-section">
        <h3>{t("recipe.detail.instructions")}</h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleInstructionDragEnd}
        >
          <SortableContext items={instructionIds} strategy={verticalListSortingStrategy}>
            <div className="stack">
              {draft.instructions.map((step, index) => (
                <InstructionRow
                  key={index}
                  id={instructionIds[index]}
                  step={step}
                  index={index}
                  onChange={(value) => updateInstruction(index, value)}
                  onRemove={() => removeInstruction(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button className="button button--ghost" onClick={addInstruction} type="button">
          <Plus size={18} /> {t("recipe.form.addStep")}
        </button>
      </section>

      <label>
        {t("recipe.detail.notes")}
        <textarea
          value={draft.notes ?? ""}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </label>
      <div className="action-bar recipe-form__footer">
        <button className="button button--ghost" type="button" onClick={onCancel}>
          {t("recipe.form.cancel")}
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={imageProcessing || importing || saving}
        >
          <Check size={18} /> {t(saving ? "recipe.form.saving" : "recipe.form.save")}
        </button>
      </div>
    </form>
  );
}

function ReimportControls({
  importing,
  sourceUrl,
  onSourceUrlChange,
  onReimport,
}: {
  importing: boolean;
  sourceUrl: string;
  onSourceUrlChange: (value: string) => void;
  onReimport: (mode: ReimportMode) => void;
}) {
  return (
    <div className="reimport-bar">
      <TextField
        label={t("recipe.form.sourceUrl")}
        value={sourceUrl}
        onChange={onSourceUrlChange}
      />
      <button
        className="button button--icon-mobile"
        onClick={() => onReimport("fill-blanks")}
        disabled={importing || !sourceUrl.trim()}
        type="button"
      >
        <RefreshCcw size={18} /> {t("recipe.form.reimport.fillBlanks")}
      </button>
      <button
        className="button button--ghost button--icon-mobile"
        onClick={() => onReimport("replace")}
        disabled={importing || !sourceUrl.trim()}
        type="button"
      >
        <Replace size={18} /> {t("recipe.form.reimport.replace")}
      </button>
    </div>
  );
}

function IngredientRow({
  id,
  ingredient,
  onChange,
  onRemove,
}: {
  id: string;
  ingredient: Ingredient;
  onChange: (patch: Partial<Ingredient>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "ingredient-line ingredient-line--dragging" : "ingredient-line"}
    >
      <input
        aria-label={t("recipe.form.ingredient.quantity")}
        placeholder={t("recipe.form.ingredient.quantity")}
        value={ingredient.quantity ?? ""}
        onChange={(event) => onChange({ quantity: event.target.value })}
      />
      <input
        aria-label={t("recipe.form.ingredient.unit")}
        placeholder={t("recipe.form.ingredient.unit")}
        value={ingredient.unit ?? ""}
        onChange={(event) => onChange({ unit: event.target.value })}
      />
      <input
        aria-label={t("recipe.form.ingredient.name")}
        placeholder={t("recipe.form.ingredient.name")}
        value={ingredient.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <RowActions attributes={attributes} listeners={listeners} onRemove={onRemove} />
    </div>
  );
}

function InstructionRow({
  id,
  step,
  index,
  onChange,
  onRemove,
}: {
  id: string;
  step: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "step-line step-line--dragging" : "step-line"}
    >
      <textarea
        aria-label={`${t("recipe.form.step")} ${index + 1}`}
        value={step}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${t("recipe.form.step")} ${index + 1}`}
      />
      <RowActions attributes={attributes} listeners={listeners} onRemove={onRemove} />
    </div>
  );
}

function RowActions({
  attributes,
  listeners,
  onRemove,
}: {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  onRemove: () => void;
}) {
  return (
    <div className="row-actions">
      <button
        className="button button--icon row-actions__drag"
        type="button"
        title={t("recipe.form.reorder")}
        aria-label={t("recipe.form.reorder")}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button
        className="button button--icon ingredient-line__remove"
        onClick={onRemove}
        type="button"
        title={t("recipe.form.image.remove")}
        aria-label={t("recipe.form.image.remove")}
      >
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
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
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
      <input
        min="0"
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : Number(event.target.value))
        }
      />
    </label>
  );
}

function TextIconField({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: string | number;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="number-field" aria-label={label}>
      <span className="number-field__label">
        <Icon size={16} />
        <span className="number-field__label-text">{label}</span>
      </span>
      <input
        value={String(value)}
        inputMode="text"
        placeholder="4, 4kg, 2L"
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </label>
  );
}
