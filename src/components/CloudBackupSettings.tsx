import { useEffect, useId, useState } from "react";
import {
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import type { CloudBackupApi } from "../hooks/useCloudBackup";
import type { CloudServerMode } from "../cloud/settings";
import { copyText } from "../utils/clipboard";
import { t } from "../i18n";

function ConnectionBadge({
  label,
  configured,
  connected,
  checking,
}: {
  label: string;
  configured: boolean;
  connected: boolean;
  checking: boolean;
}) {
  const state = !configured
    ? "cloud.notConfigured"
    : connected
      ? "cloud.connected"
      : checking
        ? "cloud.checking"
        : "cloud.disconnected";
  return (
    <span
      className={`cloud-connection${configured && connected ? " cloud-connection--online" : configured && !checking ? " cloud-connection--offline" : ""}`}
      role="img"
      aria-label={`${label} : ${t(state)}`}
      title={`${label} : ${t(state)}`}
    >
      {!configured ? (
        <span aria-hidden="true">🔌</span>
      ) : connected ? (
        <Check size={16} aria-hidden="true" />
      ) : checking ? (
        <LoaderCircle size={16} className="cloud-spinner" aria-hidden="true" />
      ) : (
        <X size={16} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

export function CloudBackupSettings({ cloud }: { cloud: CloudBackupApi }) {
  const [apiUrl, setApiUrl] = useState(cloud.settings.apiUrl);
  const [key, setKey] = useState(cloud.settings.key);
  const [mode, setMode] = useState<CloudServerMode>(cloud.settings.serverMode ?? "custom");
  const [visible, setVisible] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const keyId = useId();
  const serverId = useId();
  useEffect(() => {
    setApiUrl(cloud.settings.apiUrl);
    setKey(cloud.settings.key);
    setMode(cloud.settings.serverMode ?? "custom");
    setCopyStatus("");
  }, [cloud.settings.apiUrl, cloud.settings.key, cloud.settings.serverMode]);
  const configured = Boolean(cloud.settings.apiUrl);
  const provider =
    cloud.settings.serverMode === "disabled"
      ? "cloud.localOnly"
      : cloud.settings.serverMode === "default"
        ? "cloud.publicServer"
        : "cloud.customServer";

  async function copyKey() {
    try {
      await copyText(key);
      setCopyStatus(t("cloud.keyCopied"));
    } catch {
      setCopyStatus(t("cloud.keyCopyFailed"));
    }
  }

  return (
    <section className="backup-card cloud-backup" aria-labelledby="cloud-backup-title">
      <div className="backup-card-heading">
        <span className="backup-card-icon">
          <Cloud size={21} aria-hidden="true" />
        </span>
        <div>
          <h3 id="cloud-backup-title">{t("cloud.title")}</h3>
          <span className="muted cloud-provider">{t(provider)}</span>
        </div>
        <div className="cloud-connections" aria-live="polite">
          <ConnectionBadge
            label={t("cloud.server")}
            configured={configured}
            connected={cloud.health.server}
            checking={cloud.checking}
          />
          <ConnectionBadge
            label={t("cloud.database")}
            configured={configured}
            connected={cloud.health.database}
            checking={cloud.checking}
          />
        </div>
      </div>

      <div className="cloud-section">
        <label className="cloud-toggle">
          <input
            type="checkbox"
            checked={cloud.settings.autoBackup}
            disabled={!configured || cloud.busy}
            onChange={(event) =>
              cloud.configure({ ...cloud.settings, key, autoBackup: event.target.checked })
            }
          />
          <span>
            <strong>{t("cloud.autoBackup")}</strong>
            <small>{t("cloud.autoHelp")}</small>
          </span>
        </label>
        <div className="cloud-transfer-actions">
          <button
            className="button button--primary"
            disabled={!configured || cloud.busy}
            onClick={() => void cloud.upload()}
          >
            <Upload size={17} aria-hidden="true" />
            {t("cloud.upload")}
          </button>
          <button
            className="button"
            disabled={!configured || !cloud.settings.key || cloud.busy}
            onClick={() => void cloud.download()}
          >
            <Download size={17} aria-hidden="true" />
            {t("cloud.download")}
          </button>
        </div>
        <div className="cloud-transfer-meta">
          <span role="status">
            {t(cloud.pending ? "cloud.pending" : "cloud.noPending", { count: cloud.pending })}
          </span>
          <span>{t("cloud.trashShort")}</span>
        </div>
        {cloud.busy && (
          <p className="cloud-feedback" role="status">
            {t("cloud.transferring")}
          </p>
        )}
        {!configured && cloud.settings.serverMode === "default" && (
          <p className="cloud-feedback">{t("cloud.publicPending")}</p>
        )}
      </div>

      <div className="cloud-section">
        <form
          className="cloud-key-form"
          onSubmit={(event) => {
            event.preventDefault();
            cloud.configure({ ...cloud.settings, key });
          }}
        >
          <label htmlFor={keyId}>{t("cloud.key")}</label>
          <div className="cloud-key-controls">
            <input
              id={keyId}
              type={visible ? "text" : "password"}
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setCopyStatus("");
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="button button--icon"
              onClick={() => setVisible(!visible)}
              aria-label={t(visible ? "cloud.hideKey" : "cloud.showKey")}
              title={t(visible ? "cloud.hideKey" : "cloud.showKey")}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              type="button"
              className="button cloud-copy-key"
              onClick={() => void copyKey()}
              disabled={!key}
            >
              <Copy size={16} aria-hidden="true" />
              {t("cloud.copyKey")}
            </button>
          </div>
          <div className="cloud-key-caption">
            <span className="muted">{t("cloud.keyShortHelp")}</span>
            {key !== cloud.settings.key && (
              <button className="button" type="submit" disabled={cloud.busy}>
                {t("cloud.saveKey")}
              </button>
            )}
          </div>
          {copyStatus && (
            <span className="cloud-feedback" role="status">
              {copyStatus}
            </span>
          )}
        </form>
      </div>

      <details className="cloud-advanced">
        <summary>
          <Settings2 size={17} aria-hidden="true" />
          {t("cloud.advanced")}
          <ChevronDown size={16} className="cloud-chevron" aria-hidden="true" />
        </summary>
        <form
          className="cloud-server-form"
          onSubmit={(event) => {
            event.preventDefault();
            cloud.configure({
              apiUrl: mode === "default" ? cloud.defaultApiUrl : mode === "disabled" ? "" : apiUrl,
              key,
              autoBackup: cloud.settings.autoBackup,
              serverMode: mode,
            });
          }}
        >
          <label htmlFor={serverId}>{t("cloud.serverChoice")}</label>
          <select
            id={serverId}
            value={mode}
            onChange={(event) => setMode(event.target.value as CloudServerMode)}
          >
            <option value="default">{t("cloud.publicServer")}</option>
            <option value="custom">{t("cloud.customServer")}</option>
            <option value="disabled">{t("cloud.localOnly")}</option>
          </select>
          {mode === "custom" && (
            <label>
              {t("cloud.serverUrl")}
              <input
                type="url"
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
                placeholder="https://mon-serveur.example"
                autoComplete="url"
                required
              />
            </label>
          )}
          <div className="action-bar">
            <button className="button" type="submit" disabled={cloud.busy}>
              {t("cloud.configure")}
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
