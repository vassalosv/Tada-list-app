self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(
      data.title || "A gentle nudge from TaDa",
      {
        body: "Open TaDa to see your task.",
        icon: "/tada-icon.png",
        tag: data.id || "tada",
        data: { url: "/" },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        if (windows.length) {
          await windows[0].focus();
          return;
        }
        return clients.openWindow("/");
      }),
  );
});
