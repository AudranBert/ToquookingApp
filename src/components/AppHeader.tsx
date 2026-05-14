import { BookOpen, Import, Plus, ShoppingBasket } from "lucide-react";
import type { Panel } from "../types";

type Props = {
  activePanel: Panel;
  onPanelChange: (panel: Panel) => void;
  onNewRecipe: () => void;
};

export function AppHeader({ activePanel, onPanelChange, onNewRecipe }: Props) {
  return (
    <header className="app-header">
      <div>
        <span className="eyebrow">Carnet local-first</span>
        <h1>Toque</h1>
      </div>
      <nav className="nav-tabs" aria-label="Navigation principale">
        <button
          className={activePanel === "library" ? "button button--primary" : "button"}
          onClick={() => onPanelChange("library")}
        >
          <BookOpen size={18} /> Recettes
        </button>
        <button
          className={activePanel === "form" ? "button button--primary" : "button"}
          onClick={onNewRecipe}
        >
          <Plus size={18} /> Ajouter
        </button>
        <button
          className={activePanel === "shopping" ? "button button--primary" : "button"}
          onClick={() => onPanelChange("shopping")}
        >
          <ShoppingBasket size={18} /> Courses
        </button>
        <button
          className={activePanel === "backup" ? "button button--primary" : "button"}
          onClick={() => onPanelChange("backup")}
        >
          <Import size={18} /> Sauvegarde
        </button>
      </nav>
    </header>
  );
}
