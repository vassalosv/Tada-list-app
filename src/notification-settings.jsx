import React, { useState, useEffect } from "react";
import { api } from "./api.js";
import { pollNativeAlerts } from "./device-reminders.js";
export function NotificationSettings({ device, enableBrowser, refresh }) {
  const [status, setStatus] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function check() {
    try {
      setStatus(await api("/notifications/status"));
    } catch {
      setError(
        "Update the Pi server to v1.0.0 to see notification delivery status.",
      );
    }
  }
  useEffect(() => {
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);
  async function action(fn) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await check();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notification-settings">
      <h3>Notification delivery</h3>
      {status && (
        <dl className="profile-info">
          <div>
            <dt>Server reminders</dt>
            <dd>
              {status.worker.lastError ||
                (!status.worker.lastRun
                  ? "Not started"
                  : Date.parse(status.serverTime) - status.worker.lastRun >
                      60000
                    ? "Worker has not run recently"
                    : "Scheduler running")}
            </dd>
          </div>
          {!device.native && (
            <div>
              <dt>Browser push on this server</dt>
              <dd>
                {status.pushConfigured
                  ? "Configured"
                  : "Not configured on the Pi"}
              </dd>
            </div>
          )}
          {!device.native && (
            <div>
              <dt>Registered browsers for your account</dt>
              <dd>{status.devices}</dd>
            </div>
          )}
          <div>
            <dt>Next saved reminder</dt>
            <dd>
              {status.nextReminder
                ? new Date(status.nextReminder).toLocaleString()
                : "None scheduled"}
            </dd>
          </div>
          {!device.native && status.lastDelivery && (
            <div>
              <dt>Last browser delivery</dt>
              <dd>
                {{
                  delivered: "Accepted by push service",
                  retrying: "Failed; retrying",
                  partial: "Some devices failed; retrying",
                  no_devices: "No browser subscribed",
                  expired_subscription: "Browser subscription expired",
                }[status.lastDelivery.status] || status.lastDelivery.status}
                {status.lastDelivery.code != null &&
                  ` (${status.lastDelivery.code || "network error"})`}
              </dd>
            </div>
          )}
        </dl>
      )}
      <div className="notification-actions">
        {device.native ? (
          <>
            <button
              className="outline"
              disabled={busy || !device.available}
              onClick={() =>
                action(async () => {
                  await device.enable();
                  setMessage(
                    "Android notifications enabled. Syncing this phone’s alarms.",
                  );
                })
              }
            >
              {device.enabled
                ? "Sync Android notifications"
                : "Enable Android notifications"}
            </button>
            <button
              className="outline"
              disabled={busy || !device.enabled}
              onClick={() => action(device.test)}
            >
              Test device notification
            </button>
            {device.enabled && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => action(device.disable)}
              >
                Disable Android notifications
              </button>
            )}
          </>
        ) : (
          <button
            className="outline"
            disabled={busy}
            onClick={() => action(enableBrowser)}
          >
            Enable browser push
          </button>
        )}
        <button
          className="outline"
          disabled={busy}
          onClick={() =>
            action(async () => {
              const result = await api("/notifications/test", {});
              await refresh();
              if (device.native) await pollNativeAlerts();
              setMessage(
                device.native
                  ? "Test added to your inbox and queued for an Android notification. Enable Android notifications first."
                  : result.pushConfigured
                    ? "Test added to your inbox and queued for browser push."
                    : "Test added to your inbox. Configure push keys on the Pi for browser alerts.",
              );
            })
          }
        >
          Test server notification
        </button>
      </div>
      {device.native && (
        <>
          <p className="hint">
            {!device.available
              ? "This APK needs updating to v1.0.0."
              : device.enabled
                ? `${device.count} alerts synced to this phone. ${device.precise ? "Precise timing is allowed." : "Android may delay alerts; allow Alarms & reminders for precise timing."}`
                : "Allow TaDa notifications to see reminders in Android’s notification shade."}
          </p>
          {device.enabled && !device.precise && (
            <button
              className="text-button"
              onClick={() => action(device.preciseSettings)}
            >
              Allow precise timing
            </button>
          )}
          <p className="hint">
            Reminders use Android alarms (up to 256 scheduled alerts). Open TaDa
            after shared tasks change to refresh precise times. Task alarms
            check current assignment with the server before display; offline
            delivery can be delayed.
            {device.background
              ? " Native background checks also deliver new server alerts, approximately every 15 minutes; Android battery settings can delay them. No browser push or VAPID keys are needed for this APK."
              : " Install the v1.0.0 APK for native background checks."}
          </p>
        </>
      )}
      {(error || device.error) && (
        <p className="profile-error" role="alert">
          {error || device.error}
        </p>
      )}
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
