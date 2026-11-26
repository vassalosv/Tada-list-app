import { version } from "../package.json";
import React, { useState } from "react";
import { LockKeyhole, Check } from "lucide-react";
export function Profile({ user, changePassword }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [show, setShow] = useState(false);
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
        <span className="avatar">{user.name[0]}</span>
        <div>
          <strong>{user.name}</strong>
          <small>Email & password account</small>
        </div>
      </div>
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
