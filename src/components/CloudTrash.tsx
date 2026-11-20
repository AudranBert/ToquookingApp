import { ChevronDown, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import type { CloudBackupApi } from "../hooks/useCloudBackup";
import type { ConfirmAction } from "../hooks/useAppDialog";
import type { CloudTrashEntry } from "../cloud/types";
import { getLocale, t } from "../i18n";

export function CloudTrash({
  cloud,
  onConfirm,
}: {
  cloud: CloudBackupApi;
  onConfirm: ConfirmAction;
}) {
  const { trash } = cloud;
  const configured = Boolean(cloud.settings.apiUrl && cloud.settings.key);

  async function purge(entry: CloudTrashEntry) {
    if (
      await onConfirm(
        t("cloud.trashPurgeTitle", { name: entry.name }),
        t("cloud.trashPurgeMessage"),
        true,
        t("cloud.trashPurge")
      )
    ) {
      await trash.purge(entry.id);
    }
  }

  async function empty() {
    if (
      await onConfirm(
        t("cloud.trashEmptyTitle"),
        t("cloud.trashEmptyMessage"),
        true,
        t("cloud.trashEmptyAction")
      )
    ) {
      await trash.empty();
    }
  }

  return (
    <details
      className="cloud-trash"
      onToggle={(event) => {
        if (event.currentTarget.open && configured) void trash.load();
      }}
    >
      <summary>
        <Trash2 size={17} aria-hidden="true" />
        {t("cloud.trashTitle")}
        {trash.loaded && <span className="cloud-trash-count">{trash.entries.length}</span>}
        <span className="cloud-trash-retention">{t("cloud.trashRetention")}</span>
        <ChevronDown size={16} className="cloud-chevron" aria-hidden="true" />
      </summary>
      {!configured ? (
        <p className="cloud-feedback">{t("cloud.trashConfigure")}</p>
      ) : (
        <div className="cloud-trash-content">
          <div className="action-bar">
            <button
              className="button"
              disabled={cloud.busy || trash.loading}
              onClick={() => void trash.load()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {t("cloud.trashRefresh")}
            </button>
            {trash.entries.length > 0 && (
              <button
                className="button button--danger"
                disabled={cloud.busy || trash.loading}
                onClick={() => void empty()}
              >
                {t("cloud.trashEmptyAction")}
              </button>
            )}
          </div>
          {trash.loading && (
            <p className="cloud-feedback" role="status">
              {t("app.loading")}
            </p>
          )}
          {trash.error && (
            <p className="cloud-feedback" role="alert">
              {t("cloud.trashLoadFailed")}
            </p>
          )}
          {!trash.loading && !trash.error && trash.loaded && trash.entries.length === 0 && (
            <p className="cloud-feedback">{t("cloud.trashEmpty")}</p>
          )}
          {trash.entries.length > 0 && (
            <ul className="cloud-trash-list">
              {trash.entries.map((entry) => (
                <li key={entry.id} className="cloud-trash-entry">
                  <div className="cloud-trash-info">
                    <strong>{entry.name}</strong>
                    <time dateTime={entry.expiresAt}>
                      {t("cloud.trashExpires", {
                        date: new Intl.DateTimeFormat(getLocale(), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(entry.expiresAt)),
                      })}
                    </time>
                  </div>
                  <div className="action-bar">
                    <button
                      className="button"
                      title={t("cloud.trashRestoreTitle")}
                      disabled={cloud.busy || trash.loading}
                      onClick={() => void trash.restore(entry.id)}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      {t(
                        trash.operation === `restore:${entry.id}`
                          ? "cloud.trashRestoring"
                          : "cloud.trashRestore"
                      )}
                    </button>
                    <button
                      className="button button--danger"
                      disabled={cloud.busy || trash.loading}
                      onClick={() => void purge(entry)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {t("cloud.trashPurge")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}
