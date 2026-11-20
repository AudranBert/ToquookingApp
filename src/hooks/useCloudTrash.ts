import { useCallback, useEffect, useRef, useState } from "react";
import { cloudTarget, readCloudSettings, type CloudSettings } from "../cloud/settings";
import {
  emptyCloudTrash,
  listCloudTrash,
  purgeCloudRecipe,
  restoreCloudRecipe,
} from "../cloud/trash";
import { flushCloudQueue } from "../cloud/queue";
import type { CloudTrashEntry } from "../cloud/types";
import { t } from "../i18n";

export function useCloudTrash(
  settings: CloudSettings,
  refresh: () => Promise<unknown>,
  onStatus: (message: string) => void
) {
  const target = cloudTarget(settings);
  const [entries, setEntries] = useState<CloudTrashEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const operationRunning = useRef(false);

  useEffect(() => {
    requestVersion.current++;
    setEntries([]);
    setLoaded(false);
    setLoading(false);
    setError(false);
    setOperation(null);
  }, [target]);

  const load = useCallback(async () => {
    const snapshot = readCloudSettings();
    if (!target || cloudTarget(snapshot) !== target) return;
    const version = ++requestVersion.current;
    const current = () => version === requestVersion.current && cloudTarget() === target;
    setLoading(true);
    setError(false);
    try {
      // A just-deleted recipe should appear even before the automatic retry runs.
      await flushCloudQueue().catch(() => undefined);
      if (!current()) return;
      const recipes = await listCloudTrash(snapshot);
      if (current()) {
        setEntries(recipes);
        setLoaded(true);
      }
    } catch {
      if (current()) setError(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [target]);

  async function perform(action: "restore" | "purge" | "empty", id?: string) {
    if (operationRunning.current || !target || cloudTarget() !== target) return;
    operationRunning.current = true;
    requestVersion.current++;
    const snapshot = readCloudSettings();
    setOperation(`${action}:${id ?? ""}`);
    setLoading(false);
    setError(false);
    try {
      let appliedLocally = true;
      if (action === "restore" && id) {
        appliedLocally = await restoreCloudRecipe(id, snapshot);
        if (cloudTarget() !== target) return;
        await refresh();
      } else if (action === "purge" && id) {
        await purgeCloudRecipe(id, snapshot);
      } else if (action === "empty") {
        await emptyCloudTrash(snapshot);
      }
      if (cloudTarget() !== target) return;
      setEntries((previous) =>
        action === "empty" ? [] : previous.filter((entry) => entry.id !== id)
      );
      onStatus(
        t(
          action === "restore"
            ? appliedLocally
              ? "cloud.trashRestored"
              : "cloud.trashRestoredLocalPreserved"
            : action === "purge"
              ? "cloud.trashPurged"
              : "cloud.trashEmptied"
        )
      );
      await load();
    } catch {
      if (cloudTarget() === target) {
        onStatus(t("cloud.trashActionFailed"));
        await load();
      }
    } finally {
      operationRunning.current = false;
      if (cloudTarget() === target) setOperation(null);
    }
  }

  return {
    entries,
    loaded,
    loading,
    error,
    operation,
    busy: operation !== null,
    load,
    restore: (id: string) => perform("restore", id),
    purge: (id: string) => perform("purge", id),
    empty: () => perform("empty"),
  };
}
