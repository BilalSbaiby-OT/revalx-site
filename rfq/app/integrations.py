"""Outbound calls. Every function raises on failure so the outbox retries it."""
import time

import httpx

from . import config, i18n, signing

TIMEOUT = httpx.Timeout(20.0)

VALVE_LABEL = {"ball": "Ball", "butterfly": "Butterfly", "gate": "Gate", "check": "Check", "unsure": "Not sure"}


def _technical(d):
    parts = []
    for k in ("media", "pressure", "temperature", "materials", "connection"):
        if d.get(k):
            parts.append(f"{k}: {d[k]}")
    return "; ".join(parts)


def send_resend(to, subject, text, idem):
    if not config.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY not configured")
    r = httpx.post(f"{config.RESEND_API_BASE}/emails", timeout=TIMEOUT,
                   headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "Idempotency-Key": idem},
                   json={"from": config.MAIL_FROM, "to": [to], "subject": subject, "text": text})
    if r.status_code >= 300:
        raise RuntimeError(f"resend {r.status_code}: {r.text[:200]}")
    return r.json().get("id")


def ack_email(enq, data):
    subject, body = i18n.ack(enq["lang"], data["name"], enq["enquiry_id"], data["need"])
    return send_resend(data["email"], subject, body, f"ack-{enq['enquiry_id']}")


def reviewer_email(enq, data, files):
    if not config.REVIEWER_EMAIL:
        raise RuntimeError("RFQ_REVIEWER_EMAIL not configured")
    lines = [f"New RFQ {enq['enquiry_id']} ({enq['lang']})", ""]
    for k in ("name", "company", "email", "phone", "country", "need", "valve_type", "size", "quantity", "media", "pressure",
              "temperature", "materials", "connection", "application", "delivery_date", "destination"):
        if data.get(k):
            lines.append(f"{k}: {data[k]}")
    lines.append("")
    if files:
        lines.append(f"Files ({len(files)}), signed links valid {config.LINK_TTL_SECONDS // 86400} days:")
        for f in files:
            lines.append(f"- {f['orig_name']} ({f['size'] // 1024} KB): {signing.sign_url(f['file_id'])}")
    else:
        lines.append("Files: none")
    return send_resend(config.REVIEWER_EMAIL, f"[Revalx RFQ] {enq['enquiry_id']} {data['company']} ({data['country']})",
                       "\n".join(lines), f"rev-{enq['enquiry_id']}")


def telegram(text):
    if not (config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID):
        raise RuntimeError("Telegram not configured")
    r = httpx.post(f"{config.TELEGRAM_API_BASE}/bot{config.TELEGRAM_BOT_TOKEN}/sendMessage", timeout=TIMEOUT,
                   json={"chat_id": config.TELEGRAM_CHAT_ID, "text": text, "disable_web_page_preview": True})
    if r.status_code >= 300 or not r.json().get("ok"):
        raise RuntimeError(f"telegram {r.status_code}")  # never include the URL: it contains the bot token
    return str(r.json()["result"]["message_id"])


def telegram_new(enq, data, n_files):
    need = data["need"][:140].replace("\n", " ")
    return telegram(f"New Revalx RFQ {enq['enquiry_id']}\n{data['company']} ({data['country']}), lang {enq['lang']}\n"
                    f"{VALVE_LABEL.get(data.get('valve_type'), 'valve n/a')}, files: {n_files}\n{need}")


def _notion_headers():
    return {"Authorization": f"Bearer {config.NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"}


def _rt(v):
    return {"rich_text": [{"text": {"content": (v or "")[:1900]}}]}


def notion_row(enq, data, n_files):
    if not (config.NOTION_TOKEN and config.NOTION_DATABASE_ID):
        raise RuntimeError("Notion not configured")
    # Idempotent create: if a previous attempt created the row but crashed before recording it, reuse it.
    q = httpx.post(f"{config.NOTION_API_BASE}/v1/databases/{config.NOTION_DATABASE_ID}/query", timeout=TIMEOUT, headers=_notion_headers(),
                   json={"filter": {"property": "Enquiry ID", "title": {"equals": enq["enquiry_id"]}}, "page_size": 1})
    if q.status_code >= 300:
        raise RuntimeError(f"notion query {q.status_code}: {q.text[:200]}")
    if q.json().get("results"):
        return q.json()["results"][0]["id"]
    created = time.strftime("%Y-%m-%d", time.gmtime(enq["created_at"]))
    props = {
        "Enquiry ID": {"title": [{"text": {"content": enq["enquiry_id"]}}]},
        "Date": {"date": {"start": created}},
        "Source": {"select": {"name": enq["source"]}},
        "Language": {"select": {"name": enq["lang"]}},
        "Owner": _rt(enq["owner"]),
        "Stage": {"select": {"name": "New"}},
        "Customer": _rt(data["name"]),
        "Company": _rt(data["company"]),
        "Country": _rt(data["country"]),
        "Email": {"email": data["email"]},
        "Need": _rt(data["need"]),
        "Technical details": _rt(_technical(data)),
        "Files": {"number": n_files},
    }
    if data.get("phone"):
        props["Phone"] = {"phone_number": data["phone"]}
    if data.get("valve_type"):
        props["Product type"] = {"select": {"name": VALVE_LABEL[data["valve_type"]]}}
    for k, prop in (("size", "Size"), ("quantity", "Quantity"), ("application", "Application"), ("destination", "Destination"),
                    ("delivery_date", "Delivery date")):
        if data.get(k):
            props[prop] = _rt(data[k])
    r = httpx.post(f"{config.NOTION_API_BASE}/v1/pages", timeout=TIMEOUT, headers=_notion_headers(),
                   json={"parent": {"database_id": config.NOTION_DATABASE_ID}, "properties": props})
    if r.status_code >= 300:
        raise RuntimeError(f"notion {r.status_code}: {r.text[:200]}")
    return r.json()["id"]


def turnstile_ok(token, ip):
    """True/False for a verdict; raises on network error so the client retries (503)."""
    r = httpx.post(config.TURNSTILE_VERIFY_URL, timeout=TIMEOUT,
                   data={"secret": config.TURNSTILE_SECRET, "response": token, "remoteip": ip})
    if r.status_code >= 500:
        raise RuntimeError("turnstile unavailable")
    return bool(r.json().get("success"))
