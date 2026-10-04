// חידון בראשית — מנהלים בשרת:
// 1) בדיקת קוד (הקודים לא נמצאים בקוד הדף): {code} → {ok, kind:"admin"|"unlock"}
// 2) חתימה על הודעת מנהל: {code, sign:{topic, msg}} → {ok, sig}
//    הדפדפנים של השחקנים מקבלים הודעות מנהל (הודעה לכולם, טיימר, הודעה אישית, פקודה לשחקן) רק עם חתימה תקינה.
// BQ_ADMIN_CODE / BQ_UNLOCK_CODE / BQ_SIGN_KEY — משתני סביבה ב-Vercel.
const crypto = require("crypto");

function same(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
const ROOT = "tfv-bereshit-quiz/v1/";
const SIGNABLE = /^tfv-bereshit-quiz\/v1\/(announce|timer|admin\/u[a-z0-9]{4,14}|dm\/u[a-z0-9]{4,14}\/[A-Za-z0-9_-]{1,40})$/;
const SIGNABLE_MX = /^tfv-matrix-games\/v1\/admin\/u[a-z0-9]{4,14}$/; // משחקי הלוח — פקודת שינוי שם

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const code = String((body && body.code) || "").trim().slice(0, 40);
  const admin = process.env.BQ_ADMIN_CODE || "", unlock = process.env.BQ_UNLOCK_CODE || "";
  let kind = null;
  if (code && admin && same(code, admin)) kind = "admin";
  else if (code && unlock && same(code, unlock)) kind = "unlock";
  if (!kind) { await new Promise(r => setTimeout(r, 900)); res.status(200).json({ ok: false, kind: null }); return; } // השהיה רק בכישלון — מאט ניחוש

  const sg = body && body.sign;
  if (!sg) { res.status(200).json({ ok: true, kind }); return; }
  const topic = String(sg.topic || ""), msg = String(sg.msg || "");
  if (!(SIGNABLE.test(topic) || SIGNABLE_MX.test(topic)) || msg.length > 6000) { res.status(400).json({ ok: false, error: "topic" }); return; }
  try {
    const priv = crypto.createPrivateKey({ key: Buffer.from(process.env.BQ_SIGN_KEY || "", "base64"), format: "der", type: "pkcs8" });
    const sig = crypto.sign("sha256", Buffer.from(topic + "|" + msg), { key: priv, dsaEncoding: "ieee-p1363" }).toString("base64");
    res.status(200).json({ ok: true, kind, sig });
  } catch (e) { res.status(500).json({ ok: false, error: "sign" }); }
};
