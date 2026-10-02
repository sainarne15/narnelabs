"""Regenerate sitemap.xml from the site's pages.

Run from the repo root after adding or changing pages:  python tools/sitemap.py
Includes every committed or new *.html page that isn't marked noindex, using its
<link rel="canonical"> URL and the date it last changed in git.
"""
import pathlib, re, subprocess, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://narnelabs.com"
SKIP_DIRS = {".git", ".devtest", "tools", "node_modules"}


def last_changed(path):
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(path)],
                         cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or datetime.date.today().isoformat()  # new, uncommitted page


def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS:
            continue
        html = p.read_text(encoding="utf-8")
        if re.search(r'<meta name="robots" content="[^"]*noindex', html):
            continue
        m = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        url = m.group(1) if m else BASE + "/" + str(rel.as_posix()).removesuffix("index.html")
        yield url, last_changed(rel)


def main():
    rows = sorted(pages(), key=lambda r: (r[0].count("/"), r[0]))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>" for u, d in rows]
    xml.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(xml) + "\n", encoding="utf-8")
    print(f"sitemap.xml: {len(rows)} URLs")
    for u, d in rows:
        print(f"  {d}  {u}")


if __name__ == "__main__":
    main()
