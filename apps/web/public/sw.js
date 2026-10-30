/* AIorNot.vote service worker — receives web-push and opens the app on click. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "AIorNot.vote", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "AIorNot.vote";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const c of wins) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});


const PWA_CACHE = "aiornot-app-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const response = await fetch("/", { credentials: "omit" });
      if (response.ok) await (await caches.open(PWA_CACHE)).put("/", response);
    } catch {}
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => (await caches.open(PWA_CACHE)).match("/") || Response.error()));
});
