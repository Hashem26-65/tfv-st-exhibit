# -*- coding: utf-8 -*-
import zipfile, os

content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

def esc(t):
    return t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def para(text, size=22, bold=False, heading=False, color=None):
    b = '<w:b/>' if bold else ''
    sz = f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    col = f'<w:color w:val="{color}"/>' if color else ''
    spacing = '<w:spacing w:before="160" w:after="80"/>' if heading else '<w:spacing w:after="40"/>'
    rpr = f'<w:rPr><w:rtl/>{b}{col}{sz}</w:rPr>'
    return (f'<w:p><w:pPr><w:bidi/>{spacing}<w:jc w:val="right"/>'
            f'<w:rPr><w:rtl/>{b}{col}{sz}</w:rPr></w:pPr>'
            f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')

body = []
body.append(para("50 המשחקים הפשוטים, הפופולריים והממכרים בעולם", size=36, bold=True, heading=True, color="1F4E79"))
body.append(para("רשימה של משחקים בעלי מכניקה פשוטה להבנה אך ממכרת במיוחד", size=22, color="666666"))

sections = [
    ("משחקי מובייל / היפר-קז'ואל", [
        "Flappy Bird – לחיצה אחת, קושי אדיר",
        "2048 – מיזוג מספרים",
        "Candy Crush Saga – התאמת 3",
        "Subway Surfers – ריצה אינסופית",
        "Temple Run – ריצה אינסופית",
        "Angry Birds – ירי בקלע",
        "Fruit Ninja – חיתוך פירות",
        "Doodle Jump – קפיצה למעלה",
        "Crossy Road – חציית כביש",
        "Stack – ערימת קוביות",
        "Helix Jump – כדור נופל בספירלה",
        "Color Switch – התאמת צבעים",
        "Ball Blast – ירי במספרים",
        "Paper.io – כיבוש שטח",
        "Slither.io – נחש מתארך",
        "Agar.io – תא שאוכל תאים",
        "Hill Climb Racing – נהיגה על גבעות",
        "Cut the Rope – חיתוך חבל",
        "Jetpack Joyride – ריצה עם מצנח-סילון",
        "Geometry Dash – קפיצות בקצב",
    ]),
    ("פאזלים / קלאסיקה", [
        "Tetris – הפלת בלוקים",
        "Minesweeper – שולה מוקשים",
        "Solitaire – קלפים",
        "Sudoku – חידת מספרים",
        "Pac-Man – אכילת נקודות",
        "Snake (נוקיה) – נחש קלאסי",
        "Bubble Shooter – ירי בועות",
        "Mahjong – התאמת אריחים",
        "Wordle – ניחוש מילה",
        "Connect 4 – ארבע בשורה",
    ]),
    ("ארקייד / זמני המתנה", [
        "Wii Sports – ספורט פשוט",
        "Among Us – מצא את הבוגד",
        "Fall Guys – מכשולים",
        "Super Mario Bros – פלטפורמר",
        "Sonic – ריצה מהירה",
        "Pinball – פינבול",
        "Brick Breaker / Arkanoid – שבירת לבנים",
        "Space Invaders – ירי בחלל",
        "Asteroids – ירי באסטרואידים",
        "Frogger – חציית כביש",
    ]),
    ("קז'ואל מודרני", [
        "Wordscapes – חיפוש מילים",
        "Plants vs. Zombies – הגנה ממגדל",
        "Clash Royale – קרבות קלפים",
        "Brawl Stars – קרבות 3v3",
        "Roblox – פלטפורמת משחקים",
        "Minecraft – בנייה והישרדות",
        "Coin Master – סלוטים + כפר",
        "Gardenscapes – התאמה + עיצוב",
        "Words With Friends – שבץ-נא חברתי",
        "Cookie Clicker – לחיצה אינסופית",
    ]),
]

n = 1
for title, items in sections:
    body.append(para(title, size=28, bold=True, heading=True, color="2E74B5"))
    for it in items:
        body.append(para(f"{n}.  {it}", size=24))
        n += 1

document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
'<w:body>' + ''.join(body) +
'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
'<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>'
'<w:bidi/></w:sectPr>'
'</w:body></w:document>')

out = "50 המשחקים הממכרים בעולם.docx"
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', document)

print("Created:", os.path.abspath(out))
