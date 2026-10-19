/* Service worker webu Hádzaná Záhorie - zobrazuje upozornenia do mobilu (Web Push). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  const title = d.title || "Hádzaná Záhorie";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: d.icon || "/icon-192.png",
    badge: "/icon-badge.png",
    data: { url: d.url || "/" },
    tag: d.tag || undefined,
    lang: "sk",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url === url && "focus" in c) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
