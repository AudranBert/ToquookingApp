import { Download, FileJson, Upload } from "lucide-react";
import { SeasonalReference } from "../components/SeasonalReference";
import { t } from "../i18n";

type Props = {
  onExport: () => void;
  onImport: (file: File) => void;
  onDownloadExample: () => void;
  onDownloadDatabase: () => void;
};

export function BackupScreen({ onExport, onImport, onDownloadExample, onDownloadDatabase }: Props) {
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
              accept=".txt,.toquooking,.json,text/plain,application/json"
              onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])}
              type="file"
            />
          </label>
        </div>

        <p className="muted">
          Les fichiers de sauvegarde contiennent toutes les recettes au format texte (.txt). Ils peuvent être envoyés par mail,
          messagerie ou câble USB entre téléphone et ordinateur.
        </p>
      </div>

      <div className="backup-block">
        <div className="action-bar">
          <button className="button button--icon-mobile" onClick={onDownloadExample}>
            <FileJson size={18} /> {t("backup.action.downloadExample")}
          </button>
          <button className="button button--icon-mobile" onClick={onDownloadDatabase}>
            <FileJson size={18} /> {t("backup.action.downloadDatabase")}
          </button>
        </div>

        <p className="muted">L'exemple JSON montre le format attendu pour créer des recettes en dehors de l'application puis les importer.</p>
        <p className="muted">La base JSON liste les tags, ingrédients et noms de recettes actuellement disponibles.</p>
      </div>

      <SeasonalReference />
    </section>
  );
}
