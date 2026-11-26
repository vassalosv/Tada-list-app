import React, { useState, useEffect } from "react";
import { Palette, X, Check } from "lucide-react";
import {
  Hct,
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from "@material/material-color-utilities";
const defaults = { mode: "emerald", color: "#006644", dark: false };
function readTheme() {
  try {
    const v = JSON.parse(localStorage.getItem("tada.theme"));
    if (
      v &&
      ["emerald", "pastel", "dark", "material", "custom"].includes(v.mode) &&
      /^#[\da-f]{6}$/i.test(v.color)
    )
      return v;
  } catch {}
  return defaults;
}
function schemeFor(t) {
  return themeFromSourceColor(
    argbFromHex(
      t.mode === "emerald"
        ? "#006644"
        : t.mode === "material"
          ? "#1a73e8"
          : t.color,
    ),
  ).schemes[
    t.mode === "dark" || (t.mode === "custom" && t.dark) ? "dark" : "light"
  ];
}
function apply(t) {
  const root = document.documentElement;
  root.dataset.theme = t.mode;
  root.style.colorScheme =
    t.mode === "dark" || (t.mode === "custom" && t.dark) ? "dark" : "light";
  const s = schemeFor(t);
  const values = {
    bg: s.background,
    surface: s.surface,
    text: s.onSurface,
    muted: s.onSurfaceVariant,
    line: s.outlineVariant,
    accent: s.primary,
    "on-accent": s.onPrimary,
    active: s.primaryContainer,
    "on-active": s.onPrimaryContainer,
    card: s.secondaryContainer,
    "on-card": s.onSecondaryContainer,
  };
  for (const [k, v] of Object.entries(values))
    root.style.setProperty("--theme-" + k, hexFromArgb(v));
  if (t.mode === "emerald") {
    for (const [name, value] of Object.entries({
      bg: "#f4f8f6",
      surface: "#ffffff",
      text: "#192c23",
      muted: "#4d6358",
      line: "#d5e2da",
      accent: "#006644",
      "on-accent": "#ffffff",
      active: "#d1e9da",
      "on-active": "#002e1d",
      card: "#e8efeb",
      "on-card": "#274536",
    }))
      root.style.setProperty("--theme-" + name, value);
  }
  const isDark = t.mode === "dark" || (t.mode === "custom" && t.dark);
  const base = Hct.fromInt(argbFromHex(t.color)).hue;
  const hues =
    t.mode === "custom"
      ? [base, base + 100, base + 180, base + 300]
      : [285, 160, 95, 345];
  ["lavender", "mint", "yellow", "pink"].forEach((name, i) =>
    root.style.setProperty(
      "--theme-" + name,
      hexFromArgb(
        Hct.from((hues[i] + 360) % 360, 20, isDark ? 26 : 90).toInt(),
      ),
    ),
  );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      t.mode === "emerald"
        ? "#f4f8f6"
        : t.mode === "pastel"
          ? "#f7f8fc"
          : hexFromArgb(s.background),
    );
}
export function ThemeButton() {
  const [theme, setTheme] = useState(readTheme),
    [draft, setDraft] = useState(null),
    [hex, setHex] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    apply(theme);
  }, [theme]);
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener("tada-theme", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("tada-theme", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const open = () => {
    setDraft(theme);
    setHex(theme.color);
    setError("");
  };
  const color = draft ? Hct.fromInt(argbFromHex(draft.color)) : null;
  function updateColor(value) {
    setDraft({ ...draft, mode: "custom", color: value });
    setHex(value);
    setError("");
  }
  function changeHct(key, value) {
    const next = Hct.from(
      key === "hue" ? value : color.hue,
      key === "chroma" ? value : color.chroma,
      key === "tone" ? value : color.tone,
    );
    updateColor(hexFromArgb(next.toInt()));
  }
  return (
    <>
      <button
        className="theme-trigger"
        aria-label="Change theme"
        title="Change theme"
        type="button"
        onClick={open}
      >
        <Palette size={20} />
      </button>
      {draft && (
        <div className="overlay modal-overlay" onClick={() => setDraft(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="theme-title"
            className="modal theme-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close themes"
              onClick={() => setDraft(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">MAKE IT FEEL LIKE YOU</span>
            <h2 id="theme-title">Choose your theme</h2>
            <div className="theme-options">
              {[
                ["emerald", "Emerald", "Clear & grounded"],
                ["pastel", "Pastel", "Soft & familiar"],
                ["dark", "Dark", "Easy on the eyes"],
                ["material", "Material", "Clean & colorful"],
                ["custom", "Custom", "Your own palette"],
              ].map(([mode, label, description]) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={draft.mode === mode}
                  className={"theme-option " + mode}
                  onClick={() => {
                    setDraft({ ...draft, mode });
                    setError("");
                  }}
                >
                  <span className="theme-swatches">
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>
                    {label} {draft.mode === mode && <Check size={14} />}
                  </strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
            {draft.mode === "custom" && (
              <div className="color-picker">
                <h3>HCT color picker</h3>
                <div className="color-inputs">
                  <label>
                    Hex color
                    <input
                      value={hex}
                      maxLength={7}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHex(v);
                        if (/^#[\da-f]{6}$/i.test(v)) updateColor(v);
                        else
                          setError(
                            "Enter a six-digit hex color, such as #6750A4",
                          );
                      }}
                    />
                  </label>
                  <label className="color-well">
                    Pick color
                    <input
                      aria-label="Pick color"
                      type="color"
                      value={draft.color}
                      onChange={(e) => updateColor(e.target.value)}
                    />
                  </label>
                </div>
                {[
                  ["hue", "Hue", 360],
                  ["chroma", "Chroma", 120],
                  ["tone", "Tone", 100],
                ].map(([key, label, max]) => (
                  <label className="color-slider" key={key}>
                    {label}
                    <output>{color[key].toFixed(1)}</output>
                    <input
                      aria-label={label}
                      type="range"
                      min="0"
                      max={max}
                      step="0.1"
                      value={color[key]}
                      onChange={(e) => changeHct(key, +e.target.value)}
                      style={{ accentColor: draft.color }}
                    />
                  </label>
                ))}
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={draft.dark}
                    onChange={(e) =>
                      setDraft({ ...draft, dark: e.target.checked })
                    }
                  />{" "}
                  Dark appearance
                </label>
                <p className="hint">
                  Choose a source color. Matching surfaces and readable text
                  colors are generated automatically.
                </p>
              </div>
            )}
            <div
              className="theme-preview"
              style={{
                background: hexFromArgb(schemeFor(draft).primaryContainer),
                color: hexFromArgb(schemeFor(draft).onPrimaryContainer),
              }}
            >
              <span>✦</span>
              <div>
                A little preview
                <small style={{ color: "inherit" }}>
                  Your plans, in your colors.
                </small>
              </div>
              <span
                className="preview-dot"
                style={{ background: hexFromArgb(schemeFor(draft).primary) }}
              />
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="theme-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!error}
                onClick={() => {
                  try {
                    localStorage.setItem("tada.theme", JSON.stringify(draft));
                    setTheme(draft);
                    window.dispatchEvent(new Event("tada-theme"));
                    setDraft(null);
                  } catch {
                    setError("Your browser could not save this theme.");
                  }
                }}
              >
                Apply theme
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
