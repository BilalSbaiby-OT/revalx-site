import hashlib
import json
import logging
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.datastructures import UploadFile

from . import config, db, files as filesmod, integrations, outbox, signing, validation

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # its INFO lines contain the Telegram bot token in the URL
logging.getLogger("httpcore").setLevel(logging.WARNING)
log = logging.getLogger("rfq")

DEDUPE_WINDOW = 15 * 60


@asynccontextmanager
async def lifespan(app):
    db.init()
    worker = None
    if os.environ.get("RFQ_DISABLE_WORKER") != "1":
        worker = outbox.Worker()
        worker.start()
    yield
    if worker:
        worker.stop.set()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

_hits = defaultdict(deque)
_hits_lock = Lock()


def client_ip(request: Request):
    # Traefik appends the real peer to X-Forwarded-For; the last entry is the only one we trust.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def rate_limited(ip):
    now = time.time()
    with _hits_lock:
        q = _hits[ip]
        while q and q[0] < now - config.RATE_LIMIT_WINDOW:
            q.popleft()
        if len(q) >= config.RATE_LIMIT_MAX:
            return int(q[0] + config.RATE_LIMIT_WINDOW - now) + 1
        q.append(now)
        return 0


def err(status, errors, headers=None):
    return JSONResponse({"errors": errors}, status_code=status, headers=headers)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    if request.method == "POST":
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > config.MAX_BODY_BYTES:
            return err(422, {"files": "upload too large (max 10 files, 20 MB each)"})
    return await call_next(request)


@app.get("/api/rfq/health")
def health():
    c = db.connect()
    try:
        row = c.execute("SELECT COUNT(*) FROM outbox WHERE status='pending' AND attempts>=?", (config.ALERT_AFTER_FAILURES,)).fetchone()
        return {"ok": True, "stuck_tasks": row[0]}
    finally:
        c.close()


def _existing(c, key):
    return c.execute("SELECT enquiry_id FROM enquiries WHERE idempotency_key=?", (key,)).fetchone()


def _remove(paths):
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass


@app.post("/api/rfq")
async def create_rfq(request: Request):
    ip = client_ip(request)
    wait = rate_limited(ip)
    if wait:
        return JSONResponse({"errors": {"_": "too many requests"}}, status_code=429, headers={"Retry-After": str(wait)})

    key = (request.headers.get("idempotency-key") or "").strip()
    if not key or len(key) > 128 or not key.isprintable():
        return err(422, {"idempotency_key": "Idempotency-Key header required (max 128 chars)"})

    # Replay first: a Turnstile token is single use, so a retry with the same key must not re-verify.
    c = db.connect()
    try:
        row = _existing(c, key)
    finally:
        c.close()
    if row:
        return JSONResponse({"enquiry_id": row[0]}, status_code=200)

    try:
        form = await request.form(max_files=50, max_fields=100)
    except Exception:
        return err(422, {"_": "malformed multipart body"})
    try:
        return await _handle(request, form, key, ip)
    finally:
        await form.close()


async def _handle(request, form, key, ip):
    # Honeypot: pretend success, store nothing that triggers mail or Notion.
    if form.get("website") or form.get("website_url") or form.get("hp"):
        c = db.connect()
        c.execute("INSERT INTO spam_log(at, reason) VALUES(?, 'honeypot')", (int(time.time()),))
        c.close()
        return JSONResponse({"enquiry_id": "RVX-%d-%04d" % (time.gmtime().tm_year, secrets.randbelow(9000) + 1000)}, status_code=201)

    data, lang, errors = validation.clean(form)

    uploads = [v for _, v in form.multi_items() if isinstance(v, UploadFile) and (v.filename or "")]
    uploads = [u for u in uploads if u.filename]
    if len(uploads) > config.MAX_FILES:
        errors["files"] = f"too many files (max {config.MAX_FILES})"
        uploads = []
    staged = []  # (path, orig_name, ext, size, sha)
    try:
        for u in uploads:
            name = filesmod.safe_name(u.filename)
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if ext not in config.ALLOWED_EXT:
                errors["files"] = f"{name}: file type not allowed (PDF, DWG, DXF, STEP, JPG, PNG)"
                break
            fid = secrets.token_hex(16)
            path = os.path.join(config.FILES_DIR, fid[:2], f"{fid}.{ext}")
            os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
            size, head = 0, b""
            with open(path, "wb") as out:
                while True:
                    chunk = await u.read(1 << 20)
                    if not chunk:
                        break
                    if not head:
                        head = chunk[:600]
                    size += len(chunk)
                    if size > config.MAX_FILE_BYTES:
                        break
                    out.write(chunk)
            staged.append([path, name, ext, size, None, fid])
            if size > config.MAX_FILE_BYTES:
                errors["files"] = f"{name}: larger than 20 MB"
                break
            if size == 0:
                errors["files"] = f"{name}: empty file"
                break
            if filesmod.sniff(head) != filesmod.EXT_TYPE[ext]:
                errors["files"] = f"{name}: content does not match a {ext.upper()} file"
                break
        if errors:
            _remove(p[0] for p in staged)
            return err(422, errors)

        if not config.TURNSTILE_SECRET:
            _remove(p[0] for p in staged)
            log.error("TURNSTILE_SECRET_KEY not configured: refusing submissions")
            return err(503, {"_": "service not configured"})
        token = form.get("cf-turnstile-response") or ""
        try:
            ok = bool(token) and integrations.turnstile_ok(token, ip)
        except Exception as e:  # noqa: BLE001
            _remove(p[0] for p in staged)
            log.error("turnstile verify failed: %s", e)
            return err(503, {"_": "spam check unavailable, retry"})
        if not ok:
            _remove(p[0] for p in staged)
            return err(422, {"turnstile": "spam check failed, please retry"})

        # Virus scan. clamd down must not lose the enquiry: the file stays quarantined as 'pending'.
        for s in staged:
            try:
                sig = filesmod.clam_scan(s[0])
                if sig:
                    _remove(p[0] for p in staged)
                    log.warning("upload rejected, malware signature %s", sig)
                    return err(422, {"files": f"{s[1]}: rejected by virus scan"})
                s.append("clean")
            except filesmod.ClamUnavailable as e:
                log.error("clamd unavailable, file quarantined for rescan: %s", e)
                s.append("pending")
            s[4] = filesmod.sha256_file(s[0])
    except BaseException:
        _remove(p[0] for p in staged)
        raise

    fp = hashlib.sha256(json.dumps([data.get("email", "").lower(), data.get("company", "").lower(), data.get("need", ""),
                                    sorted(s[4] for s in staged)]).encode()).hexdigest()
    now = int(time.time())
    try:
        with db.tx() as c:
            row = _existing(c, key) or c.execute(
                "SELECT enquiry_id FROM enquiries WHERE fingerprint=? AND created_at>?", (fp, now - DEDUPE_WINDOW)).fetchone()
            if row:
                result, status = row[0], 200
            else:
                eid = db.next_enquiry_id(c, now)
                owner = config.DEFAULT_OWNER
                c.execute("INSERT INTO enquiries(enquiry_id, idempotency_key, fingerprint, created_at, lang, owner, data) VALUES(?,?,?,?,?,?,?)",
                          (eid, key, fp, now, lang, owner, json.dumps(data)))
                for s in staged:
                    c.execute("INSERT INTO files(file_id, enquiry_id, orig_name, ext, size, sha256, scan_status, path) VALUES(?,?,?,?,?,?,?,?)",
                              (s[5], eid, s[1], s[2], s[3], s[4], s[6], s[0]))
                outbox.enqueue(c, eid, now)
                result, status = eid, 201
    except sqlite3.IntegrityError:
        # Lost a race on the unique key: the other request committed, so replay it.
        _remove(p[0] for p in staged)
        c = db.connect()
        row = _existing(c, key)
        c.close()
        if row:
            return JSONResponse({"enquiry_id": row[0]}, status_code=200)
        raise
    except BaseException:
        _remove(p[0] for p in staged)
        raise
    if status == 200:
        _remove(p[0] for p in staged)
    log.info("rfq %s status=%d files=%d lang=%s", result, status, len(staged), lang)
    return JSONResponse({"enquiry_id": result}, status_code=status)


@app.get("/api/rfq/files/{file_id}")
def get_file(file_id: str, e: str = "", s: str = ""):
    if not signing.verify(file_id, e, s):
        return Response("forbidden", status_code=403)
    c = db.connect()
    try:
        row = c.execute("SELECT * FROM files WHERE file_id=?", (file_id,)).fetchone()
    finally:
        c.close()
    if not row or row["scan_status"] != "clean" or not os.path.exists(row["path"]):
        return Response("not found", status_code=404)
    return FileResponse(row["path"], filename=row["orig_name"], headers={
        "Content-Disposition": f'attachment; filename="{row["orig_name"]}"',
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox"})
