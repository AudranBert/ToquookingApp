import { useEffect, useId, useRef } from "react";
import { Check, Trash2, X } from "lucide-react";
import { t } from "../i18n";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  promptValue?: string;
  promptReadOnly?: boolean;
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
  promptReadOnly,
  promptSuggestions,
  danger,
  confirmLabel = t("dialog.confirm"),
  cancelLabel = t("dialog.cancel"),
  onPromptValueChange,
  onConfirm,
  onCancel,
}: Props) {
  const datalistId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const card = cardRef.current;
    (card?.querySelector<HTMLElement>("input, button") ?? card)?.focus();
    return () => {
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
        if (event.key !== "Tab") return;
        const controls = cardRef.current?.querySelectorAll<HTMLElement>(
          "input:not([disabled]), button:not([disabled])"
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="panel dialog-card" ref={cardRef} tabIndex={-1}>
        <h3>{title}</h3>
        {message && <p className="dialog-card__message">{message}</p>}
        {typeof promptValue === "string" && (
          <input
            list={promptSuggestions?.length ? datalistId : undefined}
            aria-label={title}
            value={promptValue}
            readOnly={promptReadOnly}
            onFocus={promptReadOnly ? (event) => event.currentTarget.select() : undefined}
            onChange={(event) => onPromptValueChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onConfirm();
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
          <button className="button button--ghost" type="button" onClick={onCancel}>
            <X size={18} /> {cancelLabel}
          </button>
          <button
            className={danger ? "button button--danger" : "button button--primary"}
            type="button"
            onClick={onConfirm}
          >
            {danger ? <Trash2 size={18} /> : <Check size={18} />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
