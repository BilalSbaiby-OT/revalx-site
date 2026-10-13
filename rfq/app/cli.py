"""Operator commands:  python -m app.cli status | list | show ID | retry [ID|--all] [--kind K] | links ID | purge-due"""
import argparse
import json
import sys
import time

from . import db, outbox, signing


def fmt(ts):
    return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts)) if ts else "-"


def main(argv=None):
    ap = argparse.ArgumentParser(prog="rfq")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    sub.add_parser("list")
    p = sub.add_parser("show"); p.add_argument("id")
    p = sub.add_parser("retry"); p.add_argument("id", nargs="?"); p.add_argument("--all", action="store_true"); p.add_argument("--kind")
    p = sub.add_parser("links"); p.add_argument("id"); p.add_argument("--days", type=int, default=7)
    sub.add_parser("process")
    sub.add_parser("retention")
    a = ap.parse_args(argv)
    c = db.connect()

    if a.cmd == "status":
        n = c.execute("SELECT COUNT(*) FROM enquiries").fetchone()[0]
        print(f"enquiries stored: {n}")
        for r in c.execute("SELECT kind, status, COUNT(*) n, MAX(attempts) att FROM outbox GROUP BY kind, status ORDER BY kind, status"):
            print(f"  {r['kind']:15} {r['status']:8} {r['n']:4} (max attempts {r['att']})")
        print("not done:")
        for r in c.execute("SELECT * FROM outbox WHERE status!='done' ORDER BY id"):
            print(f"  {r['enquiry_id']} {r['kind']} attempts={r['attempts']} next={fmt(r['next_at'])} err={r['last_error']}")
    elif a.cmd == "list":
        for r in c.execute("SELECT enquiry_id, created_at, lang, stage, json_extract(data,'$.company') co, json_extract(data,'$.country') ct FROM enquiries ORDER BY id DESC LIMIT 50"):
            print(f"{r['enquiry_id']}  {fmt(r['created_at'])}  {r['lang']}  {r['stage']:8} {r['co']} ({r['ct']})")
    elif a.cmd == "show":
        r = c.execute("SELECT * FROM enquiries WHERE enquiry_id=?", (a.id,)).fetchone()
        if not r:
            sys.exit("not found")
        print(json.dumps({**dict(r), "data": json.loads(r["data"])}, indent=2, ensure_ascii=False))
        for t in c.execute("SELECT kind,status,attempts,last_error,done_at FROM outbox WHERE enquiry_id=?", (a.id,)):
            print(dict(t))
    elif a.cmd == "retry":
        if not (a.id or a.all):
            sys.exit("give an enquiry id or --all")
        q = "UPDATE outbox SET status='pending', attempts=0, alerted=0, next_at=? WHERE status!='done'"
        args = [int(time.time())]
        if a.id:
            q += " AND enquiry_id=?"; args.append(a.id)
        if a.kind:
            q += " AND kind=?"; args.append(a.kind)
        n = c.execute(q, args).rowcount
        print(f"re-queued {n} task(s); processing now")
        done = outbox.process_due(500)
        print(f"attempted {done}")
        for r in c.execute("SELECT enquiry_id, kind, status, last_error FROM outbox WHERE status!='done'"):
            print("  still failing:", dict(r))
    elif a.cmd == "process":
        print("attempted", outbox.process_due(500))
    elif a.cmd == "links":
        for f in c.execute("SELECT * FROM files WHERE enquiry_id=? AND scan_status='clean'", (a.id,)):
            print(f"{f['orig_name']}: {signing.sign_url(f['file_id'], ttl=a.days * 86400)}")
    elif a.cmd == "retention":
        now = int(time.time())
        for r in c.execute("SELECT enquiry_id FROM enquiries WHERE created_at < ?", (now - 730 * 86400,)):
            print("enquiry older than 24 months:", r["enquiry_id"])
        for r in c.execute("SELECT enquiry_id FROM enquiries WHERE closed_at IS NOT NULL AND closed_at < ?", (now - 365 * 86400,)):
            print("closed >12 months, files due for deletion:", r["enquiry_id"])
        print("(report only: deletion is manual until the retention periods are approved)")


if __name__ == "__main__":
    main()
