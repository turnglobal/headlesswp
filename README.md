# HeadlessWP

A fast, migration-friendly Headless WordPress frontend built with Next.js + Handlebars `.txs` themes.

WordPress runs as the content backend (for example `https://wp.example.com`) and this app runs as the public site (for example `https://example.com`).

This is an open-source project. If it helps you, contribute to core and share new themes. It is built to be SEO + GEO friendly, with strong Core Web Vitals focus and smooth UX.

[![Sinhala video guide](https://i.imgur.com/ORLlOcj.jpeg)](https://www.facebook.com/reel/4443085892578909)

Full video link: [https://www.facebook.com/reel/4443085892578909](https://www.facebook.com/reel/4443085892578909)

Small note: this guide is currently in Sinhala. We hope to upload a YouTube version soon with English subtitles (or a full English video).

## Quick Start

1. Clone this repo.
2. Copy `.env.example` to `.env`.
3. Update all required values.
4. Install dependencies.
5. Run local dev server.

```bash
git clone https://github.com/turnglobal/headlesswp
cd headlesswp
npm install
npm run dev
```

Open: `http://localhost:3000`

## For Non-Developers (Step-by-Step)

1. Star this repository on GitHub.
2. Fork this repository to your own GitHub account.
3. In your new fork, go to `Settings`.
4. Click to leave the fork network (detach from parent), then make the repository private.
5. In your repo files, copy `.env.example` to `.env`.
6. Edit `.env` and add your own WordPress/API details.
7. Create a [Vercel](https://vercel.com/) account.
8. Authorize/connect your GitHub account in Vercel.
9. Install Git integration on Vercel (when prompted) and allow repository access.
10. In Vercel, import your GitHub project.
11. Add environment variables in Vercel (same values from your `.env`).
12. Add your domain in Vercel project settings.
13. In your domain/DNS provider, add the required `CNAME` and `A` records exactly as Vercel shows.
14. After your final domain is ready, update `DOMAIN` in `.env` and Vercel env vars using the final public URL, for example:
    - `DOMAIN=https://www.example.com`
15. Auto Redeploy from Vercel dashboard.

## Environment Variables (Full)

Required:

- `WP_DOMAIN` (example: `https://wp.example.com`)
- `WP_USERNAME` (WordPress user with REST/API access)
- `WP_APP_PASSWORD` (WordPress application password)

Optional:

- `THEME` (default: `default`)
- `CACHE_TTL_SECONDS` (default: `86400`)
- `DOMAIN` (recommended in all environments, required in production)

### Important: `DOMAIN` in Production

In production, `DOMAIN` is required for canonical URL generation.

If missing, app throws and Vercel can return `500` with message similar to:

`DOMAIN is required in production for secure canonical URL generation.`

Fix:

1. In `.env` / Vercel env vars, set:
   - `DOMAIN=https://your-final-domain.com`
2. If you copied from `.env.example`, remove the `#` comment and set real domain:
   - from `# DOMAIN=https://example.com`
   - to `DOMAIN=https://your-final-domain.com`
3. In Vercel, also add your same custom domain under project Domains.

## NPM Scripts

- `npm run dev` : start Next.js dev server
- `npm run devs` : alias of `dev`
- `npm run build` : production build
- `npm run start` : run production server
- `npm run lint` : lint project
- `npm run build:assets` : build CSS + vendor assets
- `npm run dev:styles` : watch Tailwind output

## Full Routing / URL Possibilities

Implemented in `src/app/[[...slug]]/route.ts`.

- `/` : home (sticky hero + latest posts + pagination via `?page=`)
- `/search?q=term` : site search
- `/articles` : all posts archive (`?page=` supported)
- `/categories` : all categories list
- `/categories/{slug}` : category archive (`?page=` supported)
- `/tag/{slug}` : tag archive (`?page=` supported)
- `/author/{slug}` : author archive (`?page=` supported)
- `/contact` : WP page slug `contact` rendered with `themes/<theme>/contact.txs`
- `/privacy-policy` : WP page slug `privacy-policy` rendered with `themes/<theme>/privacy-policy.txs`
- `/{post-slug}` : single post (if post exists)
- `/{page-slug}` : WP page fallback rendered with `themes/<theme>/page.txs`
- Unknown/invalid paths: custom `404`
- Redirect `gone: true` or status `410` in redirects config: custom `410`

## Redirect Rules

Manage in `redirects.json`.

Supported:

- `301` permanent redirect
- `302` temporary redirect
- `410` gone

Example:

```json
[
  { "from": "/old-url", "to": "/new-url", "status": 301 },
  { "from": "/temp-url", "to": "/landing", "status": 302 },
  { "from": "/removed-url", "gone": true, "status": 410 }
]
```

Security policy: external-origin redirects are blocked.

## Theme System (All Main Files)

Primary editable files:

- `themes/default/config.txs` : theme settings + style tokens
- `themes/default/header.txs` : custom `<head>` snippets (analytics, ads, verifications, custom CSS/JS)
- `themes/default/components/*.txs` : shared partials
- `themes/default/home.txs` : homepage
- `themes/default/post.txs` : single post layout
- `themes/default/page.txs` : generic WP page layout
- `themes/default/articles.txs` : all articles archive
- `themes/default/categories.txs` : categories list
- `themes/default/category-archive.txs` : category archive
- `themes/default/tag.txs` : tag archive
- `themes/default/author-archive.txs` : author archive
- `themes/default/search.txs` : search results
- `themes/default/contact.txs` : contact page template
- `themes/default/privacy-policy.txs` : privacy page template

Notes:

- `themes/default/header.txs` is for custom head scripts/styles.
- `themes/default/components/header.txs` is the visual site header/nav partial.

## SEO + GEO + Schema

Automatically generated from WordPress content:

- title/description/canonical
- Open Graph + Twitter tags
- `WebSite`, `Organization`, `WebPage`, `BreadcrumbList` JSON-LD
- `BlogPosting` JSON-LD for single posts

## Media Cache Rules

Media proxy endpoint: `/media-cache/...`

Rules:

- only local WP uploads (`/wp-content/uploads/...`) are proxied
- only non-SVG images are allowed
- video/audio/other binary files are blocked
- max image size limit: 12 MB
- cache headers enabled for edge caching

If you need videos, host in YouTube/Vimeo/Facebook and embed in post content.

## Security Highlights

- WordPress credentials are server-only
- CSP with per-request nonce
- secure headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.)
- HTML content sanitization before rendering
- external redirects blocked
- local vendor assets (no required third-party script CDN)

## Deployment (Vercel) Complete Steps

1. Push repo to GitHub.
2. Import project into Vercel.
3. Add all environment variables:
   - `WP_DOMAIN`
   - `WP_USERNAME`
   - `WP_APP_PASSWORD`
   - `THEME` (optional)
   - `CACHE_TTL_SECONDS` (optional)
   - `DOMAIN` (**required in production**)
4. Add your custom domain in Vercel project settings.
5. Ensure `DOMAIN` exactly matches the production public domain.
6. Redeploy.

## Troubleshooting

### 500 on Vercel

Most common reason: `DOMAIN` not set in production.

Action:

- set `DOMAIN=https://your-final-domain.com` in Vercel env vars
- ensure it is not commented (`# DOMAIN=...`)
- redeploy

### WP API auth errors

- verify `WP_USERNAME`
- regenerate `WP_APP_PASSWORD`
- confirm user permission and REST access

### Wrong content/domain behavior

- check `WP_DOMAIN` is correct origin
- ensure WordPress site is reachable from Vercel

### Styling not updating

- run `npm run build:assets`
- restart `npm run dev`

## Contributing

- fork / branch
- implement changes
- run `npm run lint`
- open PR

## Credits

Created by [Chandima Galahitiyawa](https://chandimagalahitiyawa.com/)

Funded by [Turn Global](https://turn.global)

## Support

If this project helps you, please consider starring and donating for further contributions.

GitHub: [turnglobal/headlesswp](https://github.com/turnglobal/headlesswp)
