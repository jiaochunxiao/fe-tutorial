import sys
from playwright.sync_api import sync_playwright
# usage: python3 shot.py <html-or-url> <out.png> [w]x[h] [full]
html, out = sys.argv[1], sys.argv[2]
w, h = (sys.argv[3].split("x") if len(sys.argv) > 3 else ("1440", "900"))
full = len(sys.argv) > 4 and sys.argv[4] == "full"
url = html if html.startswith("http") else pathlib.Path(html).resolve().as_uri()
import pathlib
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": int(w), "height": int(h)})
    pg.goto(url); pg.wait_for_timeout(2600)
    pg.screenshot(path=out, full_page=full)
    b.close()
print("saved", out)
