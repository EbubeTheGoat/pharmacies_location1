// sw.js — Service Worker for background push notifications
// Served from / (root) so its scope covers the entire app.
//
// What this file does:
//   • Listens for `push` events sent by the server via Web Push
//   • Displays a system notification (visible even when the tab is closed)
//   • Listens for notification clicks and brings the app to focus
//
// What it CANNOT do:
//   • Run navigator.geolocation (not available in service workers)
//   • Detect proximity on its own — the main tab still needs to be alive
//     and calling POST /push/check-proximity for location events to trigger
//
// Background limitation (be honest with yourself):
//   Desktop  : works fine — background tab stays alive indefinitely
//   Android  : works while the browser keeps the tab alive (Chrome usually does)
//   iOS      : watchPosition stops when the screen locks — Apple restriction
//              on all web apps, no workaround without a native app

const CACHE_NAME = "places-v1"

// ── Install / Activate ────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  // Take control immediately rather than waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ── Push event ────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "You're near a saved place", body: "Tap to open the map" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/static/icon-192.png",   // provide this file if you want a custom icon
    badge: "/static/badge-72.png",  // monochrome icon shown in Android status bar
    vibrate: [200, 100, 200],
    tag: `place-${data.placeId ?? "nearby"}`,  // replaces previous notification
                                                // for the same place rather than stacking
    renotify: false,
    data: {
      url: "/",
      placeId: data.placeId,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open somewhere, focus it
        for (const client of windowClients) {
          if (new URL(client.url).pathname === "/" && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
