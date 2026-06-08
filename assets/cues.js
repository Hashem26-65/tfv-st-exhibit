/* ============================================================
   cues.js · סכומי אלפים — TFV
   Cue points derived from word-level transcription of the five
   Hebrew narration files (faster-whisper, small model).
   Each cue: { t: seconds-into-this-act, do: "actionName", a: arg }
   The engine fires a cue when the audio playhead passes t.
   All numbers below are VERIFIED with BigInt (see _tools, README).
   ============================================================ */
window.SOT = window.SOT || {};

/* תיקיות האודיו לפי שפה. כל שפה = תיקייה עם אותם שמות-קבצים
   (Thousannds Part 1.mp3 ... Part 5.mp3). */
SOT.AUDIO_DIR = {
  he: "אודיו מצגת סכומי אלפים",
  en: "אודיו אנגלית",
};

/* שבע מילות הפסוק, ערך גימטרי, פירוש, ופירוק אות-אות.
   letters: [אות, ערך] — סכומן הוא val. */
SOT.WORDS = [
  { he: "בְּרֵאשִׁית", en: "Bereshit", val: 913,
    meaning: "בָּרֵאשִׁית — המילה הפותחת את התורה: „בהתחלה”, בראש הכול.",
    enMeaning: "“In the beginning” — the opening word of the Torah.",
    letters: [["ב",2],["ר",200],["א",1],["ש",300],["י",10],["ת",400]] },
  { he: "בָּרָא", en: "Bara", val: 203,
    meaning: "בָּרָא — „יצר”, פעולת הבריאה: יש מאַיִן.",
    enMeaning: "“created” — bringing into being out of nothing.",
    letters: [["ב",2],["ר",200],["א",1]] },
  { he: "אֱלֹהִים", en: "Elohim", val: 86,
    meaning: "אֱלֹהִים — שם הבורא, בעל הכוחות כולם.",
    enMeaning: "“God” — the Creator, master of all powers.",
    letters: [["א",1],["ל",30],["ה",5],["י",10],["ם",40]] },
  { he: "אֵת", en: "Et", val: 401,
    meaning: "אֵת — מילת מושא ישיר, מקדימה את הנברא („את…”).",
    enMeaning: "the accusative marker, introducing the object.",
    letters: [["א",1],["ת",400]] },
  { he: "הַשָּׁמַיִם", en: "Hashamayim", val: 395,
    meaning: "הַשָּׁמַיִם — העולמות העליונים, הרקיע.",
    enMeaning: "“the heavens” — the upper worlds.",
    letters: [["ה",5],["ש",300],["מ",40],["י",10],["ם",40]] },
  { he: "וְאֵת", en: "Ve’et", val: 407,
    meaning: "וְאֵת — „וְ” החיבור עם מילת המושא השנייה.",
    enMeaning: "“and” + the second object marker.",
    letters: [["ו",6],["א",1],["ת",400]] },
  { he: "הָאָֽרֶץ", en: "Ha’aretz", val: 296,
    meaning: "הָאָרֶץ — העולם התחתון, הארץ שאנו עליה.",
    enMeaning: "“the earth” — the lower world we stand on.",
    letters: [["ה",5],["א",1],["ר",200],["ץ",90]] },
];

/* Verified big numbers (strings, to preserve exact digits). */
SOT.PRODUCT = "304153525784175760";          // ∏ word-values
SOT.X82     = "24940589114302412320";         // ∏ × 82
SOT.X82_2   = "2045128307372797810240";        // ∏ × 82²
/* Thousand-groups (most-significant first) — each sums to 2701. */
SOT.GROUPS_PRODUCT = [304, 153, 525, 784, 175, 760];
SOT.GROUPS_X82     = [24, 940, 589, 114, 302, 412, 320];
SOT.GROUPS_X82_2   = [2, 45, 128, 307, 372, 797, 810, 240];

/* כתוביות מסונכרנות — לכל אקט מערך של [התחלה, סוף, טקסט].
   הזמנים מהתמלול (faster-whisper); הטקסט נוקה ותוקן לפי התסריט. */
SOT.SUBS = [
  [ // אקט 1
    [0.0, 3.6,  "בראשית ברא אלהים את השמים ואת הארץ."],
    [3.78, 5.9, "אלו המילים הפותחות את התורה."],
    [6.14, 10.7,"הפסוק הראשון, ואולי גם הפסוק המצוטט והמוכר ביותר בעולם."],
    [11.32, 14.7,"במשפט קצר אחד מתואר מעשה הבריאה כולו,"],
    [14.86, 19.4,"אך מעבר לתיאור הבריאה עצמה, הפסוק גם מציג עיקרון יסודי:"],
    [19.6, 23.6, "קיומו של בורא לעולם ובעלותו על כלל הבריאה."],
    [23.98, 27.4,"רעיון רחב ועמוק בעל משמעויות רבות."],
    [27.63, 31.1,"לכל אחת ממילות הפסוק קיים ערך גימטרי."],
    [31.18, 33.6,"בראשית – 913."],
    [33.8, 36.0, "ברא – 203."],
    [36.05, 38.4,"אלהים – 86."],
    [38.45, 40.6,"את – 401."],
    [40.65, 43.6,"השמים – 395."],
    [43.65, 46.2,"ואת – 407."],
    [46.25, 48.6,"הארץ – 296."],
  ],
  [ // אקט 2
    [0.0, 4.8,  "כאשר מחברים את כל הערכים יחד מתקבלת התוצאה הידועה והמפורסמת:"],
    [5.0, 7.4,  "2701."],
    [7.88, 12.8,"אולם מה יקרה אם במקום לחבר את הערכים, נכפיל אותם זה בזה? כלומר:"],
    [13.1, 20.6,"בראשית כפול ברא כפול אלהים כפול את כפול השמים כפול ואת כפול הארץ."],
    [21.32, 25.0,"התוצאה המתקבלת היא המספר המופיע כעת על המסך:"],
    [25.4, 31.5,"מספר עצום, המתקבל ישירות ממכפלת ערכי המילים של הפסוק הראשון בתורה."],
    [31.96, 37.4,"כעת נבחן אותו מזווית נוספת. אם נחבר את קבוצות האלפים של המספר,"],
    [37.5, 40.2,"כפי שהן מופרדות בפסיקים, נקבל:"],
    [40.14, 54.2,"304 ועוד 153 ועוד 525 ועוד 784 ועוד 175 ועוד 760."],
    [54.8, 57.8,"התוצאה היא בדיוק 2701."],
    [57.9, 62.9,"כלומר, סכום ערכי המילים של הפסוק שווה ל-2701,"],
    [62.88, 68.5,"וגם סכום יחידות האלפים של מכפלת ערכי המילים שווה ל-2701."],
    [68.54, 73.7,"זוהי אינה רק פעולה חשבונית פשוטה."],
    [73.7, 80.5,"במסורת הקבלית היא קשורה לעיקרון המכונה „חזרת הגלגל”, נושא שעליו נרחיב במצגות נוספות."],
  ],
  [ // אקט 3
    [0.0, 2.8,  "כעת נתבונן במערכת באופן מורחב."],
    [2.98, 6.5, "נעבור לערך הגימטריה הקטנה של הפסוק הראשון."],
    [6.78, 11.0,"בשיטה זו כל אות מקבלת את ערכה ללא האפסים."],
    [11.24, 16.9,"כך למשל האות ת׳ מקבלת את הערך אַרְבַּע במקום אַרְבַּע מֵאוֹת,"],
    [17.1, 23.5,"האות ש׳ מקבלת את הערך שָׁלוֹשׁ במקום שְׁלוֹשׁ מֵאוֹת, וכך גם שאר האותיות."],
    [24.0, 29.7,"כאשר מחשבים את הגימטריה הקטנה של הפסוק כולו מתקבל הערך 82."],
    [30.0, 32.9,"כעת נחזור למכפלת ערכי המילים."],
    [33.06, 38.8,"אם נכפיל את התוצאה ב-2, ב-3, ב-4, או בכל מספר אחר,"],
    [38.94, 44.2,"נגלה שתוצאת סכום האלפים אינה חוזרת להיות 2701."],
    [44.36, 47.3,"למעשה, התופעה אינה חוזרת כלל..."],
    [47.46, 52.4,"עד לרגע שבו מכפילים את המכפלה המקורית ב-82."],
    [52.26, 55.4,"בדיוק בערך הגימטריה הקטנה של הפסוק."],
    [55.6, 59.9,"כאשר עושים זאת מתקבל מספר חדש וגדול בהרבה,"],
    [60.0, 67.2,"אך באופן מפתיע, סכום קבוצות האלפים שלו חוזר להיות בדיוק 2701,"],
    [67.32, 69.7,"כפי שניתן לראות על המסך:"],
    [69.84, 82.0,"24 ועוד 940 ועוד 589 ועוד 114 ועוד 302 ועוד 412 ועוד 320."],
    [82.3, 87.0,"ושוב מתקבלת התוצאה 2701 בדיוק."],
  ],
  [ // אקט 4
    [0.0, 6.3,  "ההתאמה הזו אינה עומדת בפני עצמה. היא מהווה חלק ממערכת רחבה יותר של קשרים ותבניות."],
    [6.54, 9.0, "וכעת מגיע השלב הבא."],
    [9.5, 15.3, "גם לאחר ההכפלה ב-82, אם נמשיך לבדוק כפולות שונות של התוצאה,"],
    [15.14, 20.2,"נגלה שהתוצאה 2701 אינה מופיעה שוב."],
    [20.64, 28.4,"אך כאשר מבצעים את אותו מהלך פעם נוספת ומכפילים שוב ב-82, מתרחשת התופעה מחדש."],
    [28.84, 32.3,"פעם נוספת מתקבל מספר עצום,"],
    [32.64, 40.0,"ופעם נוספת סכום קבוצות האלפים שלו שווה בדיוק לאלפיים ושבע מאות ואחת."],
    [40.44, 50.1,"כפי שניתן לראות כעת על המסך: 2 ועוד 45 ועוד 128 ועוד 307 ועוד 372"],
    [50.18, 60.0,"ועוד 979 ועוד 810 ועוד 240. והתוצאה שוב: 2701."],
  ],
  [ // אקט 5
    [0.0, 9.5,  "בנקודה זו מתגלה רובד נוסף. אם נחבר את כל ספרות המספר העצום שהתקבל — ספרה אחר ספרה, מתחילתו ועד סופו —"],
    [9.46, 12.2,"נקבל תוצאה נוספת ומפתיעה."],
    [12.48, 16.6,"סכום הספרות כולו שווה בדיוק 82."],
    [17.58, 21.3,"זהו ערך הגימטריה הקטנה של הפסוק הראשון."],
    [21.46, 28.9,"כך מתקבלת מעין סגירת מעגל: מצד אחד 2701, ערכו הכולל של הפסוק,"],
    [28.78, 33.8,"ומצד שני 82, ערכו בגימטריה קטנה."],
    [34.22, 39.4,"זהו אחד ההיבטים של מה שמכונה בקבלה „סוד חזרת הגלגל”."],
    [39.98, 42.2,"האם כאן מסתיימת המערכת?"],
    [42.36, 47.2,"האם קיימים קשרים נוספים למבנים מתמטיים, גיאומטריים ופיזיקליים?"],
    [47.42, 50.6,"ומה עוד מסתתר בפסוק הראשון בתורה?"],
    [50.88, 57.5,"על כך, ועל תופעות נוספות רבות, במצגות ההמשך. לחצו על הכפתור כדי להמשיך."],
    [58.02, 62.8,"לצפייה במצגות ההמשך נדרש להתחבר או להירשם כחברים."],
    [63.0, 72.0,"חברים מקבלים גישה למגוון רחב של תכנים נוספים, ובהם סרטונים, מצגות, מאמרים, מחקרים וחומרי העשרה נוספים."],
  ],
];

/* כתוביות באנגלית — מסונכרנות לזמני האודיו האנגלי (תמלול faster-whisper). */
SOT.SUBS_EN = [
  [ // Act 1
    [0.0, 3.4,  "In the beginning, God created the heavens and the earth."],
    [3.54, 7.3, "These are the words that open the Torah — the very first verse,"],
    [7.46, 11.5,"and perhaps the most widely quoted and well-known verse in the world."],
    [11.98, 16.5,"In a single brief sentence, the entire act of Creation is described."],
    [17.12, 22.5,"Yet beyond Creation itself, the verse presents a fundamental principle:"],
    [23.0, 26.76,"the existence of a Creator and His ownership over all of Creation."],
    [26.76, 32.0,"A profound and far-reaching concept with many implications."],
    [32.5, 38.0, "Each word in the verse has a numerical value in gematria:"],
    [38.34, 42.7,"Bereshit (“in the beginning”) – 913."],
    [43.14, 46.7,"Bara (“created”) – 203."],
    [47.06, 50.7,"Elohim (“God”) – 86."],
    [51.02, 53.7,"Et – 401."],
    [53.92, 58.7,"Hashamayim (“the heavens”) – 395."],
    [59.02, 63.0,"Ve’et (“and”) – 407."],
    [63.30, 67.6,"Ha’aretz (“the earth”) – 296."],
  ],
  [ // Act 2
    [0.0, 7.5,  "When all of these values are added together, the result is the well-known number: 2701."],
    [8.6, 13.5, "But what happens if, instead of adding the values, we multiply them together?"],
    [14.14, 26.3,"In other words: Bereshit × Bara × Elohim × Et × Hashamayim × Ve’et × Ha’aretz."],
    [26.3, 29.7,"The result is the number now displayed on the screen."],
    [30.12, 36.9,"An enormous number, obtained directly from multiplying the gematria values of the first verse."],
    [37.56, 39.8,"Now let us examine it from another perspective."],
    [40.42, 44.76,"If we add together the thousands-groups of this number, as separated by commas,"],
    [44.76, 57.5,"we obtain 304 + 153 + 525 + 784 + 175 + 760."],
    [58.12, 61.7,"The result is exactly 2701."],
    [62.28, 68.84,"The sum of the gematria values of the words equals 2701,"],
    [68.84, 75.7,"and the sum of the thousands-groups of their product also equals 2701."],
    [76.66, 79.5,"This is more than a simple arithmetic operation."],
    [80.06, 87.5,"In Kabbalah it is associated with a principle known as „The Return of the Wheel” —"],
    [88.02, 92.4,"a concept explored in greater depth in future presentations."],
  ],
  [ // Act 3
    [0.0, 2.4,  "Now let us examine the system more broadly."],
    [2.58, 5.9, "We move to the reduced gematria value of the first verse."],
    [6.5, 10.5, "In this method, each letter receives its value without the zeros."],
    [10.82, 15.5,"For example, the letter Tav receives the value 4 instead of 400,"],
    [15.68, 19.9,"and the letter Shin receives 3 instead of 300."],
    [20.1, 23.0,"The same principle applies to all the other letters."],
    [23.36, 29.0,"When the reduced gematria of the entire verse is calculated, the value obtained is 82."],
    [30.09, 33.0,"Now let us return to the product of the word-values."],
    [33.24, 38.6,"If we multiply the result by 2, by 3, by 4, or by any other number,"],
    [38.76, 44.4,"we find that the sum of the thousands-groups does not return to 2701."],
    [44.68, 47.8,"In fact, the phenomenon does not repeat at all."],
    [48.24, 52.4,"Until the moment the original product is multiplied by 82 —"],
    [52.6, 55.6,"exactly the reduced gematria value of the verse."],
    [55.76, 59.8,"When this is done, a new and much larger number is obtained."],
    [60.02, 67.2,"Yet surprisingly, the sum of its thousands-groups returns once again to exactly 2701."],
    [67.42, 80.5,"As can be seen: 24 + 940 + 589 + 114 + 302 + 412 + 320."],
    [81.14, 86.1,"And once again, the result is exactly 2701."],
  ],
  [ // Act 4
    [0.0, 2.7,  "This correspondence does not stand on its own."],
    [2.98, 6.0, "It is part of a broader system of connections and patterns."],
    [6.66, 8.6, "And now comes the next stage."],
    [9.08, 14.4,"Even after multiplying by 82, if we keep testing different multiples of the result,"],
    [14.84, 18.9,"we find that 2701 does not appear again."],
    [19.4, 24.7,"But when the same step is performed once more and multiplied again by 82,"],
    [25.06, 27.4,"the phenomenon occurs again."],
    [27.96, 30.8,"Once again, an enormous number is obtained,"],
    [31.18, 37.8,"and once again, the sum of its thousands-groups is exactly 2701."],
    [38.3, 40.6,"As can now be seen on the screen:"],
    [41.0, 53.86,"2 + 45 + 128 + 307 + 372 + 979 + 810 + 240."],
    [54.62, 59.8,"And the result, once again, is 2701."],
  ],
  [ // Act 5
    [0.0, 3.0,  "At this point, another layer is revealed."],
    [3.12, 7.0, "If we add together all the digits of the enormous number that was obtained,"],
    [7.02, 13.0,"digit by digit, from beginning to end, we arrive at another surprising result."],
    [13.8, 17.6,"The sum of all the digits is exactly 82."],
    [18.5, 22.6,"This is the reduced gematria value of the first verse."],
    [22.98, 25.22,"A kind of closed cycle now emerges."],
    [25.22, 31.8,"On one side stands 2701, the total gematria value of the verse,"],
    [32.36, 36.6,"and on the other, 82, its reduced gematria value."],
    [37.42, 42.9,"This is one aspect of what Kabbalah calls „The Secret of the Return of the Wheel.”"],
    [43.54, 45.4,"Does the system end here?"],
    [45.88, 50.26,"Are there further connections to mathematical, geometrical, and physical structures?"],
    [50.26, 54.4,"And what else may be hidden within the first verse of the Torah?"],
    [54.96, 61.5,"These questions, and many other phenomena, will be explored in the presentations that follow."],
    [62.04, 63.6,"Click the button to continue."],
    [64.32, 69.6,"To access the continuation presentations, you must sign in or register as a member."],
    [70.38, 80.6,"Members receive access to videos, presentations, articles, research, and educational materials."],
  ],
];

/* עיתוי האנימציות (cues) באנגלית — אותן פעולות, זמני האודיו האנגלי. */
SOT.CUES_EN = [
  [ // Act 1
    { t: 0.0,  do: "showVerse" },
    { t: 32.5, do: "primeValues" },
    { t: 38.3, do: "revealValue", a: 0 },
    { t: 43.1, do: "revealValue", a: 1 },
    { t: 47.0, do: "revealValue", a: 2 },
    { t: 51.0, do: "revealValue", a: 3 },
    { t: 53.9, do: "revealValue", a: 4 },
    { t: 59.0, do: "revealValue", a: 5 },
    { t: 63.3, do: "revealValue", a: 6 },
  ],
  [ // Act 2
    { t: 0.0,  do: "act2Begin" },
    { t: 6.0,  do: "landSum2701" },
    { t: 8.6,  do: "switchToProduct" },
    { t: 14.1, do: "walkProduct" },
    { t: 26.3, do: "showProduct" },
    { t: 40.4, do: "splitProductGroups" },
    { t: 45.0, do: "addGroup", a: 0 },
    { t: 47.1, do: "addGroup", a: 1 },
    { t: 49.2, do: "addGroup", a: 2 },
    { t: 51.3, do: "addGroup", a: 3 },
    { t: 53.4, do: "addGroup", a: 4 },
    { t: 55.5, do: "addGroup", a: 5 },
    { t: 58.1, do: "landGroups2701" },
  ],
  [ // Act 3
    { t: 0.0,  do: "act3Begin" },
    { t: 6.5,  do: "showSmallExample" },
    { t: 26.8, do: "reveal82" },
    { t: 33.2, do: "showFailMultiples" },
    { t: 48.2, do: "applyTimes82" },
    { t: 55.8, do: "showX82" },
    { t: 60.0, do: "splitX82Groups" },
    { t: 68.0, do: "addGroupB", a: 0 },
    { t: 69.85, do: "addGroupB", a: 1 },
    { t: 71.7, do: "addGroupB", a: 2 },
    { t: 73.5, do: "addGroupB", a: 3 },
    { t: 75.4, do: "addGroupB", a: 4 },
    { t: 77.2, do: "addGroupB", a: 5 },
    { t: 79.0, do: "addGroupB", a: 6 },
    { t: 81.1, do: "landGroupsB2701" },
  ],
  [ // Act 4
    { t: 0.0,  do: "act4Begin" },
    { t: 9.08, do: "showFailAgain" },
    { t: 19.4, do: "applyTimes82Again" },
    { t: 27.96, do: "showX82_2" },
    { t: 31.2, do: "splitX82_2Groups" },
    { t: 41.0, do: "addGroupC", a: 0 },
    { t: 42.6, do: "addGroupC", a: 1 },
    { t: 44.2, do: "addGroupC", a: 2 },
    { t: 45.8, do: "addGroupC", a: 3 },
    { t: 47.4, do: "addGroupC", a: 4 },
    { t: 49.0, do: "addGroupC", a: 5 },
    { t: 50.8, do: "addGroupC", a: 6 },
    { t: 52.4, do: "addGroupC", a: 7 },
    { t: 54.6, do: "landGroupsC2701" },
  ],
  [ // Act 5
    { t: 0.0,  do: "act5Begin" },
    { t: 0.5,  do: "walkDigits" },
    { t: 13.8, do: "landDigitSum82" },
    { t: 18.5, do: "tagSmallGematria" },
    { t: 23.0, do: "showCircleClose" },
    { t: 37.4, do: "wheelSecret" },
    { t: 43.5, do: "closingQuestions" },
    { t: 62.0, do: "showContinue" },
    { t: 64.3, do: "showGate" },
  ],
];

/* חלון מונה-הספרות (אקט 5) לפי שפה: [התחלה, סוף-נחיתה-על-82, הסתרה]. */
SOT.DIGIT_CLIMB = {
  he: { start: 0.5, end: 12.48, hide: 21.0 },
  en: { start: 3.1, end: 13.8,  hide: 23.0 },
};

/* The five acts, each tied to one audio file. */
SOT.ACTS = [
  {
    id: "act1",
    title: "הפסוק הראשון",
    audio: "אודיו מצגת סכומי אלפים/Thousannds Part 1.mp3",
    duration: 48.9,
    cues: [
      { t: 0.0,  do: "showVerse" },
      { t: 27.6, do: "primeValues" },
      { t: 31.2, do: "revealValue", a: 0 },
      { t: 33.8, do: "revealValue", a: 1 },
      { t: 36.1, do: "revealValue", a: 2 },
      { t: 38.5, do: "revealValue", a: 3 },
      { t: 40.7, do: "revealValue", a: 4 },
      { t: 43.7, do: "revealValue", a: 5 },
      { t: 46.3, do: "revealValue", a: 6 },
    ],
  },
  {
    id: "act2",
    title: "חיבור וכפל · 2701",
    audio: "אודיו מצגת סכומי אלפים/Thousannds Part 2.mp3",
    duration: 81.5,
    cues: [
      { t: 0.0,  do: "act2Begin" },        // show sum building
      { t: 5.0,  do: "landSum2701" },       // "...two thousand seven hundred and one"
      { t: 7.9,  do: "switchToProduct" },   // + becomes ×
      { t: 13.1, do: "walkProduct" },       // highlight words one by one
      { t: 21.3, do: "showProduct" },       // big number materialises
      { t: 31.9, do: "splitProductGroups" },
      { t: 40.1, do: "addGroup", a: 0 },
      { t: 42.5, do: "addGroup", a: 1 },
      { t: 44.8, do: "addGroup", a: 2 },
      { t: 47.2, do: "addGroup", a: 3 },
      { t: 49.5, do: "addGroup", a: 4 },
      { t: 51.8, do: "addGroup", a: 5 },
      { t: 54.8, do: "landGroups2701" },
    ],
  },
  {
    id: "act3",
    title: "גימטריה קטנה · 82",
    audio: "אודיו מצגת סכומי אלפים/Thousannds Part 3.mp3",
    duration: 86.9,
    cues: [
      { t: 0.0,  do: "act3Begin" },         // small-gematria panel
      { t: 6.8,  do: "showSmallExample" },  // ת=4, ש=3
      { t: 27.4, do: "reveal82" },          // small gematria of verse = 82
      { t: 33.0, do: "showFailMultiples" }, // ×2 ×3 ×4 ... no return
      { t: 47.5, do: "applyTimes82" },      // × 82
      { t: 55.6, do: "showX82" },           // 24,940,589,114,302,412,320
      { t: 60.0, do: "splitX82Groups" },
      { t: 69.8, do: "addGroupB", a: 0 },
      { t: 71.5, do: "addGroupB", a: 1 },
      { t: 73.2, do: "addGroupB", a: 2 },
      { t: 74.9, do: "addGroupB", a: 3 },
      { t: 76.6, do: "addGroupB", a: 4 },
      { t: 78.3, do: "addGroupB", a: 5 },
      { t: 80.0, do: "addGroupB", a: 6 },
      { t: 82.3, do: "landGroupsB2701" },
    ],
  },
  {
    id: "act4",
    title: "כפל נוסף ב־82",
    audio: "אודיו מצגת סכומי אלפים/Thousannds Part 4.mp3",
    duration: 60.3,
    cues: [
      { t: 0.0,  do: "act4Begin" },
      { t: 9.5,  do: "showFailAgain" },
      { t: 20.6, do: "applyTimes82Again" },
      { t: 28.8, do: "showX82_2" },         // 2,045,128,307,372,797,810,240
      { t: 32.6, do: "splitX82_2Groups" },
      { t: 40.4, do: "addGroupC", a: 0 },
      { t: 42.5, do: "addGroupC", a: 1 },
      { t: 44.5, do: "addGroupC", a: 2 },
      { t: 46.5, do: "addGroupC", a: 3 },
      { t: 48.5, do: "addGroupC", a: 4 },
      { t: 50.3, do: "addGroupC", a: 5 },
      { t: 53.5, do: "addGroupC", a: 6 },
      { t: 56.0, do: "addGroupC", a: 7 },
      { t: 58.5, do: "landGroupsC2701" },
    ],
  },
  {
    id: "act5",
    title: "סגירת המעגל · 82",
    audio: "אודיו מצגת סכומי אלפים/Thousannds Part 5.mp3",
    duration: 71.9,
    cues: [
      { t: 0.0,  do: "act5Begin" },         // start digit walk
      { t: 0.5,  do: "walkDigits" },        // animate digit-by-digit sum 0..82
      { t: 12.48, do: "landDigitSum82" },
      { t: 17.6, do: "tagSmallGematria" },
      { t: 21.5, do: "showCircleClose" },   // 2701 <-> 82
      { t: 34.2, do: "wheelSecret" },
      { t: 39.98, do: "closingQuestions" },
      { t: 50.88, do: "showContinue" },
      { t: 58.0, do: "showGate" },
    ],
  },
];
