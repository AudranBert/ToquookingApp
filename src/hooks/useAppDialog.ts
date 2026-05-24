import { useCallback, useState } from "react";

type DialogState = {
  open: boolean;
  title: string;
  message?: string;
  promptValue?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve?: (value: any) => void;
};

const CLOSED: DialogState = { open: false, title: "" };

export function useAppDialog() {
  const [state, setState] = useState<DialogState>(CLOSED);

  const confirm = useCallback((title: string, message?: string, danger = false) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, title, message, danger, resolve, confirmLabel: "Confirmer", cancelLabel: "Annuler" });
    });
  }, []);

  const prompt = useCallback((title: string, defaultValue = "", message?: string) => {
    return new Promise<string | null>((resolve) => {
      setState({
        open: true,
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
      current.resolve?.(result);
      return CLOSED;
    });
  }, []);

  return {
    dialogState: state,
    setPromptValue: (value: string) => setState((current) => ({ ...current, promptValue: value })),
    confirm,
    prompt,
    closeWith,
  };
}
