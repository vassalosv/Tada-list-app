import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { DatabaseSync } from "node:sqlite";
import * as webpush from "web-push";
const file = ".env";
const saved = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
const configured = { ...saved, ...process.env };
let publicKey = configured.VAPID_PUBLIC_KEY,
  privateKey = configured.VAPID_PRIVATE_KEY;
if (!!publicKey !== !!privateKey)
  throw Error(
    "Only one push key exists. Restore the matching pair before continuing.",
  );
let subject = process.argv[2] || configured.VAPID_SUBJECT;
if (!subject) {
  const database = (configured.DATA_DIR || "data") + "/tada.sqlite";
  if (existsSync(database)) {
    const db = new DatabaseSync(database, { readOnly: true });
    const accounts = db
      .prepare("SELECT email FROM users")
      .all()
      .filter(
        (u) =>
          !u.email.endsWith("@example.com") &&
          !u.email.endsWith("@identity.invalid"),
      );
    db.close();
    if (accounts.length === 1) subject = "mailto:" + accounts[0].email;
  }
}
if (!subject)
  throw Error(
    "Supply a contact address: npm run push:setup -- mailto:you@your-domain.com",
  );
const generated = !publicKey;
if (generated) ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
webpush.setVapidDetails(subject, publicKey, privateKey);
let additions = [];
for (const [key, value] of Object.entries({
  VAPID_PUBLIC_KEY: publicKey,
  VAPID_PRIVATE_KEY: privateKey,
  VAPID_SUBJECT: subject,
})) {
  if (saved[key] !== value) additions.push(key + "=" + value);
}
if (additions.length)
  appendFileSync(
    file,
    "\n# Browser push configuration. Keep the private key secret and retain both keys.\n" +
      additions.join("\n") +
      "\n",
    { mode: 0o600 },
  );
console.log(
  generated
    ? "Browser push keys generated and saved privately in .env."
    : "Browser push configuration saved; existing keys preserved.",
);
console.log("Restart TaDa to activate push. No key values were printed.");
