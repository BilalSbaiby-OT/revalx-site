# Revalx RFQ service: runbook

Owner: Platform & Security Engineer. Code: `rfq/`. PRD refs: §5, §6, §17, §18.

## What it does
`POST /api/rfq` (multipart) stores the enquiry in SQLite first (WAL, `synchronous=FULL`, volume `rfq-data` at `/data`), assigns `RVX-YYYY-NNNN`,
then returns 201. Everything else (customer acknowledgement, reviewer email, Telegram, Notion row, rescans) runs from an **outbox table**
after the commit, with retry and backoff. A downstream failure never loses or un-stores an enquiry.

| Response | Meaning |
|---|---|
| `201 {"enquiry_id"}` | stored |
| `200` same body | `Idempotency-Key` replayed, or identical content (same email, company, need, files) within 15 min |
| `422 {"errors":{field:msg}}` | validation, file type/size/count/magic bytes, virus, Turnstile. Reset the Turnstile widget on any 422 (tokens are single use) |
| `429` + `Retry-After` | per-IP limit (8 per 10 min) |
| `503` / `5xx` | not stored. Client retries with the same key |

Fields: required `name company email country need`; optional `valve_type(ball|butterfly|gate|check|unsure) size quantity media pressure temperature materials connection application delivery_date destination phone`; `lang(en|de|es|fr)`; honeypot field `website_url` (must stay empty and hidden); `cf-turnstile-response`; `files` (repeat the part, max 10, 20 MB each; PDF, DWG, DXF, STEP/STP, JPG, PNG).
A filled honeypot gets a fake 201 and nothing is stored or sent.

## Files
Stored under `/data/files/<xx>/<random id>.<ext>` on the `rfq-data` volume. nginx never mounts it and the service has no listing route.
Checks: extension allow-list, magic bytes must match the extension, ClamAV (`clamd`, INSTREAM). EICAR/infected: 422, nothing kept.
If clamd is down the enquiry is still stored, the file is `pending` (quarantined, no link), a `scan` task retries, and the reviewer email/Notion row wait until it is scanned.
Reviewers get **signed, expiring links** (`/api/rfq/files/<id>?e=<expiry>&s=<hmac>`, default 7 days). Anything else returns 403/404. New links: `rfq links RVX-2026-0001 --days 7`.

## Operating (run inside the `rfq` container: Coolify > revalx-rfq > Terminal, or `docker exec -it <rfq container> sh`)
```
python -m app.cli status                    # counts, and every task that is not done, with last error
python -m app.cli list                      # last 50 enquiries
python -m app.cli show RVX-2026-0001        # full record + task states
python -m app.cli retry RVX-2026-0001       # re-queue and run now (also: --all, --kind notion)
python -m app.cli links RVX-2026-0001       # fresh signed file links
python -m app.cli retention                 # report enquiries/files past the retention periods
```
Backoff: 30 s, 2 min, 8 min, 32 min, ... capped at 6 h, forever, until it succeeds. Telegram alert on the 3rd failure of a task (once per task); `retry` resets it.
Every failure is in table `failures` and in the container log (`ERROR rfq.outbox ...`; secrets are never logged).
`GET /api/rfq/health` returns `{"ok":true,"stuck_tasks":N}` for the uptime probe.

## Failure playbook
| Symptom | Action |
|---|---|
| Telegram "ALERT notion ... failed 3x" | `status` for the error. Token revoked / database unshared / Notion outage. Fix, then `retry --all`. Enquiries are safe in SQLite meanwhile |
| Telegram "ALERT ack_email" | Resend key or sender domain. Fix, `retry --kind ack_email` |
| "clamd unavailable" in log | `docker restart` the clamd container; pending files rescan automatically |
| Customer says no confirmation | `show` their id (or search `list`); stored but ack failed means `retry` |
| Disk > 70% | files volume is the only growth; run `retention`, ask CEO before deleting |

Backups: the `rfq-data` volume (SQLite + files) must be added to the nightly off-box backup (follow-up). Until then, SQLite is the only copy: use `sqlite3 rfq.db ".backup /tmp/x.db"`, never copy the live WAL files.

## Secrets (Coolify env, never in git, never printed)
`RFQ_SIGNING_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTION_TOKEN` (a Notion integration scoped to the Revalx page only), `NOTION_DATABASE_ID`, `RFQ_REVIEWER_EMAIL`, `RFQ_MAIL_FROM` (revalx.eu sender verified in Resend), `RFQ_PUBLIC_BASE_URL`.

## Retention `[pending her approval]`
Default proposal: **enquiries 24 months** after creation; **uploaded files 12 months after the enquiry is closed** (won/lost/disqualified). Quotation and invoice records required by tax law follow the legal period and are out of scope of this service.
Today `rfq retention` only reports; deletion stays manual until she approves. Deletion path for a data-subject request: delete the SQLite rows (`enquiries`, `files`, `outbox`) and the files on disk, delete the Notion row, then record it in the audit log. Backups age out under the backup retention.

## Data held (for the data map)
SQLite: name, company, email, phone, country, enquiry text, technical details, files. Notion: same minus files. Resend: recipient email and body. Telegram: company, country, short enquiry text (no email/phone). Logs: enquiry id, status, language, file count (no personal data).
