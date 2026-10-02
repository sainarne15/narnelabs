# narnelabs.com

The website for **Narne Labs**, the studio behind CompressYourVideo, Pradakshina, and whatever ships next.

It's a plain static site, so there's no build step and nothing to install. It's served by GitHub Pages at https://narnelabs.com.

```
index.html                      Home: WebGL hero, apps, capabilities, manifesto, process, contact
apps/
  compressyourvideo/            Product: overview, privacy & legal, screenshots in img/
  pradakshina/                  Product: overview, privacy policy, delete-your-data, screenshots in img/
privacy/  terms/  404.html      Company legal pages
assets/css/style.css            All styles (product accent themes: .theme-ember, .theme-violet, .theme-cyan)
assets/js/scene.js              Three.js scene: shader orb + morphing particle field (falls back gracefully)
assets/js/main.js               Interactions: preloader, smooth scroll, reveals, tilt, cursor
CNAME                           Custom domain for GitHub Pages
```

## Brand

The logo is the **Kalki rider**: a crowned warrior on a rearing horse with a sword raised. It's a solid single-colour silhouette.

| File | Use |
|------|-----|
| `assets/img/kalki.svg` | Master mark, black, for light backgrounds and print |
| `assets/img/kalki-white.svg` | White mark for dark backgrounds (used across the site) |
| `assets/img/favicon.svg`, `favicon-32.png` | Small mark: crowned rider + sword + horse head on a dark tile |
| `assets/img/icon-180.png`, `icon-512.png` | Apple touch icon, and the store/social avatar |

The full rider becomes hard to read below about 64px. For anything small, use the favicon crop.

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

Use a local server rather than opening the file directly, because the site uses absolute paths such as `/assets/...`.

## Deploy (GitHub Pages + narnelabs.com)

1. Push this repo to `github.com/sainarne15/narnelabs` on the `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment**. Set Source to *Deploy from a branch*, Branch to `main`, and folder to `/ (root)`.
3. Under **Custom domain**, enter `narnelabs.com` and save. The `CNAME` file already contains it.
4. At your domain registrar, open the DNS settings for narnelabs.com and add:

   | Type  | Host / Name | Value                 |
   |-------|-------------|-----------------------|
   | A     | @           | 185.199.108.153       |
   | A     | @           | 185.199.109.153       |
   | A     | @           | 185.199.110.153       |
   | A     | @           | 185.199.111.153       |
   | CNAME | www         | sainarne15.github.io  |

   Optional IPv6 (AAAA, host `@`): `2606:50c0:8000:0:0:0:0:153`, `…8001…`, `…8002…`, `…8003…`. Namecheap rejects the short `::` form, so write them out in full. You can skip them; the A records alone are enough.

   Delete any existing "parking" A records or URL-forward records for `@` and `www`. On Namecheap these are the default `www → parkingpage.namecheap.com` CNAME and the `@` URL Redirect.
5. Once the DNS check passes (usually minutes, at most a few hours), tick **Enforce HTTPS**.
6. Recommended: in **GitHub → Settings (your profile) → Pages → Verified domains**, verify narnelabs.com so nobody else can claim it on GitHub Pages.

Every later `git push` to `main` redeploys within about a minute.

## URLs for Google Play Console

| App | Field | URL |
|-----|-------|-----|
| Pradakshina | Privacy policy | https://narnelabs.com/apps/pradakshina/privacy/ |
| Pradakshina | Delete account / data | https://narnelabs.com/apps/pradakshina/delete/ |
| Pradakshina | Website | https://narnelabs.com/apps/pradakshina/ |
| CompressYourVideo | Website | https://narnelabs.com/apps/compressyourvideo/ (or compressyourvideo.com) |
| Developer page | Website | https://narnelabs.com |

## Adding a new product

1. Copy `apps/compressyourvideo/` to `apps/<new-slug>/`.
2. Edit `apps/<new-slug>/index.html`:
   - text, icon and links;
   - the `canonical` and `og:image` URLs;
   - the `subnav` links;
   - the body theme class. Use an existing theme or add `.theme-<name>` in `style.css` with its own `--grad` and `--accent`.
3. Put screenshots in `apps/<new-slug>/img/` as `.webp` files, about 540×960. One way to convert them:
   `python -c "from PIL import Image; im=Image.open('x.png').convert('RGB'); im.thumbnail((540,960)); im.save('x.webp', quality=82)"`
4. Add the product's legal pages under it: `privacy/`, plus `delete/` if it has accounts, and `terms/` if needed.
5. On the home page (`index.html`), add a card in the `.apps` grid and a footer link. Bump the `PRODUCTS 0N` counter in the hero HUD.
6. Run `python tools/sitemap.py` to regenerate `sitemap.xml`, and add a link in `privacy/index.html` under *App privacy policies*.

## Device support

- The 3D background needs WebGL2. Without it (old browsers, blocked GPU, lost context), the page shows an animated CSS aurora instead. Slow devices drop to half the particles and 1× resolution after about 2 seconds.
- Content never depends on the animation libraries. Text stays visible if GSAP or Lenis fail to load. The preloader gives up after 3 seconds, and a CSS failsafe hides it after 5 seconds even if JavaScript fails completely.
- `prefers-reduced-motion` turns off smooth scroll, reveals, tilt and the custom cursor, and slows the 3D scene way down.
