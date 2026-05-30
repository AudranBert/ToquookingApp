import { BookOpen, Import, Plus, ShoppingBasket, Tags } from "lucide-react";
import { t } from "../i18n";
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
        <span className="eyebrow">{t("app.devLabel")}</span>
        <button className="app-title" onClick={onShowRecipes} type="button">
          {t("app.title")}
        </button>
      </div>
      <nav className="nav-tabs" aria-label="Navigation principale">
        <button
          className={activePanel === "library" ? "button button--primary button--icon-mobile" : "button button--icon-mobile"}
          onClick={() => onPanelChange("library")}
        >
          <BookOpen size={18} /> {t("app.nav.library")}
        </button>
        <button
          className={activePanel === "form" ? "button button--primary button--icon-mobile" : "button button--icon-mobile"}
          onClick={onNewRecipe}
        >
          <Plus size={18} /> {t("app.nav.add")}
        </button>
        <button
          className={activePanel === "shopping" ? "button button--primary button--icon-mobile" : "button button--icon-mobile"}
          onClick={() => onPanelChange("shopping")}
        >
          <ShoppingBasket size={18} /> {t("app.nav.shopping")}
        </button>
        <button
          className={activePanel === "backup" ? "button button--primary button--icon-mobile" : "button button--icon-mobile"}
          onClick={() => onPanelChange("backup")}
        >
          <Import size={18} /> {t("app.nav.backup")}
        </button>
        <button
          className={activePanel === "management" ? "button button--primary button--icon-mobile" : "button button--icon-mobile"}
          onClick={() => onPanelChange("management")}
        >
          <Tags size={18} /> {t("app.nav.manage")}
        </button>
      </nav>
    </header>
  );
}
