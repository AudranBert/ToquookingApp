import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  rightSlot?: ReactNode;
  className?: string;
};

export function SectionToggleHeader({ title, open, onToggle, rightSlot, className }: Props) {
  return (
    <div className={className ?? "section-toggle-header"}>
      <span>{title}</span>
      <button
        className="section-toggle-header__toggle"
        type="button"
        onClick={onToggle}
        aria-label={open ? "Masquer la section" : "Afficher la section"}
      >
        {open ? "-" : "+"}
      </button>
      {rightSlot}
    </div>
  );
}
