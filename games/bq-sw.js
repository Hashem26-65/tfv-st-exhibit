/* חידון בראשית — service worker מינימלי: מאפשר "הוספה למסך הבית".
   תמיד מהרשת (כדי שעדכונים יגיעו מיד); רק אם אין רשת — הגרסה האחרונה של הדף מהמטמון. */
var CACHE = "bq-shell-v1";
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
