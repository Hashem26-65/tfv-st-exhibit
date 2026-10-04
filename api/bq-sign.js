// חידון בראשית — חתימה על רשומות לוח השיאים.
// הלקוח שולח את ההתקדמות שלו + הרשומה החתומה הקודמת; השרת בודק שההתקדמות סבירה בזמן שעבר,
// "מצמצם" ערכים לא סבירים, וחותם (ECDSA P-256). הדפדפנים מציגים בלוח רק רשומות עם חתימה תקינה,
// כך שאי אפשר לזייף שיא ע"י כתיבה ישירה לשרת ה-MQTT הציבורי.
const crypto = require("crypto");

const PER_STAGE = 6500;   // מקסימום נקודות לשלב (10 שאלות, כולל מכפיל) — עם מרווח
const STEP_MS = 30000;    // שלב אחד לכל 30 שניות לכל היותר
const MAX_STAGE = 499;

function weekId(t) {       // יום ראשון (UTC) של השבוע — זהה לחישוב בדפדפן
  const d = new Date(t);
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay()));
  return s.toISOString().slice(0, 10);
}
function canon(r) { return [r.id, r.name, r.stage, r.total, r.wk, r.wkPts, r.ts].join("|"); }
function int(v, lo, hi) { v = Math.floor(Number(v)); if (!isFinite(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

let KEYS = null;
function keys() {
  if (KEYS) return KEYS;
  const der = Buffer.from(process.env.BQ_SIGN_KEY || "", "base64");
  const priv = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  KEYS = { priv, pub: crypto.createPublicKey(priv) };
  return KEYS;
}
function verify(r) {
  try {
    return crypto.verify("sha256", Buffer.from(canon(r)), { key: keys().pub, dsaEncoding: "ieee-p1363" },
      Buffer.from(String(r.sig || ""), "base64"));
  } catch (e) { return false; }
}

// שמירה קבועה של הרשומה החתומה (אם מסד הנתונים מחובר) — כדי שהלוח לא ייעלם כשהשרת הציבורי מוחק רשומות
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
function kvSaveScore(rec) {
  if (!KV_URL || !KV_TOKEN) return Promise.resolve();
  return fetch(KV_URL, { method: "POST", headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(["HSET", "bq:scores", rec.id, JSON.stringify(Object.assign({ ver: 2 }, rec))]) }).catch(() => {});
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!process.env.BQ_SIGN_KEY) { res.status(503).json({ error: "nokey" }); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const r = body && body.rec;
  if (!r || !/^u[a-z0-9]{4,14}$/.test(String(r.id || ""))) { res.status(400).json({ error: "bad" }); return; }

  const now = Date.now(), wk = weekId(now);
  if (r.wk !== wk) { res.status(409).json({ error: "week", wk }); return; }
  const name = String(r.name || "").replace(/[\u0000-\u001f|<>]/g, "").trim().slice(0, 30) || "אנונימי";
  let stage = int(r.stage, 0, MAX_STAGE), total = int(r.total, 0, 1e9), wkPts = int(r.wkPts, 0, 1e9);

  // בסיס: הרשומה החתומה הקודמת (אם תקינה ושלו), או רשימת השחקנים שהיו לפני ההגנה
  const prev = body.prev;
  const base = (prev && prev.id === r.id && prev.sig && verify(prev)) ? prev : null;
  let mig = null;
  try { mig = (JSON.parse(process.env.BQ_MIGRATE || "{}"))[r.id] || null; } catch (e) {}

  if (base) {
    const steps = Math.max(1, Math.floor(Math.max(0, now - base.ts) / STEP_MS));
    stage = Math.min(stage, Math.min(MAX_STAGE, base.stage + steps));
    total = Math.min(total, base.total + steps * PER_STAGE);
    wkPts = Math.min(wkPts, (base.wk === wk ? base.wkPts : 0) + steps * PER_STAGE);
  } else {
    const sinceWeek = now - Date.parse(wk + "T00:00:00Z");
    const capStage = mig ? mig.stage : 1;
    stage = Math.min(stage, capStage);
    total = Math.min(total, (capStage + 1) * PER_STAGE);
    wkPts = Math.min(wkPts, Math.max(1, Math.floor(sinceWeek / STEP_MS)) * PER_STAGE, 2 * PER_STAGE);
  }

  const out = { id: r.id, name, stage, total, wk, wkPts, ts: now };
  out.sig = crypto.sign("sha256", Buffer.from(canon(out)), { key: keys().priv, dsaEncoding: "ieee-p1363" }).toString("base64");
  await kvSaveScore(out);
  res.status(200).json({ ok: true, rec: out, clamped: stage !== int(r.stage, 0, MAX_STAGE) || total !== int(r.total, 0, 1e9) });
};
