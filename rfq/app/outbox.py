import json
import logging
import threading
import time

from . import config, db, files as filesmod, integrations

log = logging.getLogger("rfq.outbox")
KINDS = ("scan", "ack_email", "reviewer_email", "telegram", "notion")
NEEDS_CLEAN_FILES = ("reviewer_email", "telegram", "notion")


def backoff(attempts):
    return min(config.BACKOFF_BASE * (4 ** (attempts - 1)), config.BACKOFF_CAP)


def enqueue(c, enquiry_id, now):
    for k in KINDS:
        c.execute("INSERT OR IGNORE INTO outbox(enquiry_id, kind, next_at) VALUES(?,?,?)", (enquiry_id, k, now))


def _load(c, enquiry_id):
    enq = dict(c.execute("SELECT * FROM enquiries WHERE enquiry_id=?", (enquiry_id,)).fetchone())
    data = json.loads(enq["data"])
    fl = [dict(r) for r in c.execute("SELECT * FROM files WHERE enquiry_id=? ORDER BY file_id", (enquiry_id,))]
    return enq, data, fl


def _scan_pending(c, enq_id, files_):
    for f in files_:
        if f["scan_status"] != "pending":
            continue
        try:
            sig = filesmod.clam_scan(f["path"])
        except filesmod.ClamUnavailable as e:
            raise RuntimeError(f"clamd unavailable: {e}")
        if sig:
            # Infected after acceptance: quarantine the file, keep the enquiry.
            import os
            try:
                os.remove(f["path"])
            except OSError:
                pass
            c.execute("UPDATE files SET scan_status='infected', path='' WHERE file_id=?", (f["file_id"],))
            log.error("file %s of %s infected (%s), removed", f["file_id"], enq_id, sig)
            integrations.telegram(f"Revalx: file in {enq_id} flagged by ClamAV ({sig}) and removed. Enquiry kept.")
        else:
            c.execute("UPDATE files SET scan_status='clean' WHERE file_id=?", (f["file_id"],))


def run_task(c, task):
    enq, data, fl = _load(c, task["enquiry_id"])
    kind = task["kind"]
    if kind == "scan":
        _scan_pending(c, enq["enquiry_id"], fl)
        return None
    if kind in NEEDS_CLEAN_FILES and c.execute("SELECT 1 FROM files WHERE enquiry_id=? AND scan_status='pending'", (enq["enquiry_id"],)).fetchone():
        return "defer"
    clean = [f for f in fl if f["scan_status"] == "clean"]
    if kind == "ack_email":
        return integrations.ack_email(enq, data)
    if kind == "reviewer_email":
        return integrations.reviewer_email(enq, data, clean)
    if kind == "telegram":
        return integrations.telegram_new(enq, data, len(clean))
    if kind == "notion":
        return integrations.notion_row(enq, data, len(clean))
    raise RuntimeError(f"unknown kind {kind}")


def process_due(limit=50):
    """One pass over due tasks. Returns the number attempted."""
    c = db.connect()
    n = 0
    try:
        now = int(time.time())
        due = [dict(r) for r in c.execute(
            "SELECT * FROM outbox WHERE status='pending' AND next_at<=? ORDER BY id LIMIT ?", (now, limit))]
        for t in due:
            n += _attempt(c, t)
    finally:
        c.close()
    return n


def _attempt(c, t):
    now = int(time.time())
    try:
        res = run_task(c, t)
    except Exception as e:  # noqa: BLE001 - any downstream failure must be recorded, never raised
        attempts = t["attempts"] + 1
        err = f"{type(e).__name__}: {e}"[:500]
        c.execute("INSERT INTO failures(at, enquiry_id, kind, attempt, error) VALUES(?,?,?,?,?)", (now, t["enquiry_id"], t["kind"], attempts, err))
        c.execute("UPDATE outbox SET attempts=?, last_error=?, next_at=? WHERE id=?", (attempts, err, now + backoff(attempts), t["id"]))
        log.error("outbox %s %s attempt %d failed: %s", t["enquiry_id"], t["kind"], attempts, err)
        if attempts >= config.ALERT_AFTER_FAILURES and not t["alerted"]:
            c.execute("UPDATE outbox SET alerted=1 WHERE id=?", (t["id"],))
            _alert(f"Revalx RFQ ALERT: {t['kind']} for {t['enquiry_id']} failed {attempts}x. Enquiry is stored and still retrying. "
                   f"Last error: {err[:200]}. Runbook: `rfq status` / `rfq retry {t['enquiry_id']}`.")
        return 1
    if res == "defer":
        c.execute("UPDATE outbox SET next_at=? WHERE id=?", (now + 30, t["id"]))
        return 0
    c.execute("UPDATE outbox SET status='done', done_at=?, external_id=?, last_error=NULL WHERE id=?", (now, res, t["id"]))
    return 1


def _alert(text):
    try:
        integrations.telegram(text)
    except Exception as e:  # noqa: BLE001
        log.error("telegram alert failed: %s", e)


class Worker(threading.Thread):
    daemon = True

    def __init__(self):
        super().__init__(name="outbox-worker")
        self.stop = threading.Event()

    def run(self):
        while not self.stop.is_set():
            try:
                process_due()
            except Exception:  # noqa: BLE001
                log.exception("worker pass failed")
            self.stop.wait(config.WORKER_INTERVAL)
