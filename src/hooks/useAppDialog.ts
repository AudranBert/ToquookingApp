import { useCallback, useState } from "react";

type DialogBase = {
  open: boolean;
  title: string;
  message?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmDialogState = DialogBase & {
  kind: "confirm";
  resolve?: (value: boolean) => void;
};

type PromptDialogState = DialogBase & {
  kind: "prompt";
  promptValue: string;
  resolve?: (value: string | null) => void;
};

type ClosedDialogState = { open: false; title: ""; kind?: undefined };

type DialogState = ClosedDialogState | ConfirmDialogState | PromptDialogState;

const CLOSED: ClosedDialogState = { open: false, title: "" };

export function useAppDialog() {
  const [state, setState] = useState<DialogState>(CLOSED);

  const confirm = useCallback((title: string, message?: string, danger = false) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, kind: "confirm", title, message, danger, resolve, confirmLabel: "Confirmer", cancelLabel: "Annuler" });
    });
  }, []);

  const prompt = useCallback((title: string, defaultValue = "", message?: string) => {
    return new Promise<string | null>((resolve) => {
      setState({
        open: true,
        kind: "prompt",
        title,
        message,
        promptValue: defaultValue,
        resolve,
        confirmLabel: "Valider",
        cancelLabel: "Annuler",
      });
    });
  }, []);

  const closeWith = useCallback((result: boolean | string | null) => {
    setState((current) => {
      if (current.kind === "confirm") {
        current.resolve?.(Boolean(result));
      } else if (current.kind === "prompt") {
        current.resolve?.(typeof result === "string" || result === null ? result : null);
      }
      return CLOSED;
    });
  }, []);

  return {
    dialogState: state,
    setPromptValue: (value: string) =>
      setState((current) => (current.kind === "prompt" ? { ...current, promptValue: value } : current)),
    confirm,
    prompt,
    closeWith,
  };
}
