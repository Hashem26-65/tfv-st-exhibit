// חידון בראשית — אחסון קבוע (Redis של Upstash דרך Vercel). מחליף את ה"זיכרון" של שרת ה-MQTT הציבורי,
// שמוחק רשומות ישנות לבד. אם מסד הנתונים לא מחובר — מחזיר {db:false} והמשחק ממשיך לעבוד כמו קודם.
//   acc-put / acc-get / acc-del : רשומת חשבון מוצפנת (לכניסה ממכשיר אחר עם שם+סיסמה)
//   visit-put / visits          : רשומות ביקור (שם, שלב, אימייל מוצפן בלבד) — לרשימת השחקנים במנהלים
//   visit-del (קוד מנהל)        : מחיקת שחקן
//   scores                      : רשומות לוח השיאים החתומות (נכתבות ב-bq-sign)
const crypto = require("crypto");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const DB = !!(URL_ && TOKEN);

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function same(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function isAdmin(code) {
  code = String(code || "").trim();
  const a = process.env.BQ_ADMIN_CODE || "", u = process.env.BQ_UNLOCK_CODE || "";
  return !!code && ((a && same(code, a)) || (u && same(code, u)));
}
function hashToObj(arr) { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) { try { o[arr[i]] = JSON.parse(arr[i + 1]); } catch (e) {} } return o; }
function hashRaw(arr) { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1]; return o; }
async function pipe(cmds) {   // כמה פקודות בבקשה אחת
  const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  return (await r.json()).map(x => x.result);
}
const CH_TTL = 60 * 24 * 3600;   // אתגר חבר נשמר 60 יום
const okPid = p => /^u[a-z0-9]{4,14}$/.test(String(p || ""));
const cleanName = n => String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30) || "אנונימי";
const int = (v, lo, hi) => { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
const noDeck = r => { if (!r) return r; const o = Object.assign({}, r); delete o.deck; return o; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") { res.status(200).json({ db: DB }); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!DB) { res.status(200).json({ db: false }); return; }
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || !b.op) { res.status(400).json({ error: "bad" }); return; }
  try {
    const op = b.op;
    if (op === "acc-put" || op === "acc-get" || op === "acc-del") {
      const key = String(b.key || "");
      if (!/^a[a-z0-9]{3,24}$/.test(key)) { res.status(400).json({ error: "key" }); return; }
      if (op === "acc-get") { const v = await redis(["GET", "bq:acc:" + key]); res.status(200).json({ db: true, rec: v ? JSON.parse(v) : null }); return; }
      if (op === "acc-del") { await redis(["DEL", "bq:acc:" + key]); res.status(200).json({ db: true, ok: true }); return; }
      const s = JSON.stringify(b.rec || null);
      if (!b.rec || s.length > 30000) { res.status(400).json({ error: "rec" }); return; }
      await redis(["SET", "bq:acc:" + key, s]);
      res.status(200).json({ db: true, ok: true }); return;
    }
    if (op === "visit-put") {
      const r = b.rec || {};
      if (!/^u[a-z0-9]{4,14}$/.test(String(r.id || ""))) { res.status(400).json({ error: "id" }); return; }
      delete r.email;                                   // אימייל גלוי לעולם לא נשמר
      const s = JSON.stringify(r);
      if (s.length > 8000) { res.status(400).json({ error: "size" }); return; }
      await redis(["HSET", "bq:visits", r.id, s]);
      res.status(200).json({ db: true, ok: true }); return;
    }
    if (op === "visits") { res.status(200).json({ db: true, visits: hashToObj(await redis(["HGETALL", "bq:visits"])) }); return; }
    if (op === "scores") { res.status(200).json({ db: true, scores: hashToObj(await redis(["HGETALL", "bq:scores"])) }); return; }
    if (op === "visit-del") {
      if (!isAdmin(b.code)) { await new Promise(r => setTimeout(r, 900)); res.status(403).json({ error: "code" }); return; }
      const id = String(b.id || "");
      if (!/^u[a-z0-9]{4,14}$/.test(id)) { res.status(400).json({ error: "id" }); return; }
      await redis(["HDEL", "bq:visits", id]); await redis(["HDEL", "bq:scores", id]);
      res.status(200).json({ db: true, ok: true }); return;
    }
    /* ── אתגר חבר: 10 שאלות קבועות, תוצאת המאתגר, ותוצאות החברים ── */
    if (op === "ch-new") {
      const by = b.by || {};
      if (!okPid(by.pid) || !Array.isArray(b.deck) || !b.deck.length || b.deck.length > 12) { res.status(400).json({ error: "bad" }); return; }
      const deck = b.deck.map(q => ({ q: String(q.q || "").slice(0, 400), a: String(q.a || "").slice(0, 200),
        w: (Array.isArray(q.w) ? q.w : []).slice(0, 5).map(x => String(x).slice(0, 200)), exp: String(q.exp || "").slice(0, 900) }));
      const id = crypto.randomBytes(6).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || String(Date.now());
      const rec = { id, ts: Date.now(), deck, by: { pid: by.pid, name: cleanName(by.name), score: int(b.score, 0, 7000), correct: int(b.correct, 0, 12), res: String(b.res || "").slice(0, 12) }, res: [] };
      await pipe([["SET", "bq:ch:" + id, JSON.stringify(rec), "EX", CH_TTL], ["LPUSH", "bq:chby:" + by.pid, id], ["LTRIM", "bq:chby:" + by.pid, 0, 19], ["EXPIRE", "bq:chby:" + by.pid, CH_TTL]]);
      res.status(200).json({ db: true, id }); return;
    }
    if (op === "ch-get" || op === "ch-res") {
      const id = String(b.id || "");
      if (!/^[A-Za-z0-9]{4,16}$/.test(id)) { res.status(400).json({ error: "id" }); return; }
      const raw = await redis(["GET", "bq:ch:" + id]);
      if (!raw) { res.status(200).json({ db: true, rec: null }); return; }
      const rec = JSON.parse(raw);
      if (op === "ch-get") { res.status(200).json({ db: true, rec }); return; }
      if (!okPid(b.pid) || b.pid === rec.by.pid) { res.status(400).json({ error: "pid" }); return; }
      const mine = { pid: b.pid, name: cleanName(b.name), score: int(b.score, 0, 7000), correct: int(b.correct, 0, 12), res: String(b.res || "").slice(0, 12), ts: Date.now() };
      rec.res = (rec.res || []).filter(x => x.pid !== b.pid).concat([mine]).slice(-30);
      await redis(["SET", "bq:ch:" + id, JSON.stringify(rec), "KEEPTTL"]);
      res.status(200).json({ db: true, rec: noDeck(rec) }); return;
    }
    if (op === "ch-mine") {
      if (!okPid(b.pid)) { res.status(400).json({ error: "pid" }); return; }
      const ids = await redis(["LRANGE", "bq:chby:" + b.pid, 0, 9]) || [];
      if (!ids.length) { res.status(200).json({ db: true, list: [] }); return; }
      const vals = await redis(["MGET"].concat(ids.map(i => "bq:ch:" + i))) || [];
      res.status(200).json({ db: true, list: vals.filter(Boolean).map(v => noDeck(JSON.parse(v))) }); return;
    }
    /* ── סטטיסטיקת שאלות: כמה ענו וכמה צדקו בכל שאלה ── */
    if (op === "qstat") {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20);
      const cmds = [];
      for (const it of items) {
        const t = String(it.t || "").slice(0, 400); if (!t) continue;
        const h = crypto.createHash("sha1").update(t).digest("hex").slice(0, 12);
        cmds.push(["HINCRBY", "bq:qs:n", h, 1]);
        if (it.ok) cmds.push(["HINCRBY", "bq:qs:ok", h, 1]);
        cmds.push(["HSETNX", "bq:qs:t", h, t]);
      }
      if (cmds.length) await pipe(cmds);
      res.status(200).json({ db: true, ok: true }); return;
    }
    if (op === "qstats") {
      if (!isAdmin(b.code)) { await new Promise(r => setTimeout(r, 900)); res.status(403).json({ error: "code" }); return; }
      const [n, ok] = await pipe([["HGETALL", "bq:qs:n"], ["HGETALL", "bq:qs:ok"]]);
      const N = hashRaw(n), OK = hashRaw(ok);
      let rows = Object.keys(N).map(h => ({ h, n: +N[h], ok: +(OK[h] || 0) })).filter(r => r.n >= 3);
      const total = Object.keys(N).length;
      rows.sort((x, y) => (x.ok / x.n) - (y.ok / y.n) || y.n - x.n);
      rows = rows.slice(0, 25);
      const txt = rows.length ? await redis(["HMGET", "bq:qs:t"].concat(rows.map(r => r.h))) : [];
      rows.forEach((r, i) => { r.t = txt[i] || ""; delete r.h; });
      res.status(200).json({ db: true, total, rows }); return;
    }
    res.status(400).json({ error: "op" });
  } catch (e) { res.status(500).json({ db: true, error: "store" }); }
};
