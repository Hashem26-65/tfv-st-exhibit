// חידון בראשית — שליחת Web Push בלי ספריות חיצוניות (RFC 8291 aes128gcm + VAPID לפי RFC 8292).
// הקובץ מתחיל בקו תחתון — Vercel לא הופך אותו לנקודת קצה, רק bq-push / bq-store משתמשים בו.
const crypto = require("crypto");

// המפתח הציבורי של VAPID (לא סודי — גם הדפדפן מקבל אותו). הפרטי: משתנה הסביבה VAPID_PRIVATE (d ב-base64url).
const VAPID_PUBLIC = "BK0meUsG0D4DWa8SOre3d_H3tkJL_gkFCB2xBEoQSPbqC7y6xeK9yZuWjjyAYkWK5-vU4f2XF1dOCZOx6F85mQ8";
const SUBJECT = "https://tfv-st-exhibit.vercel.app";

const b64u = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

// רק שרתי ההתראות של הדפדפנים — כדי שאף אחד לא ינצל את השרת לשלוח בקשות לכתובות אחרות
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
function validSub(sub) {
  try {
    const u = new URL(sub.endpoint);
    if (u.protocol !== "https:" || !PUSH_HOSTS.test(u.hostname) || sub.endpoint.length > 1000) return false;
    const p = unb64u(sub.keys && sub.keys.p256dh), a = unb64u(sub.keys && sub.keys.auth);
    return p.length === 65 && p[0] === 4 && a.length === 16;
  } catch (e) { return false; }
}

// הצפנת התוכן לדפדפן (RFC 8291). salt / asKeys אופציונליים — רק לבדיקה מול וקטור הבדיקה של ה-RFC.
function encrypt(payload, sub, salt, asKeys) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1");
  if (asKeys) ecdh.setPrivateKey(unb64u(asKeys.d)); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPub);
  salt = salt ? unb64u(salt) : crypto.randomBytes(16);
  const prkKey = hmac(auth, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPub.length;
  return Buffer.concat([head, asPub, ct]);
}

function vapidKey() {
  const d = process.env.VAPID_PRIVATE || "", pub = unb64u(VAPID_PUBLIC);
  if (!d || pub.length !== 65) return null;
  return crypto.createPrivateKey({ format: "jwk", key: { kty: "EC", crv: "P-256", d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) } });
}
function vapidAuth(endpoint, key) {
  const aud = new URL(endpoint).origin;
  const h = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const p = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }));
  const sig = crypto.sign("sha256", Buffer.from(h + "." + p), { key, dsaEncoding: "ieee-p1363" });
  return "vapid t=" + h + "." + p + "." + b64u(sig) + ", k=" + VAPID_PUBLIC;
}

// שליחה אחת. מחזיר את קוד ה-HTTP (201 = נשלח; 404/410 = המנוי כבר לא קיים וצריך למחוק אותו).
async function send(sub, data, ttl) {
  const key = vapidKey();
  if (!key) throw new Error("VAPID key missing");
  if (!validSub(sub)) return 400;
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(ttl || 12 * 3600),
      Urgency: "normal", Authorization: vapidAuth(sub.endpoint, key) },
    body: encrypt(JSON.stringify(data), sub),
    signal: AbortSignal.timeout(6000)
  });
  return r.status;
}

/* ── טקסטים בכל השפות ── */
const T = {
  he: { dt: "☀️ האתגר היומי מחכה לכם", db: "5 שאלות חדשות על בראשית — שמרו על הרצף! 🔥", ds: "🔥 רצף של {n} ימים — אל תשברו אותו עכשיו!",
        ct: "⚔️ {name} ענה/תה על האתגר שלך", cw: "🏆 ניצחת — {m} מול {t}", cl: "💪 {name} ניצח/ה — {t} מול {m}. אתגרו בחזרה!", cd: "🤝 תיקו — {m} מול {t}" },
  en: { dt: "☀️ Your daily challenge is ready", db: "5 new questions on Genesis — keep your streak going! 🔥", ds: "🔥 {n}-day streak — don't break it now!",
        ct: "⚔️ {name} took your challenge", cw: "🏆 You won — {m} vs {t}", cl: "💪 {name} won — {t} vs {m}. Challenge them back!", cd: "🤝 It's a tie — {m} vs {t}" },
  ru: { dt: "☀️ Ежедневное испытание ждёт вас", db: "5 новых вопросов о Книге Бытия — сохраните свою серию! 🔥", ds: "🔥 Серия {n} дн. — не прерывайте её!",
        ct: "⚔️ {name} принял(а) ваш вызов", cw: "🏆 Вы победили — {m} : {t}", cl: "💪 {name} победил(а) — {t} : {m}. Бросьте ответный вызов!", cd: "🤝 Ничья — {m} : {t}" },
  ar: { dt: "☀️ تحدّي اليوم بانتظارك", db: "5 أسئلة جديدة عن سفر التكوين — حافظ على سلسلتك! 🔥", ds: "🔥 سلسلة من {n} أيام — لا تقطعها الآن!",
        ct: "⚔️ {name} قبل تحدّيك", cw: "🏆 فزت — {m} مقابل {t}", cl: "💪 فاز {name} — {t} مقابل {m}. تحدَّه من جديد!", cd: "🤝 تعادل — {m} مقابل {t}" },
  zh: { dt: "☀️ 今日挑战已就绪", db: "5道关于《创世记》的新题——保持你的连胜！🔥", ds: "🔥 已连续{n}天——别在现在中断！",
        ct: "⚔️ {name} 接受了你的挑战", cw: "🏆 你赢了——{m} 比 {t}", cl: "💪 {name} 赢了——{t} 比 {m}。再挑战一次！", cd: "🤝 平局——{m} 比 {t}" },
  fr: { dt: "☀️ Votre défi du jour vous attend", db: "5 nouvelles questions sur la Genèse — gardez votre série ! 🔥", ds: "🔥 Série de {n} jours — ne la brisez pas maintenant !",
        ct: "⚔️ {name} a relevé votre défi", cw: "🏆 Vous avez gagné — {m} contre {t}", cl: "💪 {name} a gagné — {t} contre {m}. Relancez le défi !", cd: "🤝 Égalité — {m} contre {t}" },
  es: { dt: "☀️ Tu reto diario te espera", db: "5 preguntas nuevas sobre el Génesis — ¡mantén tu racha! 🔥", ds: "🔥 Racha de {n} días — ¡no la rompas ahora!",
        ct: "⚔️ {name} aceptó tu reto", cw: "🏆 ¡Ganaste! — {m} a {t}", cl: "💪 {name} ganó — {t} a {m}. ¡Devuélvele el reto!", cd: "🤝 Empate — {m} a {t}" },
  de: { dt: "☀️ Deine Tagesaufgabe wartet", db: "5 neue Fragen zur Genesis – halte deine Serie am Leben! 🔥", ds: "🔥 {n} Tage in Folge – jetzt nicht abbrechen!",
        ct: "⚔️ {name} hat deine Herausforderung angenommen", cw: "🏆 Du hast gewonnen – {m} zu {t}", cl: "💪 {name} hat gewonnen – {t} zu {m}. Fordere zurück!", cd: "🤝 Unentschieden – {m} zu {t}" },
  pt: { dt: "☀️ Seu desafio diário está esperando", db: "5 novas perguntas sobre Gênesis — mantenha sua sequência! 🔥", ds: "🔥 Sequência de {n} dias — não a quebre agora!",
        ct: "⚔️ {name} aceitou seu desafio", cw: "🏆 Você venceu — {m} a {t}", cl: "💪 {name} venceu — {t} a {m}. Desafie de volta!", cd: "🤝 Empate — {m} a {t}" }
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : ""));
const GAME = "https://tfv-st-exhibit.vercel.app/games/bereshit-quiz";

function dailyMsg(lang, streak) {
  const t = T[lang] || T.he;
  return { title: t.dt, body: streak > 1 ? fill(t.ds, { n: streak }) : t.db, url: GAME + "?daily=1", tag: "bq-daily" };
}
function challengeMsg(lang, name, mine, theirs, id) {
  const t = T[lang] || T.he, v = { name, m: mine, t: theirs };
  const body = mine > theirs ? t.cw : mine < theirs ? t.cl : t.cd;
  return { title: fill(t.ct, v), body: fill(body, v), url: GAME + "?ch=" + id, tag: "bq-ch-" + id };
}

module.exports = { send, encrypt, validSub, dailyMsg, challengeMsg, VAPID_PUBLIC, b64u, unb64u };
