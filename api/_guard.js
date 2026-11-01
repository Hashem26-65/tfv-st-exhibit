// נעילת ניחושי קוד המנהלים — בשרת, לא רק בדפדפן (את הדף אפשר לעקוף; את השרת לא).
// כל כתובת: 8 טעויות → חסומה עד 15 דקות אחרי הטעות האחרונה; 30 טעויות ביום → חסומה עד סוף היממה.
// בזמן חסימה גם קוד נכון נדחה — אחרת החסימה לא עוצרת ניחוש. הכתובת נשמרת רק כגיבוב.
// אם מסד הנתונים לא מחובר או לא עונה — אין חסימה (המנהל לא ננעל בגלל תקלה).
const crypto = require("crypto");
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const MAX = 8, WIN = 15 * 60, DAY_MAX = 30;

async function pipe(cmds) {
  const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  return (await r.json()).map(x => x.result);
}
const day = () => new Date().toISOString().slice(0, 10);
function ipKey(req) {
  const h = req.headers || {};
  const ip = String(h["x-vercel-forwarded-for"] || h["x-real-ip"] || h["x-forwarded-for"] || "?").split(",")[0].trim();
  return crypto.createHash("sha256").update("bq-guard|" + ip).digest("hex").slice(0, 20);
}

async function blocked(req) {
  if (!URL_ || !TOKEN) return false;
  try {
    const k = ipKey(req);
    const [a, d] = await pipe([["GET", "bq:afail:" + k], ["GET", "bq:afaild:" + k + ":" + day()]]);
    return (+a || 0) >= MAX || (+d || 0) >= DAY_MAX;
  } catch (e) { return false; }
}
async function fail(req) {
  if (!URL_ || !TOKEN) return;
  try {
    const k = ipKey(req), kd = "bq:afaild:" + k + ":" + day(), ka = "bq:afall:" + day();
    await pipe([["INCR", "bq:afail:" + k], ["EXPIRE", "bq:afail:" + k, WIN], ["INCR", kd], ["EXPIRE", kd, 2 * 86400], ["INCR", ka], ["EXPIRE", ka, 8 * 86400]]);
  } catch (e) {}
}
async function clear(req) {   // כניסה נכונה מאפסת את מונה 15 הדקות (לא את המונה היומי)
  if (!URL_ || !TOKEN) return;
  try { await pipe([["DEL", "bq:afail:" + ipKey(req)]]); } catch (e) {}
}
/* כמה טעויות היו בכל האתר — היום ובשבוע האחרון (לדף הניהול) */
async function stats() {
  if (!URL_ || !TOKEN) return { today: 0, week: 0 };
  try {
    const days = []; for (let i = 0; i < 7; i++) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
    const v = await pipe(days.map(d => ["GET", "bq:afall:" + d]));
    return { today: +v[0] || 0, week: v.reduce((s, x) => s + (+x || 0), 0) };
  } catch (e) { return { today: 0, week: 0 }; }
}
module.exports = { blocked, fail, clear, stats, MAX, DAY_MAX };
