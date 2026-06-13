import { useId } from "react";
import { Check, Trash2, X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  promptValue?: string;
  promptSuggestions?: string[];
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onPromptValueChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AppDialog({
  open,
  title,
  message,
  promptValue,
  promptSuggestions,
  danger,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onPromptValueChange,
  onConfirm,
  onCancel,
}: Props) {
  const datalistId = useId();
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel dialog-card">
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        {typeof promptValue === "string" && (
          <input
            autoFocus
            list={promptSuggestions?.length ? datalistId : undefined}
            value={promptValue}
            onChange={(event) => onPromptValueChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onConfirm();
              if (event.key === "Escape") onCancel();
            }}
          />
        )}
        {promptSuggestions?.length ? (
          <datalist id={datalistId}>
            {promptSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        ) : null}
        <div className="action-bar dialog-actions">
          <button className="button button--ghost button--icon-mobile" type="button" onClick={onCancel}>
            <X size={18} /> {cancelLabel}
          </button>
          <button className={danger ? "button button--danger button--icon-mobile" : "button button--primary button--icon-mobile"} type="button" onClick={onConfirm}>
            {danger ? <Trash2 size={18} /> : <Check size={18} />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
