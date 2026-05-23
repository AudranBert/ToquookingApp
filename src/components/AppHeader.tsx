import { BookOpen, Import, Plus, ShoppingBasket, Tags } from "lucide-react";
import type { Panel } from "../types";

type Props = {
  activePanel: Panel;
  onPanelChange: (panel: Panel) => void;
  onShowRecipes: () => void;
  onNewRecipe: () => void;
};

export function AppHeader({ activePanel, onPanelChange, onShowRecipes, onNewRecipe }: Props) {
  return (
    <header className="app-header">
      <div>
        <span className="eyebrow">Carnet local de recettes - DEV</span>
        <button className="app-title" onClick={onShowRecipes} type="button">
          Toquooking
        </button>
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
        <button
          className={activePanel === "management" ? "button button--primary" : "button"}
          onClick={() => onPanelChange("management")}
        >
          <Tags size={18} /> Gérer
        </button>
      </nav>
    </header>
  );
}
