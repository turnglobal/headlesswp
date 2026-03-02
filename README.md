# HeadlessWP

A fast, migration-friendly Headless WordPress frontend built with Next.js + Handlebars `.txs` themes.

WordPress runs as content backend (for example `https://wp.example.com`) and this app runs as the public site (for example `https://example.com`).

This is an open source project. If it helps you, you can contribute to the core and also build/share new themes.

It is built to be Search Engine Optimized (SEO) and Generative Engine Optimized (GEO), with strong Core Web Vitals focus and smooth user experience.

## Starters

Easy setup:

1. Clone this repo.
2. Rename `.env.example` to `.env`.
3. Update `.env` values.
4. If needed, push to GitHub (skip this if your repo is already on GitHub).
5. In Vercel, create the project and add your custom domain.
6. Add the same public domain in `.env` as `DOMAIN=https://yourdomain.com`.

## Developers

```bash
git clone <your-repo-url>
cd headlesswp
npm install
npm run devs
```

Then open `http://localhost:3000`.

## Environment

Required:

- `WP_DOMAIN`
- `WP_USERNAME`
- `WP_APP_PASSWORD`
- `THEME` (default: `default`)
- `CACHE_TTL_SECONDS` (default: `86400`)

Production requirement:

- `DOMAIN` is required in production.

## Slug Usage

Slug-based routing in this project:

- `/` : Home (latest posts + pagination)
- `/articles` : all posts archive
- `/categories` : categories list
- `/categories/{slug}` : category archive
- `/tag/{slug}` : tag archive
- `/author/{slug}` : author archive
- `/search?q=term` : search results
- `/{post-slug}` : single post (if post exists)
- `/{page-slug}` : single WordPress page (fallback template)
- `/contact` : uses `themes/<theme>/contact.txs` when WP page slug exists
- `/privacy-policy` : uses `themes/<theme>/privacy-policy.txs` when WP page slug exists

Conditional navigation/footer behavior based on WP page slugs:

- Footer shows `About` only if a WP page with slug `about` exists.
- Footer shows `Privacy Policy` only if slug `privacy-policy` exists.
- Footer shows `Contact` only if slug `contact` exists.

## Theme Files

Main theme files you will edit most:

- `themes/default/config.txs`
- `themes/default/header.txs`

What they do:

- `config.txs`: theme settings + style tokens
- `header.txs` (theme root): extra custom `<head>` code (Google Analytics, Google Ads, custom CSS/JS, verification tags)

Note:

- `themes/default/components/header.txs` is the UI navigation/header template.
- `themes/default/header.txs` is for extra head scripts/styles/snippets.

## SEO (No Yoast)

SEO is generated directly from WP content:

- Home title: WordPress site title
- Home description: WordPress tagline
- Post title: post title
- Post description: first 160 chars of excerpt text
- OG title/description: same as meta title/description
- OG image: featured image (cached URL)

## Media Rules

Strict media policy in proxy/cache:

- Only images are supported
- SVG is blocked
- Video/audio/files are blocked
- Videos should be published on YouTube/Vimeo/etc and embedded in post content

## Caching

- API cache TTL from `CACHE_TTL_SECONDS`
- Media cache enabled for allowed image assets
- Image URLs are served via `/media-cache/...` for faster frontend delivery

## Deploy (Vercel)

1. Import GitHub repo into Vercel.
2. Add all environment variables.
3. Add custom domain in Vercel.
4. Ensure `DOMAIN` in env matches your production domain.
5. Deploy.

## Security Notes

- WP credentials are server-only.
- External redirects are blocked by app policy.
- CSP and secure response headers are enabled.
- WordPress post/page HTML is sanitized before rendering.
- Swiper assets are served locally from `/public/assets` (no third-party script source required).
- Media cache streams only non-SVG images and rejects oversized payloads.
- Do not commit real `.env` values.

## Credits

Created by [Chandima Galahitiyawa](https://chandimagalahitiyawa.com/)

Funded by [Turn Global](https://turn.global)

## Support

If this project helps you, please consider giving a star on GitHub and a donation for more contributions.

GitHub: [turnglobal/headlesswp](https://github.com/turnglobal/headlesswp)
