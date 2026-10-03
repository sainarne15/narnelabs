"""Stamp a version on local asset URLs so browsers fetch fresh copies after a deploy.

Cloudflare tells browsers to keep static files for hours. Changing ?v= on every
deploy makes them re-download anything that may have changed.
Run from the repo root before committing:  python tools/bust.py
"""
import pathlib, re, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
VER = datetime.datetime.now().strftime("%Y%m%d%H%M")
ASSET = re.compile(r'((?:src|href)=")(/(?:assets|apps)/[^"?#]+\.(?:css|js|webp|png|jpg|svg))(?:\?v=\d+)?(")')

n = 0
for p in ROOT.rglob("*.html"):
    if p.relative_to(ROOT).parts[0] in {".git", ".devtest", "tools"}:
        continue
    html = p.read_text(encoding="utf-8")
    new, k = ASSET.subn(lambda m: f"{m.group(1)}{m.group(2)}?v={VER}{m.group(3)}", html)
    if k:
        p.write_text(new, encoding="utf-8"); n += k
print(f"stamped {n} asset URLs with v={VER}")
