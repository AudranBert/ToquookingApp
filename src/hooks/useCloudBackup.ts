import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db";
import { checkCloudHealth } from "../cloud/client";
import { startHealthPolling } from "../cloud/healthMonitor";
import {
  cloudTarget,
  initializeCloudSettings,
  getDefaultCloudServer,
  loadCloudDefaults,
  readCloudSettings,
  writeCloudSettings,
  type CloudSettings,
} from "../cloud/settings";
import { downloadCloudRecipes, flushCloudQueue, uploadLocalRecipes } from "../cloud/sync";
import type { CloudHealth } from "../cloud/types";
import { t } from "../i18n";

export function useCloudBackup(
  refresh: () => Promise<unknown>,
  onStatus: (message: string) => void,
  monitorConnection = false
) {
  const [settings, setSettings] = useState(readCloudSettings);
  const [health, setHealth] = useState<CloudHealth>({ server: false, database: false });
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [defaultApiUrl, setDefaultApiUrl] = useState(getDefaultCloudServer);

  const check = useCallback(async () => {
    setChecking(true);
    const apiUrl = readCloudSettings().apiUrl;
    const nextHealth = await checkCloudHealth();
    if (readCloudSettings().apiUrl === apiUrl) setHealth(nextHealth);
    setChecking(false);
  }, []);

  useEffect(() => {
    const changed = () => setSettings(readCloudSettings());
    window.addEventListener("toque-cloud-settings", changed);
    window.addEventListener("storage", changed);
    initializeCloudSettings();
    void loadCloudDefaults().then(setDefaultApiUrl);
    return () => {
      window.removeEventListener("toque-cloud-settings", changed);
      window.removeEventListener("storage", changed);
    };
  }, []);

  // Monitor independently of uploads: a waking server must not block the badges.
  useEffect(() => {
    if (!settings.apiUrl) {
      setHealth({ server: false, database: false });
      return;
    }
    if (!monitorConnection) return;
    return startHealthPolling(check);
  }, [settings.apiUrl, monitorConnection, check]);

  useEffect(() => {
    const target = cloudTarget(settings);
    if (!settings.apiUrl) {
      setPending(0);
      setHealth({ server: false, database: false });
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let debounce: ReturnType<typeof setTimeout>;
    const retry = async () => {
      try {
        await flushCloudQueue();
      } catch {
        /* Keep durable mutations for the next attempt. */
      }
      if (!stopped) {
        if (!stopped) timer = setTimeout(retry, 30000);
      }
    };
    const subscription = liveQuery(() =>
      db.cloudQueue.where("target").equals(target).count()
    ).subscribe((count) => {
      setPending(count);
      clearTimeout(debounce);
      if (count)
        debounce = setTimeout(() => {
          void flushCloudQueue().catch(() => undefined);
        }, 750);
    });
    const online = () => {
      clearTimeout(timer);
      void retry();
    };
    window.addEventListener("online", online);
    void retry();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(debounce);
      subscription.unsubscribe();
      window.removeEventListener("online", online);
    };
  }, [settings, check]);

  function configure(next: CloudSettings) {
    try {
      setSettings(writeCloudSettings(next));
      onStatus(t("cloud.saved"));
      return true;
    } catch {
      onStatus(t("cloud.invalidSettings"));
      return false;
    }
  }

  async function transfer(direction: "upload" | "download") {
    setBusy(true);
    try {
      if (direction === "upload") {
        await uploadLocalRecipes();
        onStatus(t("cloud.uploaded"));
      } else {
        const count = await downloadCloudRecipes();
        await refresh();
        onStatus(t("cloud.downloaded", { count }));
      }
    } catch {
      onStatus(t("cloud.failed"));
    } finally {
      setBusy(false);
      void check();
    }
  }

  return {
    settings,
    health,
    pending,
    busy,
    checking,
    defaultApiUrl,
    configure,
    check,
    upload: () => transfer("upload"),
    download: () => transfer("download"),
  };
}

export type CloudBackupApi = ReturnType<typeof useCloudBackup>;
