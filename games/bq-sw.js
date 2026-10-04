/* חידון בראשית — service worker מינימלי: מאפשר "הוספה למסך הבית".
   תמיד מהרשת (כדי שעדכונים יגיעו מיד); רק אם אין רשת — הגרסה האחרונה של הדף מהמטמון. */
var CACHE = "bq-shell-v1"; /* v2: push */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || Response.error(); });
    })
  );
});

/* התראות בטלפון: האתגר היומי, וחבר שענה על האתגר שלך (נשלחות מ-/api/bq-push ומ-/api/bq-store) */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "\u05d7\u05d9\u05d3\u05d5\u05df \u05d1\u05e8\u05d0\u05e9\u05d9\u05ea", {
    body: d.body || "", icon: "assets/icon-192.png", tag: d.tag || "bq", renotify: false,
    data: { url: d.url || "bereshit-quiz" }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "bereshit-quiz", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf("/games/bereshit-quiz") >= 0 && "focus" in c) {
        return c.focus().then(function (w) { return (w || c).navigate ? (w || c).navigate(url).catch(function () {}) : null; });
      }
    }
    return self.clients.openWindow(url);
  }));
});
