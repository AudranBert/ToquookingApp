import { Download, FileJson, Upload } from "lucide-react";
import { SeasonalReference } from "../components/SeasonalReference";

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
          <span className="eyebrow">Transfert téléphone / ordinateur</span>
          <h2>Sauvegarde locale</h2>
        </div>
      </div>

      <div className="action-bar">
        <button className="button button--primary" onClick={onExport}>
          <Download size={18} /> Exporter toutes les recettes
        </button>
        <label className="button file-button">
          <Upload size={18} /> Importer une sauvegarde
          <input accept="application/json" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} type="file" />
        </label>
        <button className="button" onClick={onDownloadExample}>
          <FileJson size={18} /> Télécharger un exemple JSON
        </button>
        <button className="button" onClick={onDownloadDatabase}>
          <FileJson size={18} /> Télécharger la base JSON
        </button>
      </div>

      <p className="muted">
        Les fichiers de sauvegarde contiennent toutes les recettes au format JSON. Ils peuvent être envoyés par mail,
        messagerie ou câble USB entre téléphone et ordinateur.
      </p>
      <p className="muted">L'exemple JSON montre le format attendu pour créer des recettes en dehors de l'application puis les importer.</p>
      <p className="muted">La base JSON liste les tags, ingrédients et noms de recettes actuellement disponibles.</p>

      <SeasonalReference />
    </section>
  );
}
