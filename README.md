# revalx-site (release-1)
Static, dependency-free generator: `node site/build.mjs` writes `dist/<lang>/...`.
- Strings: `site/i18n/<lang>.json`. A locale is enabled by adding its file (en, de, es, fr; non-EN show a draft banner; slugs identical across locales; glossary in site/i18n/GLOSSARY.md). URLs are `/<lang>/...`.
- RFQ form: `site/assets/rfq.js` posts multipart to same-origin `POST /api/rfq` (Idempotency-Key per form load, field `lang`, honeypot field `website`, Turnstile token `cf-turnstile-response`).
- Container: nginx with basic auth (`PREVIEW_USER`, `PREVIEW_PASS`), `X-Robots-Tag: noindex, nofollow`, `/api/` proxied to `RFQ_UPSTREAM`. Build arg `TURNSTILE_SITEKEY`.
- Preview only. Do not merge to `main` (holding page) until launch.
