#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""מחולל תמונות Nano Banana (gemini-2.5-flash-image) למשחק הממלכה.
שימוש:  python gen.py <output.png> "<PROMPT>"
"""
import sys, os, json, base64, urllib.request

KEY = "AIzaSyB-3GvH0jKnibi7VB6FmcA_MYR8t07Vg6k"
MODEL = "gemini-2.5-flash-image"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"

STYLE = ("Isometric 2.5D video game art asset in the polished style of SimCity 3000 / "
         "Tropico, high detail, clean cartoon look with realistic shading, soft ambient "
         "occlusion shadow under the object, warm sunlight from the top-left, vibrant but "
         "natural colors, sharp crisp edges. The object sits alone, perfectly centered, on a "
         "100% solid pure-magenta (#FF00FF) flat background with NOTHING else, no ground, no "
         "grass, no sky, no text, no watermark, no people unless asked. Drawn at a 2:1 "
         "isometric (dimetric) camera angle. Square image. ")


TILE_STYLE = ("Isometric 2.5D video game GROUND TILE in the polished style of SimCity 3000, "
              "high detail clean cartoon look with soft realistic shading, warm sunlight from "
              "the top-left. A single diamond/rhombus shaped ground tile that fills the frame at "
              "a 2:1 isometric angle, the four triangular corners OUTSIDE the diamond are 100% "
              "solid pure-magenta (#FF00FF), seamless tileable edges, no text, no watermark. "
              "Square image. Tile surface: ")


def generate(out_path, prompt, mode="obj"):
    base = TILE_STYLE if mode == "tile" else (STYLE + " Subject: ")
    full = base + prompt
    body = json.dumps({
        "contents": [{"parts": [{"text": full}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]}
    }).encode("utf-8")
    req = urllib.request.Request(URL, data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.load(resp)
    except urllib.error.HTTPError as e:
        print("HTTP ERROR", e.code)
        print(e.read().decode()[:800])
        return False
    except Exception as e:
        print("ERROR", repr(e))
        return False

    cands = data.get("candidates", [])
    if not cands:
        print("NO CANDIDATES:", json.dumps(data)[:600])
        return False
    parts = cands[0].get("content", {}).get("parts", [])
    for p in parts:
        inline = p.get("inlineData") or p.get("inline_data")
        if inline and inline.get("data"):
            raw = base64.b64decode(inline["data"])
            with open(out_path, "wb") as f:
                f.write(raw)
            print(f"SAVED {out_path}  ({len(raw)} bytes, mime={inline.get('mimeType') or inline.get('mime_type')})")
            return True
    # no image found
    txt = " ".join(p.get("text", "") for p in parts)
    print("NO IMAGE IN RESPONSE. text:", txt[:400])
    return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python gen.py <out.png> \"<prompt>\"")
        sys.exit(1)
    mode = sys.argv[3] if len(sys.argv) > 3 else "obj"
    ok = generate(sys.argv[1], sys.argv[2], mode)
    sys.exit(0 if ok else 2)
