# REVALX proposal preview (RES-1379)
English-only static preview of the owner's 19 Oct list: Request a Quote, FAQ, catalogue, one product detail template, image spec.
`node proposal/build.mjs` -> `proposal/dist`; `docker build proposal`. Container `revalx-proposal` + `revalx-proposal-rfq`
(the existing RFQ service image with its own volume and no mail/Notion/Telegram keys, Cloudflare test Turnstile keys).
Gate: Traefik rule on preview.revalx.eu, priority 1000: header `X-Preview: <token>`, or cookie `rvxp` (set by `?k=<token>`).
Not for `main` until the owner approves via the founder.
