"""20 scripted RFQs against a real uvicorn instance (stub downstreams). Prints evidence; exit 1 on any failed expectation."""
import io, os, subprocess, sys, tempfile, time, uuid, json, sqlite3, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import httpx
import stubs

HTTP, CLAM, APP = 8771, 8772, 8770
tmp = tempfile.mkdtemp(prefix="rfq-acc-")
stubs.start(HTTP, CLAM)
env = dict(os.environ, RFQ_DATA_DIR=tmp, RFQ_SIGNING_KEY="acceptance-signing-key-not-secret", TURNSTILE_SECRET_KEY="x",
           TURNSTILE_VERIFY_URL=f"http://127.0.0.1:{HTTP}/turnstile", CLAMD_HOST="127.0.0.1", CLAMD_PORT=str(CLAM),
           RESEND_API_KEY="k", RESEND_API_BASE=f"http://127.0.0.1:{HTTP}", RFQ_REVIEWER_EMAIL="reviewer@example.test",
           TELEGRAM_BOT_TOKEN="t", TELEGRAM_CHAT_ID="1", TELEGRAM_API_BASE=f"http://127.0.0.1:{HTTP}",
           NOTION_TOKEN="n", NOTION_DATABASE_ID="db", NOTION_API_BASE=f"http://127.0.0.1:{HTTP}",
           RFQ_RATE_LIMIT_MAX="1000", RFQ_BACKOFF_BASE="1", RFQ_WORKER_INTERVAL="1", PYTHONPATH=os.path.join(os.path.dirname(__file__), ".."))
srv = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(APP), "--log-level", "warning"], env=env,
                       cwd=os.path.join(os.path.dirname(__file__), ".."))
base = f"http://127.0.0.1:{APP}"
for _ in range(50):
    try:
        httpx.get(base + "/api/rfq/health"); break
    except Exception:
        time.sleep(0.2)

PDF = b"%PDF-1.4\n" + b"x" * 2000
EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
OK_FIELDS = dict(name="Anna Meyer", company="Meyer Anlagenbau GmbH", email="anna@meyer-anlagenbau.example", country="DE",
                 need="10x DN100 PN16 ball valves, stainless, for a water treatment plant", lang="de")
FULL = dict(OK_FIELDS, valve_type="ball", size="DN100", quantity="10", media="water", pressure="PN16", temperature="80C",
            materials="316", connection="flanged", application="water treatment", delivery_date="2026-12-01", destination="Hamburg", phone="+49 40 123456")
results, fails = [], []
SIGNED_LINKS = []


def post(label, fields, files=(), key=None, expect=None, ts="good-token", headers=None):
    key = key or str(uuid.uuid4())
    data = dict(fields)
    if ts is not None:
        data["cf-turnstile-response"] = ts
    fl = [("files", (n, io.BytesIO(b), "application/octet-stream")) for n, b in files]
    r = httpx.post(base + "/api/rfq", data=data, files=fl or None, headers={"Idempotency-Key": key, **(headers or {})}, timeout=60)
    ok = r.status_code == expect[0] and (expect[1] is None or expect[1] in r.text)
    results.append((label, r.status_code, r.text[:110], "PASS" if ok else "FAIL"))
    if not ok:
        fails.append(label)
    return r, key


def db():
    return sqlite3.connect(os.path.join(tmp, "rfq.db"))


# 1 valid minimal
r1, k1 = post("01 valid, required only", OK_FIELDS, expect=(201, "RVX-"))
# 2 valid full + files
r2, _ = post("02 valid, all fields + PDF + PNG", FULL, [("drawing.pdf", PDF), ("photo.png", b"\x89PNG\r\n\x1a\n" + b"0" * 500)], expect=(201, "RVX-"))
# 3 incomplete optional
post("03 incomplete optional (valve_type=unsure)", dict(OK_FIELDS, valve_type="unsure", lang="fr", need="Je cherche des vannes, détails à confirmer", email="c@client.example"), expect=(201, "RVX-"))
# 4-6 missing required
post("04 missing email", {k: v for k, v in OK_FIELDS.items() if k != "email"}, expect=(422, '"email"'))
post("05 missing need + company", {k: v for k, v in OK_FIELDS.items() if k not in ("need", "company")}, expect=(422, '"need"'))
post("06 bad email + bad valve_type", dict(OK_FIELDS, email="nope", valve_type="spool"), expect=(422, '"valve_type"'))
# 7 replay same key
r7, _ = post("07 idempotency replay (same key as #1)", OK_FIELDS, key=k1, ts="spent-token", expect=(200, r1.json()["enquiry_id"]))
# 8 double submit: different key, same content
post("08 double-submit, new key same content", OK_FIELDS, expect=(200, r1.json()["enquiry_id"]))
# 9 11 files
post("09 11 files", OK_FIELDS, [(f"f{i}.pdf", PDF) for i in range(11)], expect=(422, "too many files"))
# 10 25 MB
post("10 25 MB file", dict(OK_FIELDS, need="big drawing"), [("big.pdf", b"%PDF-1.4\n" + b"0" * (25 * 1024 * 1024))], expect=(422, "20 MB"))
# 11 disguised exe
post("11 disguised .exe as drawing.pdf", dict(OK_FIELDS, need="exe"), [("drawing.pdf", b"MZ\x90\x00" + b"\x00" * 600)], expect=(422, "does not match"))
# 12 EICAR
post("12 EICAR test file", dict(OK_FIELDS, need="eicar"), [("test.pdf", b"%PDF-1.4\n" + EICAR)], expect=(422, "virus scan"))
# 13 .exe extension
post("13 .exe extension", dict(OK_FIELDS, need="exe2"), [("setup.exe", b"MZ" + b"0" * 600)], expect=(422, "not allowed"))
# 14 honeypot
r14, _ = post("14 honeypot filled (bot)", dict(OK_FIELDS, need="spam", website_url="http://spam.test"), expect=(201, "RVX-"))
# 15 bad turnstile
post("15 failed Turnstile", dict(OK_FIELDS, need="ts"), ts="bad-token", expect=(422, "turnstile"))
# 16 missing idempotency
r = httpx.post(base + "/api/rfq", data=dict(OK_FIELDS, need="nokey"))
results.append(("16 no Idempotency-Key", r.status_code, r.text[:110], "PASS" if r.status_code == 422 else "FAIL")); r.status_code == 422 or fails.append("16")
# 17 STEP + DXF files valid
post("17 valid, STEP + DXF + JPG", dict(OK_FIELDS, need="cad files"),
     [("part.step", b"ISO-10303-21;\nHEADER;" + b"0" * 300), ("part.dxf", b"  0\nSECTION\n  2\nHEADER\n" + b"0" * 300), ("p.jpg", b"\xff\xd8\xff\xe0" + b"0" * 300)], expect=(201, "RVX-"))
# 18 notion outage: valid RFQs while Notion is down
stubs.STATE["notion_down"] = True
r18a, _ = post("18a valid during Notion outage", dict(OK_FIELDS, need="outage one", email="o1@x.example"), [("o.pdf", PDF)], expect=(201, "RVX-"))
r18b, _ = post("18b valid during Notion outage", dict(OK_FIELDS, need="outage two", email="o2@x.example"), expect=(201, "RVX-"))
time.sleep(12)  # worker retries with 1s,4s,16s backoff: >=3 failures and a Telegram alert
alerts_during = [t for t in stubs.STATE["telegram"] if "ALERT" in t]
c = db()
pend = c.execute("SELECT enquiry_id, attempts FROM outbox WHERE kind='notion' AND status='pending'").fetchall()
print("\nduring outage, notion queue:", pend)
print("telegram alerts so far:", len(alerts_during), "|", alerts_during[:1])
ok = len(pend) >= 2 and all(a >= 3 for _, a in pend) and len(alerts_during) >= 2
results.append(("19 outage: stored, queued, >=3 failures, Telegram alert", "-", f"queue={len(pend)} alerts={len(alerts_during)}", "PASS" if ok else "FAIL")); ok or fails.append("19")
# recovery
stubs.STATE["notion_down"] = False
out = subprocess.run([sys.executable, "-m", "app.cli", "retry", "--all"], env=env, cwd=os.path.join(os.path.dirname(__file__), ".."), capture_output=True, text=True).stdout
print("rfq retry --all ->", out.strip())
left = c.execute("SELECT COUNT(*) FROM outbox WHERE status!='done' AND kind!='scan'").fetchone()[0]
ids = [r[0] for r in c.execute("SELECT enquiry_id FROM enquiries")]
missing = [i for i in ids if i not in stubs.STATE["notion"]]
ok = left == 0 and not missing
results.append(("20 after outage: retry clears queue, all rows in Notion", "-", f"queue_left={left} missing_in_notion={missing}", "PASS" if ok else "FAIL")); ok or fails.append("20")

# --- invariants
time.sleep(3)
c = db()
n_enq = c.execute("SELECT COUNT(*) FROM enquiries").fetchone()[0]
n_dup = c.execute("SELECT COUNT(*) FROM (SELECT 1 FROM enquiries GROUP BY fingerprint HAVING COUNT(*)>1)").fetchone()[0]
acks = stubs.STATE["resend"]
ack_to = [a for a in acks if a["to"] != "reviewer@example.test"]
ack_ids = [a["idem"][4:] for a in ack_to]
unstored = [i for i in ack_ids if i not in ids]
dup_acks = len(ack_ids) - len(set(ack_ids))
print(f"\nSQLite enquiries: {n_enq} {ids}\nduplicate fingerprints: {n_dup}\nack emails sent: {len(ack_ids)}; acks without stored row: {len(unstored)}; duplicate acks: {dup_acks}")
print("ack subjects (lang):", sorted({a['subject'][:28] for a in ack_to}))
print("enquiries in Notion:", len(stubs.STATE['notion']), "reviewer emails:", len([a for a in acks if a['to'] == 'reviewer@example.test']))
tg_new = [t for t in stubs.STATE["telegram"] if t.startswith("New Revalx RFQ")]
print("telegram new-RFQ messages:", len(tg_new))
inv = n_dup == 0 and not unstored and dup_acks == 0 and len(ack_ids) == n_enq and len(tg_new) == n_enq and len(stubs.STATE["notion"]) == n_enq
results.append(("INV 0 dup, 0 ack without row, every row acked/notified/in Notion", "-", f"enq={n_enq} acks={len(ack_ids)} notion={len(stubs.STATE['notion'])}", "PASS" if inv else "FAIL")); inv or fails.append("INV")

# --- file privacy
f = c.execute("SELECT file_id, path, scan_status FROM files LIMIT 1").fetchone()
fid = f[0]
rev = [a for a in acks if a["to"] == "reviewer@example.test"]
import importlib; os.environ.update(env); sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import signing, config; config.SIGNING_KEY = env["RFQ_SIGNING_KEY"]
good = signing.sign_path(fid); expired = signing.sign_path(fid, now=time.time() - 10 * 86400)
checks = [("no signature", f"/api/rfq/files/{fid}", 403), ("forged signature", f"/api/rfq/files/{fid}?e=9999999999&s=deadbeef", 403),
          ("expired link", expired, 403), ("valid link", good, 200), ("valid sig, unknown file", signing.sign_path("0" * 32), 404),
          ("guessing the on-disk path", "/files/" + os.path.relpath(f[1], os.path.join(tmp, "files")), 404)]
print("\nfile access:")
for label, p, want in checks:
    code = httpx.get(base + p).status_code
    print(f"  {label:28} GET {p.split('?')[0][:40]:42} -> {code}")
    results.append((f"FILE {label}", code, "", "PASS" if code == want else "FAIL")); code == want or fails.append("FILE " + label)

srv.terminate()
print("\n#  | HTTP | body | verdict")
for r in results:
    print(" | ".join(str(x) for x in r))
print("\nFAILED:" if fails else "\nALL PASS", fails or "")
sys.exit(1 if fails else 0)
