const serverUrl = process.env.TADA_SERVER_URL;
if (serverUrl && !serverUrl.startsWith("https://"))
  throw new Error("TADA_SERVER_URL must use HTTPS");
export default {
  appId: "app.tada.tasks",
  appName: "TaDa",
  webDir: "dist",
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
};
