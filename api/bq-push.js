// חידון בראשית — ההתראה היומית. Vercel Cron קורא לכאן פעם ביום (vercel.json → crons), עם CRON_SECRET.
// שולח רק למי שעוד לא עשה היום את האתגר היומי (לפי אזור הזמן שלו), ולא למי שלא נכנס יותר מ-30 יום.
// בדיקה ידנית: GET /api/bq-push?only=<id>  (עם אותה כותרת Authorization) — שולח רק למנוי אחד, גם אם כבר שיחק.
const crypto = require("crypto");
const wp = require("./_webpush");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function authOk(req) {
  const s = process.env.CRON_SECRET || "", h = String(req.headers.authorization || "");
  if (!s) return false;
  const x = crypto.createHash("sha256").update(h).digest(), y = crypto.createHash("sha256").update("Bearer " + s).digest();
  return crypto.timingSafeEqual(x, y);
}
const dayAt = (ms, tz) => new Date(ms - (tz || 0) * 60000).toISOString().slice(0, 10);   // tz = getTimezoneOffset של הדפדפן

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authOk(req)) { res.status(401).json({ error: "auth" }); return; }
  if (!URL_ || !TOKEN) { res.status(200).json({ db: false }); return; }
  const only = String((req.query && req.query.only) || "");
  const now = Date.now(), out = { sent: 0, played: 0, idle: 0, gone: 0, failed: 0 };
  const raw = await redis(["HGETALL", "bq:push"]) || [];
  const list = [];
  for (let i = 0; i < raw.length; i += 2) { try { list.push([raw[i], JSON.parse(raw[i + 1])]); } catch (e) {} }
  const todo = only ? list.filter(([id]) => id === only) : list.filter(([, r]) => {
    if (r.done === dayAt(now, r.tz)) { out.played++; return false; }
    if (now - (r.seen || r.ts || 0) > 30 * 24 * 3600 * 1000) { out.idle++; return false; }
    return true;
  });
  for (let i = 0; i < todo.length; i += 25) {   // 25 במקביל בכל פעם
    await Promise.all(todo.slice(i, i + 25).map(async ([id, r]) => {
      const alive = r.done === dayAt(now - 864e5, r.tz);            // שיחק אתמול → הרצף עוד חי
      try {
        const st = await wp.send(r.sub, wp.dailyMsg(r.lang, alive ? r.streak || 0 : 0), 10 * 3600);
        if (st === 404 || st === 410) {
          out.gone++;
          await redis(["HDEL", "bq:push", id]);
          if (r.pid) await redis(["SREM", "bq:pushpid:" + r.pid, id]);
        } else if (st >= 200 && st < 300) out.sent++; else out.failed++;
      } catch (e) { out.failed++; }
    }));
  }
  res.status(200).json(Object.assign({ total: list.length }, out));
};
