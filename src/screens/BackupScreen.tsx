import { ClipboardCopy, Download, FileJson, Upload } from "lucide-react";
import { SeasonalReference } from "../components/SeasonalReference";
import { t } from "../i18n";

type Props = {
  onExport: () => void;
  onImport: (file: File) => void;
  onDownloadExample: () => void;
  onDownloadDatabase: () => void;
  onStatus: (message: string) => void;
};

const AI_RECIPE_IMPORT_PROMPT = `Extract the recipe from this image and return only valid JSON for a Toquooking backup file.

Use this format:
{
  "version": 1,
  "exportedAt": "2026-07-19T00:00:00.000Z",
  "tags": [
    { "name": "Plat principal", "category": "Type" },
    { "name": "Rapide", "category": "Temps" }
  ],
  "recipes": [
    {
      "name": "",
      "tags": [],
      "origin": "",
      "servings": 4,
      "prepTime": 0,
      "restTime": 0,
      "cookTime": 0,
      "totalTime": 0,
      "ingredients": [
        { "name": "", "quantity": "", "unit": "", "note": "" }
      ],
      "instructions": [],
      "notes": "",
      "sourceUrl": "",
      "videoUrl": "",
      "imageUrl": "",
      "imageUrls": [],
      "sourceImageUrl": "",
      "sourceImageUrls": []
    }
  ]
}

Rules:
- Return JSON only, no markdown.
- Write recipe names, tags, ingredients, notes, and instructions in English.
- Use minutes for prepTime, restTime, cookTime, and totalTime.
- Split ingredients into name, quantity, unit, and note.
- Keep instructions as clear ordered steps.
- If a value is missing or unreadable, leave it empty or omit it.
- Do not invent ingredients or steps.
- Leave image fields empty unless you have a real web image URL.
- Do not add id, createdAt, or updatedAt fields.`;

export function BackupScreen({ onExport, onImport, onDownloadExample, onDownloadDatabase, onStatus }: Props) {
  async function copyAiPrompt() {
    try {
      await copyText(AI_RECIPE_IMPORT_PROMPT);
      onStatus(t("backup.status.aiPromptCopied"));
    } catch {
      onStatus(t("backup.status.aiPromptCopyFailed"));
    }
  }

  return (
    <section className="panel workspace workspace--narrow">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("backup.eyebrow")}</span>
          <h2>{t("backup.title")}</h2>
        </div>
      </div>

      <div className="backup-block">
        <div className="action-bar">
          <button className="button button--primary button--icon-mobile" onClick={onExport}>
            <Download size={18} /> {t("backup.action.exportAll")}
          </button>
          <label className="button file-button backup-import-button button--icon-mobile">
            <Upload size={18} /> {t("backup.action.import")}
            <input
              accept=".zip,.txt,.json,application/zip,text/plain,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
        </div>

        <p className="muted">{t("backup.help.files")}</p>
      </div>

      <div className="backup-block">
        <div className="action-bar">
          <button className="button button--icon-mobile" onClick={onDownloadExample}>
            <FileJson size={18} /> {t("backup.action.downloadExample")}
          </button>
          <button className="button button--icon-mobile" onClick={copyAiPrompt}>
            <ClipboardCopy size={18} /> {t("backup.action.copyAiPrompt")}
          </button>
          <button className="button button--icon-mobile" onClick={onDownloadDatabase}>
            <FileJson size={18} /> {t("backup.action.downloadDatabase")}
          </button>
        </div>

        <p className="muted">{t("backup.help.example")}</p>
        <p className="muted">{t("backup.help.database")}</p>
      </div>

      <SeasonalReference />
    </section>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-10000px";
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Copy failed");
  } finally {
    textarea.remove();
  }
}
