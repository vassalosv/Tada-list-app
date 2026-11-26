import { version } from "../package.json";
import React, { useState } from "react";
import { LockKeyhole, Check } from "lucide-react";
import { Avatar } from "./lists.jsx";
import { api } from "./api.js";
import { nativeSettingsAvailable, changeServer } from "./native-settings.js";
import { clearDeviceReminders } from "./device-reminders.js";
export function Profile({ user, changePassword, refresh }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [show, setShow] = useState(false);
  const [server, setServer] = useState(location.origin);
  return (
    <section
      className="account-profile"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
    >
      <span className="eyebrow">YOUR ACCOUNT</span>
      <h2 id="profile-title">Account & profile</h2>
      <div className="profile-identity">
        <Avatar user={user} />
        <div>
          <strong>{user.name}</strong>
          <small>Email & password account</small>
        </div>
      </div>
      <label className="photo-upload">
        Change profile picture
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const photo = e.target.files?.[0];
            if (!photo) return;
            setBusy(true);
            setError("");
            try {
              const body = new FormData();
              body.append("photo", photo);
              await api("/profile/photo", body);
              await refresh();
            } catch (error) {
              setError(error.message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {user.avatar && (
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/profile/photo", {}, "DELETE");
              await refresh();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Use initials instead
        </button>
      )}
      <form
        className="account-server"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await clearDeviceReminders();
            await changeServer(server);
          } catch (error) {
            setError(error.message);
            setBusy(false);
          }
        }}
      >
        <h3>TaDa server</h3>
        <label>
          Server address
          <input
            type="url"
            required
            value={server}
            readOnly={!nativeSettingsAvailable()}
            onChange={(e) => setServer(e.target.value)}
          />
        </label>
        {nativeSettingsAvailable() && (
          <>
            <p className="hint">
              Changing servers signs out this phone and clears its scheduled
              alerts. You’ll sign in on the selected server.
            </p>
            <button
              className="outline"
              disabled={busy || server === location.origin}
            >
              Change server
            </button>
          </>
        )}
      </form>
      <dl className="profile-info">
        <div>
          <dt>Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>App version</dt>
          <dd>TaDa {version}</dd>
        </div>
        <div>
          <dt>Password</dt>
          <dd aria-label="Password is hidden">••••••••••••</dd>
        </div>
      </dl>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const body = Object.fromEntries(new FormData(form));
          setError("");
          setSuccess(false);
          if (body.newPassword !== body.confirmPassword) {
            setError("New passwords do not match");
            return;
          }
          setBusy(true);
          try {
            await changePassword(body);
            form.reset();
            setShow(false);
            setSuccess(true);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>
          <LockKeyhole size={17} /> Change password
        </h3>
        <fieldset disabled={busy}>
          <label>
            Current password
            <input
              name="currentPassword"
              type={show ? "text" : "password"}
              required
              maxLength={256}
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              name="newPassword"
              type={show ? "text" : "password"}
              required
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              placeholder="12–256 characters"
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type={show ? "text" : "password"}
              required
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />{" "}
            Show entered passwords
          </label>
        </fieldset>
        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="profile-success" role="status">
            <Check size={16} /> Password updated. Other signed-in sessions have
            been signed out.
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
        <p className="hint">
          Changing your password signs out your other sessions. You’ll stay
          signed in here.
        </p>
      </form>
    </section>
  );
}
