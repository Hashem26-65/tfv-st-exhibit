/* ============================================================
   exhibit.js · סכומי אלפים — TFV
   מנוע הפעלה: ניגון 5 קבצי אודיו ברצף, הפעלת cue-points
   מסונכרנים לקריינות, והנעת כל האנימציות.
   ============================================================ */
(function () {
  "use strict";

  const ACTS = SOT.ACTS;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // עזר תרגום: מחזיר טקסט לפי השפה הפעילה
  function L(he, en) { return lang === "en" ? en : he; }

  // ---- מצב ----
  let actIndex = 0;
  let audio = null;
  let paused = false;
  let popResume = false;   // האם להמשיך לנגן אחרי סגירת חלון הסבר
  let playbackRate = parseFloat(localStorage.getItem("sot-rate")) || 1;
  let volume = parseFloat(localStorage.getItem("sot-vol"));
  if (isNaN(volume) || volume < 0 || volume > 1) volume = 1;
  let muted = false;          // השתקה זמנית (אינה מאפסת את ערך העוצמה)
  let bright = parseFloat(localStorage.getItem("sot-bright"));   // 0..100, 50 = ניטרלי
  if (isNaN(bright) || bright < 0 || bright > 100) bright = 50;
  let lang = localStorage.getItem("sot-lang") || "he";
  if (lang !== "en") lang = "he";
  let firedKey = "";       // "actIndex:cueIndex" של ה-cue האחרון שהופעל
  const firedSet = new Set();
  let started = false;
  let speakTimer = null;   // טיימר להחזרת המילה המדוברת לגודלה

  // ---- אלמנטים קבועים ----
  const intro = $("#intro");
  const btnEnter = $("#btn-enter");
  const btnAudio = $("#btn-audio");
  const btnReplay = $("#btn-replay");
  const icoPlay = $("#ico-play");
  const icoPause = $("#ico-pause");
  const progress = $("#progress");

  // ============================================================
  //  בניית פס ההתקדמות
  // ============================================================
  ACTS.forEach((a, i) => {
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.title = a.title;
    dot.addEventListener("click", () => { if (started) gotoAct(i); });
    progress.appendChild(dot);
  });
  const label = document.createElement("span");
  label.className = "label";
  progress.appendChild(label);

  function paintProgress() {
    $$(".dot", progress).forEach((d, i) => {
      d.classList.toggle("active", i === actIndex);
      d.classList.toggle("done", i < actIndex);
    });
    label.textContent = ACTS[actIndex].title;
  }

  // ============================================================
  //  בניית מילות הפסוק (אקט 1)
  // ============================================================
  const verseRow = $("#verse-row");
  const wordEls = [];
  const vline1 = document.createElement("div"); vline1.className = "verse-line";
  const vline2 = document.createElement("div"); vline2.className = "verse-line";
  verseRow.appendChild(vline1);
  verseRow.appendChild(vline2);
  SOT.WORDS.forEach((w, i) => {
    const el = document.createElement("div");
    el.className = "word";
    el.dataset.i = i;
    el.innerHTML = `<span class="word-en">${w.en}</span><span class="he">${w.he}</span><span class="val">${w.val}</span>`;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", "הסבר על המילה " + w.he);
    (i < 3 ? vline1 : vline2).appendChild(el);   // 3 ראשונות בשורה ראשונה, 4 בשנייה
    wordEls.push(el);
  });
  // לחיצה על המילה עצמה → הסבר (ללא סימון גלוי)
  verseRow.addEventListener("click", (e) => {
    const card = e.target.closest(".word");
    if (card) { e.stopPropagation(); openWordPop(parseInt(card.dataset.i, 10)); }
  });
  verseRow.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".word");
    if (card) { e.preventDefault(); openWordPop(parseInt(card.dataset.i, 10)); }
  });

  // ============================================================
  //  חלון הסבר — לחיצה על מספר מרכזי
  // ============================================================
  const EXPLAIN = {
    "2701": {
      num: "2701",
      body: "סכום ערכי שבע מילות הפסוק הראשון. זהו גם <b>המספר המשולשי ה־73</b> — ערכו הכולל של הפסוק.",
    },
    "82": {
      num: "82",
      body: "ערך הפסוק הראשון ב<b>גימטריה קטנה</b> — כל אות ללא האפסים (ת=4, ש=3 וכו׳). זהו המכפיל שמחזיר את התופעה.",
    },
    product: {
      num: "304,153,525,784,175,760",
      body: "מכפלת שבע המילים זו בזו (<b>18 ספרות</b>). סכום קבוצות האלפים שלו = <b>2701</b>.",
    },
    x82: {
      num: "24,940,589,114,302,412,320",
      body: "המכפלה כפול <b>82</b>. שוב — סכום קבוצות האלפים = <b>2701</b> בדיוק.",
    },
    x82_2: {
      num: "2,045,128,307,372,797,810,240",
      body: "המכפלה כפול <b>82²</b>. סכום קבוצות האלפים = <b>2701</b>, וסכום כל הספרות = <b>82</b>.",
    },
  };
  const pop = $("#pop");
  // עצירת הקריינות בעת פתיחת הסבר, וחידושה בסגירה
  function pauseForPopup() {
    if (audio && !audio.paused) {
      audio.pause();
      paused = true;
      popResume = true;
      setPauseIcon(true);
    }
  }
  function resumeAfterPopup() {
    if (popResume) {
      popResume = false;
      paused = false;
      setPauseIcon(false);
      if (audio) audio.play().catch(() => {});
    }
  }
  function openPop(key) {
    const d = EXPLAIN[key];
    if (!d) return;
    pauseForPopup();
    $("#pop-num").innerHTML = d.num;
    $("#pop-body").innerHTML = d.body;
    pop.classList.add("open");
    pop.setAttribute("aria-hidden", "false");
  }
  function openWordPop(i) {
    const w = SOT.WORDS[i];
    if (!w) return;
    pauseForPopup();
    const eq = w.letters
      .map(([l, v]) => `<span class="g-cell"><span class="g-let">${l}</span><span class="g-val">${v}</span></span>`)
      .join('<span class="g-plus">+</span>');
    $("#pop-num").innerHTML = `<span class="pop-word">${w.he}</span>` +
      (lang === "en" ? `<div class="pop-translit">${w.en}</div>` : "");
    $("#pop-body").innerHTML =
      `<div class="pop-mean">${L(w.meaning, w.enMeaning)}</div>` +
      `<div class="pop-gem-title">${L("איך מגיעים לערך?", "How is the value reached?")}</div>` +
      `<div class="pop-gem">${eq}<span class="g-eq">=</span><span class="g-total">${w.val}</span></div>`;
    pop.classList.add("open");
    pop.setAttribute("aria-hidden", "false");
  }
  function closePop() {
    pop.classList.remove("open");
    pop.setAttribute("aria-hidden", "true");
    resumeAfterPopup();
  }
  $("#pop-close").addEventListener("click", closePop);
  $("#pop-back").addEventListener("click", closePop);
  function makeTap(el, key) {
    if (!el) return;
    el.classList.add("tap");
    el.onclick = () => openPop(key);
  }

  // ============================================================
  //  עזרי-תצוגה למספר ענק עם הדגשת קבוצות אלפים
  // ============================================================
  function renderBigNumber(el, digitsStr) {
    // פיצול לקבוצות של 3 ספרות מימין (LTR)
    const groups = [];
    let s = digitsStr;
    while (s.length > 3) { groups.unshift(s.slice(-3)); s = s.slice(0, -3); }
    groups.unshift(s);
    el.innerHTML = groups
      .map((g, i) => `<span class="grp" data-g="${i}">${g}</span>`)
      .join('<span class="sep">,</span>');
  }
  function litGroup(el, i) {
    const g = el.querySelector(`.grp[data-g="${i}"]`);
    if (g) g.classList.add("lit");
  }

  // מונה מצטבר מונפש
  let instant = false;   // בעת קפיצה-בזמן: לעדכן ערכים מיידית בלי אנימציה
  function tickRunning(el, to, dur) {
    if (instant) { el.textContent = fmt(to); return; }
    dur = dur || 700;
    const from = parseInt(String(el.textContent).replace(/[^\d]/g, ""), 10) || 0;
    const t0 = performance.now();
    function frame(t) {
      const k = Math.min(1, (t - t0) / dur);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = fmt(v);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  //  טבלת הפעולות — כל cue.do מצביע לכאן
  // ============================================================
  const groupAccum = { 2: 0, 3: 0, 4: 0 }; // סכום רץ לפי מספר אקט

  const ACTIONS = {
    // ---------- אקט 1 ----------
    showVerse() {
      $$(".word", verseRow).forEach((el, i) => {
        if (instant) el.classList.add("in");            // קפיצת-זמן: מיד, ללא אנימציה חוזרת
        else setTimeout(() => el.classList.add("in"), i * 120);
      });
    },
    primeValues() {
      $$(".word", verseRow).forEach((el) => el.classList.remove("hot"));
    },
    revealValue(i) {
      const el = wordEls[i];
      if (!el) return;
      // החזרת כל המילים לגודל המקורי, והגדלה עדינה של המילה הנוכחית
      wordEls.forEach((w) => w.classList.remove("speaking"));
      el.classList.add("hot", "speaking");
      $(".val", el).classList.add("show");
      setTimeout(() => el.classList.remove("hot"), 900);
      if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
      if (instant) {
        // בקפיצת-זמן: לא להשאיר מילה מוגדלת
        el.classList.remove("speaking");
      } else {
        // בתום הדיבור על המילה — חזרה לגודל המקורי (גם אם זו המילה האחרונה)
        speakTimer = setTimeout(() => el.classList.remove("speaking"), 2300);
      }
    },

    // ---------- אקט 2 ----------
    act2Begin() {
      $("#act2-title").textContent = L("חִיבּוּר · 2701", "Addition · 2701");
      $("#act2-lede").textContent = L("סכום ערכי שבע המילים.", "The sum of the seven word-values.");
      const pill = $("#sum-pill");
      pill.classList.add("in");
      $("#sum-num").textContent = "0";
      tickRunning($("#sum-num"), 2701, 3500);
    },
    landSum2701() {
      $("#sum-num").textContent = "2701";
      $("#sum-pill").classList.add("flash");
      $("#sum-note").textContent = L("= ערך הפסוק", "= the verse total");
      makeTap($("#sum-num"), "2701");
    },
    switchToProduct() {
      $("#act2-title").textContent = L("וְאִם נַכְפִּיל?", "And if we multiply?");
      $("#act2-lede").innerHTML = L("במקום לחבר — נכפיל את שבע המילים זו בזו.",
        "Instead of adding — we multiply the seven words together.");
      $("#sum-pill").querySelector(".op").textContent = "∏";
      $("#sum-num").textContent = "—";
      $("#sum-note").textContent = "";
      $("#sum-pill").classList.remove("flash");
    },
    walkProduct() {
      // הדגשת המילים בזו אחר זו (כפל)
      SOT.WORDS.forEach((w, i) =>
        setTimeout(() => {
          const el = verseRow.children[i];
          // המילים כבר לא בבמה (אקט אחר) — נדגיש את כדור-הסכום במקום
        }, i * 900));
      $("#sum-pill").style.display = "none";
    },
    showProduct() {
      const el = $("#product-num");
      renderBigNumber(el, SOT.PRODUCT);
      el.classList.add("in");
      makeTap(el, "product");
      $("#act2-lede").innerHTML = L("המכפלה — מספר בן 18 ספרות.", "The product — an 18-digit number.");
    },
    splitProductGroups() {
      $("#act2-lede").innerHTML = L("נחבר את קבוצות האלפים שלו (כפי שמופרדות בפסיקים).",
        "We add its thousands-groups (as separated by commas).");
      const line = $("#groups2");
      line.style.display = "flex";
      line.innerHTML = SOT.GROUPS_PRODUCT
        .map((g, i) => `<span class="grp-chip" data-i="${i}">${g}</span>`)
        .join("");
      const run = $("#run2");
      run.style.display = "block";
      run.textContent = "0";
      groupAccum[2] = 0;
    },
    addGroup(i) {
      const chip = $(`#groups2 .grp-chip[data-i="${i}"]`);
      if (chip) chip.classList.add("added");
      litGroup($("#product-num"), i);
      groupAccum[2] += SOT.GROUPS_PRODUCT[i];
      tickRunning($("#run2"), groupAccum[2], 500);
    },
    landGroups2701() {
      $("#run2").textContent = "2701";
      $("#run2").classList.add("land");
      $("#act2-lede").innerHTML = L("<b>סכום קבוצות האלפים = 2701</b> — בדיוק כסכום ערכי המילים.",
        "<b>The sum of the thousands-groups = 2701</b> — exactly like the sum of the word-values.");
    },

    // ---------- אקט 3 ----------
    act3Begin() {
      $("#act3-lede").innerHTML = L("בגימטריה קטנה כל אות מקבלת את ערכה ללא האפסים.",
        "In reduced gematria each letter takes its value without the zeros.");
    },
    showSmallExample() {
      const ex = $("#small-ex");
      const data = [
        { letter: "ת", from: "400", to: "4" },
        { letter: "ש", from: "300", to: "3" },
      ];
      ex.innerHTML = data.map(d =>
        `<div class="cell"><div class="letter">${d.letter}</div>
         <div class="arrow">↓</div>
         <div><span class="from">${d.from}</span> → <span class="to">${d.to}</span></div></div>`
      ).join("");
      $$(".cell", ex).forEach((c, i) => {
        if (instant) c.classList.add("in");
        else setTimeout(() => c.classList.add("in"), i * 500);
      });
    },
    reveal82() {
      const p = $("#pill82");
      p.style.display = "inline-flex";
      p.classList.add("in", "flash");
      makeTap(p.querySelector(".num"), "82");
      $("#act3-lede").innerHTML = L("הגימטריה הקטנה של הפסוק כולו = <b>82</b>.",
        "The reduced gematria of the whole verse = <b>82</b>.");
    },
    showFailMultiples() {
      $("#small-ex").style.display = "none";
      $("#act3-lede").innerHTML = L("נחזור למכפלה. נכפיל ב־2, ב־3, ב־4… — סכום האלפים <i>אינו</i> חוזר ל־2701.",
        "Back to the product. ×2, ×3, ×4… — the thousands-sum does <i>not</i> return to 2701.");
      const row = $("#fail-row");
      row.style.display = "flex";
      ["×2", "×3", "×4", "×5", "…"].forEach((t, i) => {
        const c = document.createElement("span");
        c.className = "fail-chip";
        c.textContent = t;
        row.appendChild(c);
        if (instant) c.classList.add("in");
        else setTimeout(() => { c.classList.add("in", "shake"); }, i * 350);
      });
    },
    applyTimes82() {
      $("#fail-row").style.display = "none";
      $("#pill82").classList.remove("flash");
      $("#act3-lede").innerHTML = L("אך כאשר מכפילים את המכפלה ב־<b>82</b> בדיוק…",
        "But when we multiply the product by exactly <b>82</b>…");
    },
    showX82() {
      const el = $("#x82-num");
      renderBigNumber(el, SOT.X82);
      el.classList.add("in");
      makeTap(el, "x82");
      $("#act3-lede").innerHTML = L("מתקבל מספר חדש וגדול בהרבה.", "A new, far larger number appears.");
    },
    splitX82Groups() {
      $("#act3-lede").innerHTML = L("וסכום קבוצות האלפים שלו…", "and the sum of its thousands-groups…");
      const line = $("#groups3");
      line.style.display = "flex";
      line.innerHTML = SOT.GROUPS_X82
        .map((g, i) => `<span class="grp-chip" data-i="${i}">${g}</span>`)
        .join("");
      const run = $("#run3");
      run.style.display = "block";
      run.textContent = "0";
      groupAccum[3] = 0;
    },
    addGroupB(i) {
      const chip = $(`#groups3 .grp-chip[data-i="${i}"]`);
      if (chip) chip.classList.add("added");
      litGroup($("#x82-num"), i);
      groupAccum[3] += SOT.GROUPS_X82[i];
      tickRunning($("#run3"), groupAccum[3], 500);
    },
    landGroupsB2701() {
      $("#run3").textContent = "2701";
      $("#run3").classList.add("land");
      $("#act3-lede").innerHTML = L("<b>שוב 2701 בדיוק.</b>", "<b>Again — exactly 2701.</b>");
    },

    // ---------- אקט 4 ----------
    act4Begin() {
      $("#act4-lede").innerHTML = L("ההתאמה אינה עומדת בפני עצמה — היא חלק ממערכת רחבה.",
        "This correspondence does not stand alone — it is part of a broader system.");
    },
    showFailAgain() {
      $("#act4-lede").innerHTML = L("גם אחרי ההכפלה ב־82, כפולות אחרות אינן מחזירות את 2701.",
        "Even after ×82, other multiples do not bring back 2701.");
    },
    applyTimes82Again() {
      $("#act4-lede").innerHTML = L("אך מכפילים שוב ב־<b>82</b> — והתופעה מתרחשת מחדש.",
        "But multiply again by <b>82</b> — and the phenomenon recurs.");
    },
    showX82_2() {
      const el = $("#x82-2-num");
      renderBigNumber(el, SOT.X82_2);
      el.classList.add("in");
      makeTap(el, "x82_2");
      $("#act4-lede").innerHTML = L("פעם נוספת מתקבל מספר עצום.", "Once again, an enormous number appears.");
    },
    splitX82_2Groups() {
      $("#act4-lede").innerHTML = L("וסכום קבוצות האלפים שלו…", "and the sum of its thousands-groups…");
      const line = $("#groups4");
      line.style.display = "flex";
      line.innerHTML = SOT.GROUPS_X82_2
        .map((g, i) => `<span class="grp-chip" data-i="${i}">${g}</span>`)
        .join("");
      const run = $("#run4");
      run.style.display = "block";
      run.textContent = "0";
      groupAccum[4] = 0;
    },
    addGroupC(i) {
      const chip = $(`#groups4 .grp-chip[data-i="${i}"]`);
      if (chip) chip.classList.add("added");
      litGroup($("#x82-2-num"), i);
      groupAccum[4] += SOT.GROUPS_X82_2[i];
      tickRunning($("#run4"), groupAccum[4], 500);
    },
    landGroupsC2701() {
      $("#run4").textContent = "2701";
      $("#run4").classList.add("land");
      $("#act4-lede").innerHTML = L("<b>ושוב — 2701 בדיוק.</b>", "<b>And again — exactly 2701.</b>");
    },

    // ---------- אקט 5 ----------
    act5Begin() {
      $("#act5-lede").innerHTML = L("חברו את כל ספרות המספר העצום — ספרה אחר ספרה.",
        "Add all the digits of the enormous number — digit by digit.");
      $("#digit-sum").style.display = "";
      $("#digit-sum").textContent = "0";
    },
    walkDigits() {
      // המונה מונע מזמן-האודיו (ראו updateDigitClimb) — כך הוא נכון גם בגרירה
      $("#digit-sum").style.display = "";
    },
    landDigitSum82() {
      $("#digit-sum").textContent = "82";
      $("#digit-sum").classList.add("land");
      makeTap($("#digit-sum"), "82");
      $("#act5-lede").innerHTML = L("סכום הספרות כולו = <b>82</b>.", "The sum of all the digits = <b>82</b>.");
    },
    tagSmallGematria() {
      $("#act5-lede").innerHTML = L("וזהו בדיוק ערך הפסוק בגימטריה קטנה.",
        "and this is exactly the verse's reduced-gematria value.");
    },
    showCircleClose() {
      $("#act5-title").textContent = L("סְגִירַת הַמַּעְגָּל", "The Circle Closes");
      $("#act5-lede").innerHTML = L("מצד אחד <b>2701</b> — ערך הפסוק. מצד שני <b>82</b> — גימטריה קטנה.",
        "On one side <b>2701</b> — the verse total. On the other <b>82</b> — reduced gematria.");
      $("#digit-sum").style.display = "none";
      $("#circle-close").classList.add("in");
    },
    wheelSecret() {
      $("#act5-lede").innerHTML = L('אחד מהיבטיו של מה שמכונה בקבלה <i>"סוד חזרת הגלגל"</i>.',
        'one aspect of what Kabbalah calls <i>“The Secret of the Return of the Wheel.”</i>');
    },
    closingQuestions() {
      $("#act5-lede").innerHTML = L("האם כאן מסתיימת המערכת? מה עוד מסתתר בפסוק הראשון בתורה?",
        "Does the system end here? What else is hidden in the Torah's first verse?");
    },
    showContinue() {
      $("#continue-btn").classList.add("in");
    },
    showGate() {
      $("#circle-close").style.display = "none";
      $("#act5-lede").style.display = "none";
      $("#act5-title").style.display = "none";
      $("#continue-btn").style.display = "none";
      $("#gate").classList.add("in");
    },
  };

  // ============================================================
  //  מנוע ה-cue
  // ============================================================
  // מקורות תלויי-שפה: cues ו-subtitles
  function actCues() {
    if (lang === "en" && SOT.CUES_EN && SOT.CUES_EN[actIndex]) return SOT.CUES_EN[actIndex];
    return ACTS[actIndex].cues;
  }
  function subsList() {
    return (lang === "en" && SOT.SUBS_EN) ? SOT.SUBS_EN : SOT.SUBS;
  }

  function fireDueCues() {
    if (!audio) return;
    const t = audio.currentTime;
    const cues = actCues();
    for (let i = 0; i < cues.length; i++) {
      const key = actIndex + ":" + i;
      if (t >= cues[i].t && !firedSet.has(key)) {
        firedSet.add(key);
        const fn = ACTIONS[cues[i].do];
        if (fn) {
          try { fn.call(null, cues[i].a); }
          catch (e) { console.warn("cue error", cues[i].do, e); }
        }
      }
    }
    updateSubtitle(t);
    if (actIndex === 4) updateDigitClimb(t);
    updateScrubber();
  }

  // ============================================================
  //  פס-זמן נגרר (סרגל הסרט)
  // ============================================================
  const scrubber = $("#scrubber");
  const scrubFill = $("#scrub-fill");
  const scrubHandle = $("#scrub-handle");
  const scrubTime = $("#scrub-time");
  let dragging = false;

  function fmtClock(s) {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function updateScrubber() {
    if (!audio) return;
    const dur = audio.duration || ACTS[actIndex].duration || 0;
    const t = audio.currentTime || 0;
    const pct = dur ? Math.min(100, (t / dur) * 100) : 0;
    scrubFill.style.width = pct + "%";
    scrubHandle.style.left = pct + "%";
    scrubber.setAttribute("aria-valuenow", Math.round(pct));
    scrubTime.textContent = fmtClock(t) + " / " + fmtClock(dur);
  }
  function fracFromEvent(e) {
    const r = scrubber.getBoundingClientRect();
    const x = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX) || 0;
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  }
  function lightSeek(e) {           // בזמן גרירה — עדכון קל ומהיר
    if (!audio) return;
    const dur = audio.duration || ACTS[actIndex].duration || 1;
    const t = fracFromEvent(e) * dur;
    try { audio.currentTime = t; } catch (er) {}
    updateScrubber();
    updateSubtitle(t);
    if (actIndex === 4) updateDigitClimb(t);
  }
  scrubber.addEventListener("pointerdown", (e) => {
    if (!started || !audio) return;
    dragging = true; scrubber.classList.add("drag");
    try { scrubber.setPointerCapture(e.pointerId); } catch (er) {}
    lightSeek(e);
  });
  scrubber.addEventListener("pointermove", (e) => { if (dragging) lightSeek(e); });
  function endDrag() {
    if (!dragging) return;
    dragging = false; scrubber.classList.remove("drag");
    if (audio) seekTo(audio.currentTime);   // שחזור מלא של המצב החזותי
  }
  scrubber.addEventListener("pointerup", endDrag);
  scrubber.addEventListener("pointercancel", endDrag);
  // חיצים: דילוג ±5 שניות
  scrubber.addEventListener("keydown", (e) => {
    if (!audio) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); seekTo(audio.currentTime - 5); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seekTo(audio.currentTime + 5); }
  });

  // מונה סכום-הספרות (אקט 5) — מטפס מ-0 ל-82 לפי זמן האודיו (חלון תלוי-שפה)
  function updateDigitClimb(t) {
    const el = $("#digit-sum");
    if (!el) return;
    const w = (SOT.DIGIT_CLIMB && SOT.DIGIT_CLIMB[lang]) || { start: 0.5, end: 12.48, hide: 21.0 };
    if (t >= w.hide) return;        // אחרי כן מוחלף בתצוגת „סגירת המעגל”
    let v;
    if (t <= w.start) v = 0;
    else if (t >= w.end) v = 82;
    else v = Math.round(((t - w.start) / (w.end - w.start)) * 82);
    const s = String(v);
    if (el.textContent !== s) el.textContent = s;
  }

  // ---- איפוס מצב חזותי של כל האקטים (לקראת קפיצה-בזמן / ניגון חוזר) ----
  function resetAllVisuals() {
    // אקט 1
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
    $$(".word", verseRow).forEach((el) => {
      el.classList.remove("in", "hot", "speaking");
      const v = $(".val", el); if (v) v.classList.remove("show");
    });
    // אקט 2
    const sp = $("#sum-pill");
    sp.classList.remove("in", "flash"); sp.style.display = "";
    sp.querySelector(".op").textContent = "∑";
    $("#sum-num").textContent = "—"; $("#sum-num").classList.remove("tap"); $("#sum-num").onclick = null;
    $("#sum-note").textContent = "";
    $("#product-num").className = "bignum"; $("#product-num").innerHTML = ""; $("#product-num").onclick = null;
    $("#groups2").style.display = "none"; $("#groups2").innerHTML = "";
    $("#run2").style.display = "none"; $("#run2").textContent = "0"; $("#run2").classList.remove("land");
    // אקט 3
    $("#small-ex").style.display = ""; $("#small-ex").innerHTML = "";
    $("#pill82").style.display = "none"; $("#pill82").classList.remove("in", "flash");
    $("#fail-row").style.display = "none"; $("#fail-row").innerHTML = "";
    $("#x82-num").className = "bignum"; $("#x82-num").innerHTML = ""; $("#x82-num").onclick = null;
    $("#groups3").style.display = "none"; $("#groups3").innerHTML = "";
    $("#run3").style.display = "none"; $("#run3").textContent = "0"; $("#run3").classList.remove("land");
    // אקט 4
    $("#x82-2-num").className = "bignum"; $("#x82-2-num").innerHTML = ""; $("#x82-2-num").onclick = null;
    $("#groups4").style.display = "none"; $("#groups4").innerHTML = "";
    $("#run4").style.display = "none"; $("#run4").textContent = "0"; $("#run4").classList.remove("land");
    // אקט 5
    $("#digit-sum").style.display = ""; $("#digit-sum").textContent = "0";
    $("#digit-sum").classList.remove("land"); $("#digit-sum").classList.remove("tap"); $("#digit-sum").onclick = null;
    $("#circle-close").style.display = ""; $("#circle-close").classList.remove("in");
    $("#continue-btn").classList.remove("in"); $("#continue-btn").style.display = "";
    $("#gate").classList.remove("in");
    $("#act5-title").style.display = ""; $("#act5-lede").style.display = "";
    groupAccum[2] = groupAccum[3] = groupAccum[4] = 0;
  }

  // ---- קפיצה לזמן מסוים באקט הנוכחי, עם שחזור המצב החזותי ----
  function applyStateAt(t) {
    instant = true;
    resetAllVisuals();
    const cues = actCues();
    for (let i = 0; i < cues.length; i++) firedSet.delete(actIndex + ":" + i);
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].t <= t) {
        firedSet.add(actIndex + ":" + i);
        const fn = ACTIONS[cues[i].do];
        if (fn) { try { fn.call(null, cues[i].a); } catch (e) {} }
      }
    }
    instant = false;
    updateSubtitle(t);
    if (actIndex === 4) updateDigitClimb(t);
  }
  function seekTo(t) {
    if (!audio) return;
    const dur = audio.duration || ACTS[actIndex].duration || 1;
    t = Math.max(0, Math.min(t, dur - 0.05));
    audio.currentTime = t;
    applyStateAt(t);
  }

  // ============================================================
  //  כתוביות (CC)
  // ============================================================
  let ccOn = localStorage.getItem("sot-cc") === "1";
  const subsBar = $("#subs");
  const subsText = $("#subs-text");
  const btnCC = $("#btn-cc");

  function updateSubtitle(t) {
    if (!ccOn) return;
    const list = subsList()[actIndex] || [];
    let txt = "";
    for (let i = 0; i < list.length; i++) {
      if (t >= list[i][0] && t < list[i][1]) { txt = list[i][2]; break; }
    }
    if (subsText.textContent !== txt) subsText.textContent = txt;
  }
  function applyCC(on) {
    ccOn = on;
    try { localStorage.setItem("sot-cc", on ? "1" : "0"); } catch (e) {}
    btnCC.classList.toggle("active", on);
    btnCC.setAttribute("aria-pressed", String(on));
    subsBar.classList.toggle("on", on);
    if (!on) subsText.textContent = "";
    else if (audio) updateSubtitle(audio.currentTime);
  }
  btnCC.addEventListener("click", () => applyCC(!ccOn));
  applyCC(ccOn);   // מצב התחלתי לפי ההעדפה השמורה

  // ============================================================
  //  בורר שפה (אייקון גלובוס → תפריט) — בסגנון אתר TFV
  // ============================================================
  const CC_LABEL = { he: "כתוביות", en: "CC" };
  function updateCCLabel() { btnCC.textContent = CC_LABEL[lang] || "כתוביות"; }

  const langTrigger = $("#lang-trigger");
  const langMenu = $("#lang-menu");
  function toggleLangMenu(force) {
    const open = force !== undefined ? force : !langMenu.classList.contains("open");
    langMenu.classList.toggle("open", open);
    langTrigger.setAttribute("aria-expanded", String(open));
  }
  function setLang(newLang) {
    if (newLang === lang) return;
    lang = newLang;
    try { localStorage.setItem("sot-lang", lang); } catch (e) {}
    document.documentElement.lang = lang;
    $$(".lang-opt").forEach((x) => x.classList.toggle("active", x.dataset.lang === lang));
    updateCCLabel();
    localizeUI();
    // החלפת האודיו לשפה הנבחרת מאותו מיקום-זמן (יחסי) והמשך
    if (started && audio) {
      const oldDur = audio.duration || ACTS[actIndex].duration || 1;
      const frac = oldDur ? audio.currentTime / oldDur : 0;
      const wasPlaying = !audio.paused;
      loadAudio(actIndex);
      audio.addEventListener("loadedmetadata", function once() {
        audio.removeEventListener("loadedmetadata", once);
        const nd = audio.duration || ACTS[actIndex].duration || 1;
        seekTo(frac * nd);
        if (wasPlaying && !paused) audio.play().catch(() => {});
      });
    }
  }
  langTrigger.addEventListener("click", (e) => { e.stopPropagation(); toggleLangMenu(); });
  $$(".lang-opt").forEach((o) =>
    o.addEventListener("click", () => {
      if (o.disabled) return;
      setLang(o.dataset.lang);
      toggleLangMenu(false);
    })
  );
  document.addEventListener("click", (e) => {
    if (!langMenu.contains(e.target) && e.target !== langTrigger && !langTrigger.contains(e.target))
      toggleLangMenu(false);
  });
  // סימון השפה הפעילה ההתחלתית
  $$(".lang-opt").forEach((x) => x.classList.toggle("active", x.dataset.lang === lang));
  document.documentElement.lang = lang;
  updateCCLabel();

  // ---- לוקליזציה של טקסטים סטטיים על המסך ----
  function setTextSel(sel, he, en) { const el = $(sel); if (el) el.textContent = L(he, en); }
  function setHTMLSel(sel, he, en) { const el = $(sel); if (el) el.innerHTML = L(he, en); }
  function localizeUI() {
    document.body.classList.toggle("lang-en", lang === "en");
    // תפריט ההגדרות
    setTextSel("#settings-title-speed", "מהירות הקריינות", "Narration speed");
    setTextSel("#settings-title-vol", "עוצמת הקריינות", "Narration volume");
    setTextSel("#settings-title-bright", "בהירות הרקע", "Background brightness");
    // כותרות אקטים סטטיות (אקט 2/5 נקבעות ע"י cues)
    setTextSel("#act1 h2", "הַפָּסוּק הָרִאשׁוֹן", "The First Verse");
    setTextSel("#verse-ref", "בְּרֵאשִׁית א׳, א׳", "Genesis 1:1");
    setTextSel("#act3 h2", "גִּימַטְרִיָּה קְטַנָּה · 82", "Reduced Gematria · 82");
    setTextSel("#act4 h2", "כֶּפֶל נוֹסָף בְּ־82", "Another ×82");
    // עיגולי סגירת המעגל
    const caps = $$("#circle-close .cap");
    if (caps[0]) caps[0].textContent = L("ערך הפסוק", "verse total");
    if (caps[1]) caps[1].textContent = L("גימטריה קטנה", "reduced gematria");
    setTextSel("#continue-btn", "לְהַמְשִׁיךְ ←", "Continue →");
    // שער חברים
    setTextSel("#gate h2", "חֲבֵרִים", "Members");
    const gp = $$("#gate p");
    if (gp[0]) gp[0].innerHTML = L(
      "חמשת השלבים שלמעלה הם החלק הציבורי. ההמשך — קשרים נוספים למבנים מתמטיים, גיאומטריים ופיזיקליים — שמור לחברים.",
      "The five stages above are the public part. The continuation — further connections to mathematical, geometrical, and physical structures — is reserved for members.");
    if (gp[1]) gp[1].innerHTML = L(
      "חברים מקבלים גישה לסרטונים, מצגות, מאמרים, מחקרים וחומרי העשרה נוספים.",
      "Members receive access to videos, presentations, articles, research, and more.");
    setTextSel("#btn-member", "אֲנִי חָבֵר", "I'm a member");
    setTextSel("#btn-join", "לְהִצְטָרֵף", "Join");
    // מסך פתיחה
    setTextSel(".intro-kicker", "תערוכה", "Exhibit");
    setTextSel(".intro-title", "סְכוּמֵי אֲלָפִים", "Sum of Thousands");
    setTextSel(".intro-sub", "חתימה מתמטית בפסוק הראשון בתורה",
      "A mathematical signature in the Torah's first verse");
    setTextSel(".intro-sitename", "אֲתַר הַפָּסוּק הָרִאשׁוֹן", "The First Verse");
    const ip = $$(".intro-para");
    if (ip[0]) ip[0].innerHTML = L("המצגת מלווה בקריינות. לחצו להתחלה.",
      "The presentation includes narration. Click to begin.");
    setTextSel(".intro-cta", "הַתְחֵל אֶת הַמַּסָּע", "Begin the Journey");
  }
  localizeUI();

  // ============================================================
  //  ניהול אקטים ואודיו
  // ============================================================
  function setActiveAct(i) {
    $$(".act").forEach((el, idx) => el.classList.toggle("active", idx === i));
    paintProgress();
  }

  function audioSrc(i) {
    const file = ACTS[i].audio.split("/").pop();       // שם הקובץ בלבד
    const dir = (SOT.AUDIO_DIR && SOT.AUDIO_DIR[lang]) || "audio-he";
    return encodeURI(dir + "/" + file);
  }
  // אלמנט אודיו יחיד לכל המצגת — נשאר „פתוח” אחרי הלחיצה הראשונה,
  // כך שמעבר אוטומטי בין חלקים עובד גם בנייד (iOS/Safari).
  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = "auto";
    audio.volume = muted ? 0 : volume;
    audio.addEventListener("timeupdate", fireDueCues);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onAudioError);
    audio.addEventListener("loadedmetadata", updateScrubber);
  }
  function loadAudio(i) {
    ensureAudio();
    audio.pause();
    audio.src = audioSrc(i);
    audio.playbackRate = playbackRate;
    audio.load();
  }
  function onAudioError() {
    console.warn("[SOT] audio failed to load:", ACTS[actIndex] && ACTS[actIndex].audio);
  }

  function gotoAct(i, autoplay) {
    actIndex = Math.max(0, Math.min(ACTS.length - 1, i));
    setActiveAct(actIndex);
    if (subsText) subsText.textContent = "";
    loadAudio(actIndex);
    if (autoplay !== false && !paused) {
      audio.play().catch(() => {});
    }
  }

  function onEnded() {
    if (actIndex < ACTS.length - 1) {
      setTimeout(() => { if (!paused) gotoAct(actIndex + 1); }, 900);
    }
  }

  // ============================================================
  //  בקרות
  // ============================================================
  function setPauseIcon(isPaused) {
    icoPlay.style.display = isPaused ? "block" : "none";
    icoPause.style.display = isPaused ? "none" : "block";
  }

  btnAudio.addEventListener("click", () => {
    if (!audio) return;
    if (audio.paused) {
      paused = false;
      audio.play().catch(() => {});
      setPauseIcon(false);
    } else {
      paused = true;
      audio.pause();
      setPauseIcon(true);
    }
  });

  btnReplay.addEventListener("click", () => {
    // נגן מחדש את האקט הנוכחי מתחילתו
    resetActVisuals(actIndex);
    for (let i = 0; i < actCues().length; i++) firedSet.delete(actIndex + ":" + i);
    if (audio) { audio.currentTime = 0; paused = false; setPauseIcon(false); audio.play().catch(() => {}); }
  });

  function resetActVisuals(i) {
    // איפוס מצב חזותי בסיסי לפי אקט (לא ממצה — מספיק לניגון חוזר נקי)
    if (i === 0) {
      if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
      $$(".word", verseRow).forEach(el => { el.classList.remove("in", "hot", "speaking"); $(".val", el).classList.remove("show"); });
    }
  }

  // התחלה
  function start() {
    if (started) return;
    started = true;
    document.body.classList.add("started");
    intro.classList.add("hide");
    setPauseIcon(false);
    gotoAct(0);
  }
  btnEnter.addEventListener("click", start);

  // לחיצה על הלוגו → פתיחת אתר TFV בטאב חדש (פינה + לוגו פתיחה)
  function openSite() {
    const w = window.open("https://thefirstverse.com", "_blank", "noopener");
    if (!w) window.location.href = "https://thefirstverse.com"; // אם חוסם פופ-אפ
  }
  ["#brand-link", "#intro-brand-link"].forEach((sel) => {
    const el = $(sel);
    if (el) {
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => { e.preventDefault(); openSite(); });
    }
  });

  // ============================================================
  //  הגדרות — מהירות הקריינות
  // ============================================================
  const btnSettings = $("#btn-settings");
  const settingsPanel = $("#settings-panel");
  const speedOpts = $("#speed-opts");

  function applyRate(rate) {
    playbackRate = rate;
    if (audio) audio.playbackRate = rate;
    try { localStorage.setItem("sot-rate", String(rate)); } catch (e) {}
    $$("#speed-opts button").forEach((b) =>
      b.classList.toggle("active", parseFloat(b.dataset.rate) === rate));
  }
  // סימון ההעדפה השמורה בטעינה
  $$("#speed-opts button").forEach((b) =>
    b.classList.toggle("active", parseFloat(b.dataset.rate) === playbackRate));

  function toggleSettings(force) {
    const open = force !== undefined ? force : !settingsPanel.classList.contains("open");
    settingsPanel.classList.toggle("open", open);
    settingsPanel.setAttribute("aria-hidden", String(!open));
    btnSettings.setAttribute("aria-expanded", String(open));
  }
  btnSettings.addEventListener("click", (e) => { e.stopPropagation(); toggleSettings(); });
  speedOpts.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rate]");
    if (b) applyRate(parseFloat(b.dataset.rate));
  });

  // ---- עוצמת הקריינות ----
  const volRange = $("#vol-range");
  const volPct = $("#vol-pct");
  const volMute = $("#vol-mute");
  function paintVolume() {
    const shown = muted ? 0 : volume;
    if (volRange) volRange.value = String(Math.round(shown * 100));
    if (volPct) volPct.textContent = Math.round(shown * 100) + "%";
    if (volMute) volMute.classList.toggle("muted", shown === 0);
  }
  function applyVolume() {
    if (audio) audio.volume = muted ? 0 : volume;
    try { localStorage.setItem("sot-vol", String(volume)); } catch (e) {}
    paintVolume();
  }
  if (volRange) {
    volRange.addEventListener("input", () => {
      volume = Math.max(0, Math.min(1, (parseFloat(volRange.value) || 0) / 100));
      muted = false;
      applyVolume();
    });
  }
  if (volMute) {
    volMute.addEventListener("click", () => {
      // אם העוצמה כבר 0 — שחרור מעלה ל-100%; אחרת מתג השתקה
      if (!muted && volume === 0) { volume = 1; muted = false; }
      else muted = !muted;
      applyVolume();
    });
  }
  paintVolume();   // סנכרון מצב התחלתי לפי ההעדפה השמורה

  // ---- בהירות הרקע ----
  const bgBright = $("#bg-bright");
  const brightRange = $("#bright-range");
  const brightPct = $("#bright-pct");
  const brightReset = $("#bright-reset");
  function applyBright() {
    let color = "#fff", op = 0;
    if (bright > 50) { color = "#fff"; op = ((bright - 50) / 50) * 0.34; }   // מבהיר
    else if (bright < 50) { color = "#000"; op = ((50 - bright) / 50) * 0.5; } // מכהה
    if (bgBright) { bgBright.style.background = color; bgBright.style.opacity = String(op); }
    try { localStorage.setItem("sot-bright", String(bright)); } catch (e) {}
    if (brightRange) brightRange.value = String(bright);
    if (brightPct) { const d = Math.round(bright - 50); brightPct.textContent = (d > 0 ? "+" : "") + d; }
  }
  if (brightRange) brightRange.addEventListener("input", () => {
    bright = parseFloat(brightRange.value); if (isNaN(bright)) bright = 50;
    applyBright();
  });
  if (brightReset) brightReset.addEventListener("click", () => { bright = 50; applyBright(); });
  applyBright();   // החלת ההעדפה השמורה בטעינה

  // סגירה בלחיצה מחוץ לפאנל
  document.addEventListener("click", (e) => {
    if (!settingsPanel.contains(e.target) && e.target !== btnSettings && !btnSettings.contains(e.target))
      toggleSettings(false);
  });

  // שער חברים
  const unlock = () => {
    localStorage.setItem("tfv-member", "true");
    $("#gate").innerHTML = '<h2>בְּרוּכִים הַבָּאִים</h2><p style="color:var(--ink-dim)">הגישה לחברים נפתחה. במצגת המלאה כאן יופיע תוכן ההמשך.</p>';
  };
  $("#btn-member").addEventListener("click", unlock);
  $("#btn-join").addEventListener("click", () => {
    $("#btn-join").textContent = "הקישור יחובר באתר TFV";
  });
  $("#continue-btn").addEventListener("click", () => {
    $("#gate").scrollIntoView({ behavior: "smooth" });
  });

  // נגישות: רווח = השהיה/ניגון, Esc = סגירת חלון הסבר
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePop(); toggleSettings(false); toggleLangMenu(false); return; }
    if (e.code === "Space" && started) { e.preventDefault(); btnAudio.click(); }
  });

  paintProgress();
})();
