import { Download, Upload } from "lucide-react";
import { SeasonalReference } from "../components/SeasonalReference";

type Props = {
  onExport: () => void;
  onImport: (file: File) => void;
};

export function BackupScreen({ onExport, onImport }: Props) {
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
      </div>

      <p className="muted">
        Les fichiers de sauvegarde contiennent toutes les recettes au format JSON. Ils peuvent être envoyés par mail,
        messagerie ou câble USB entre téléphone et ordinateur.
      </p>

      <SeasonalReference />
    </section>
  );
}
