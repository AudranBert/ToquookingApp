import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { compressImageFile } from "../utils/imageCompression";
import { t } from "../i18n";

export function ImageField({
  values,
  sourceValues,
  onChange,
  onReset,
  onStatus,
  processing,
  onProcessingChange,
}: {
  processing: boolean;
  onProcessingChange: (processing: boolean) => void;
  values: string[];
  sourceValues: string[];
  onChange: (value: string[]) => void;
  onReset: () => void;
  onStatus: (message: string) => void;
}) {
  const [newImageUrl, setNewImageUrl] = useState("");
  const uploadVersion = useRef(0);
  useEffect(
    () => () => {
      uploadVersion.current++;
    },
    []
  );
  const hasImage = values.length > 0;
  const hasCustomImage = values.join("|") !== sourceValues.join("|");

  function addImageUrl() {
    const next = newImageUrl.trim();
    if (!next) return;
    onChange([...values, next]);
    setNewImageUrl("");
  }

  async function handleUpload(file: File | undefined) {
    if (!file || processing) return;
    const version = ++uploadVersion.current;
    onProcessingChange(true);
    try {
      const image = await compressImageFile(file);
      if (version === uploadVersion.current) onChange([...values, image]);
    } catch {
      if (version === uploadVersion.current) onStatus(t("recipe.form.imageReadError"));
    } finally {
      if (version === uploadVersion.current) onProcessingChange(false);
    }
  }

  return (
    <section className="form-section image-field">
      <div className="image-field__header">
        <div>
          <h3>{t("recipe.form.photos")}</h3>
          <p className="muted">{t("recipe.form.photosHint")}</p>
        </div>
        {hasCustomImage && (
          <button
            className="button button--danger button--icon-mobile"
            type="button"
            disabled={processing}
            onClick={onReset}
          >
            <Trash2 size={18} />{" "}
            {sourceValues.length > 0
              ? t("recipe.form.image.resetSource")
              : t("recipe.form.image.remove")}
          </button>
        )}
      </div>

      <fieldset
        className="image-field__body"
        disabled={processing}
        aria-label={t("recipe.form.photos")}
      >
        {hasImage ? (
          <img className="image-field__preview" src={values[0]} alt="" />
        ) : (
          <div className="image-field__empty">
            <ImageIcon size={30} />
          </div>
        )}
        <div className="image-field__controls">
          <label>
            {t("recipe.form.image.urlLabel")}
            <input
              value={newImageUrl}
              placeholder="https://..."
              onChange={(event) => setNewImageUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addImageUrl();
              }}
            />
          </label>
          <button
            className="button"
            type="button"
            disabled={!newImageUrl.trim()}
            onClick={addImageUrl}
          >
            <Plus size={18} /> {t("recipe.form.image.addUrl")}
          </button>
          <label className="image-field__file-label">
            {t("recipe.form.image.device")}
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
          {values.length > 0 && (
            <div className="stack">
              {values.map((imageUrl, index) => (
                <div className="image-field__list-row" key={`${imageUrl}-${index}`}>
                  <input
                    value={imageUrl}
                    onChange={(event) =>
                      onChange(values.map((value, i) => (i === index ? event.target.value : value)))
                    }
                  />
                  <button
                    className="button"
                    type="button"
                    onClick={() => onChange([imageUrl, ...values.filter((_, i) => i !== index)])}
                  >
                    {t("recipe.form.image.main")}
                  </button>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => onChange(values.filter((_, i) => i !== index))}
                  >
                    {t("recipe.form.image.remove")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </fieldset>
      {processing && (
        <p className="muted" role="status">
          {t("recipe.form.image.processing")}
        </p>
      )}
    </section>
  );
}
