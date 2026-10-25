/* חידון בראשית — service worker: "הוספה למסך הבית", משחק בלי אינטרנט, והתראות.
   הדף עצמו: תמיד מהרשת (עדכונים מגיעים מיד), ואם אין רשת — העותק האחרון ששמרנו.
   תמונות / קול / מילונים / גופנים / ספריית הרשת: מהמטמון אם יש, אחרת מהרשת ונשמרים לפעם הבאה.
   "שמירה לשימוש בלי אינטרנט": הדף שולח רשימת קבצים (warm) ואנחנו מורידים את כולם מראש. */
var CACHE = "bq-shell-v2", ASSETS = "bq-assets-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k === "bq-shell-v1"; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function pageKey(u) { return u.origin + u.pathname; }   /* ?daily=1 / ?ch=… — אותו דף */
function isAsset(u) {
  if (u.origin === self.location.origin) return /\/games\/(assets\/|bq\.webmanifest)/.test(u.pathname) && !/\/api\//.test(u.pathname);
  return /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(u.hostname);
}
function fromNet(req, key) {
  return fetch(req).then(function (res) {
    if (res && (res.ok || res.type === "opaque")) { var copy = res.clone(); caches.open(ASSETS).then(function (c) { c.put(key || req, copy); }).catch(function () {}); }
    return res;
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var u; try { u = new URL(req.url); } catch (err) { return; }
  if (req.mode === "navigate") {
    var key = pageKey(u);
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, copy); }).catch(function () {}); }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (r) { return r || caches.match(req, { ignoreSearch: true }); }).then(function (r) { return r || Response.error(); });
    }));
    return;
  }
  if (!isAsset(u)) return;
  e.respondWith(caches.match(req).then(function (hit) { return hit || fromNet(req).catch(function () { return Response.error(); }); }));
});
/* הורדה מראש של כל מה שצריך כדי לשחק בלי אינטרנט */
self.addEventListener("message", function (e) {
  var d = e.data || {}; if (d.type !== "warm" || !Array.isArray(d.urls)) return;
  var src = e.source, urls = d.urls.slice(0, 200), done = 0, failed = 0;
  var tell = function (fin) { try { src && src.postMessage({ type: "warm-progress", done: done, failed: failed, total: urls.length, fin: !!fin }); } catch (err) {} };
  var one = function (url) {
    var u = new URL(url, self.registration.scope);
    var page = u.origin === self.location.origin && /\/games\/bereshit-quiz$/.test(u.pathname);
    var cacheName = page ? CACHE : ASSETS, key = page ? pageKey(u) : u.href;
    return caches.open(cacheName).then(function (c) {
      return c.match(key).then(function (hit) {
        if (hit && !page) return;
        return fetch(u.href, { mode: u.origin === self.location.origin ? "same-origin" : "cors", credentials: "omit" }).then(function (res) {
          if (!res.ok) throw new Error(res.status);
          var p = c.put(key, res.clone());
          /* גיליון הגופנים של גוגל — שומרים גם את קובצי הגופן שהוא מפנה אליהם */
          if (/fonts\.googleapis\.com/.test(u.hostname)) return res.text().then(function (css) {
            var fonts = (css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g) || []).map(function (x) { return x.slice(4, -1); });
            return Promise.all([p].concat(fonts.map(function (f) { return c.match(f).then(function (h) { return h || fetch(f, { mode: "cors" }).then(function (r) { if (r.ok) return c.put(f, r); }); }); })));
          });
          return p;
        });
      });
    }).then(function () { done++; tell(); }, function () { failed++; done++; tell(); });
  };
  var q = urls.slice(), run = function () { return q.length ? one(q.shift()).then(run) : null; };
  e.waitUntil(Promise.all([run(), run(), run(), run()]).then(function () { tell(true); }));
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
