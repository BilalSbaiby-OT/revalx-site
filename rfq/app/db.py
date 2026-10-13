import sqlite3
import threading
import time
from contextlib import contextmanager

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  lang TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website',
  owner TEXT NOT NULL,
  data TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'New',
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS enq_fp ON enquiries(fingerprint, created_at);
CREATE TABLE IF NOT EXISTS counters (year INTEGER PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS files (
  file_id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL REFERENCES enquiries(enquiry_id),
  orig_name TEXT NOT NULL,
  ext TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  scan_status TEXT NOT NULL,          -- clean | pending
  path TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id TEXT NOT NULL REFERENCES enquiries(enquiry_id),
  kind TEXT NOT NULL,                 -- scan | ack_email | reviewer_email | telegram | notion
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER NOT NULL,
  last_error TEXT,
  alerted INTEGER NOT NULL DEFAULT 0,
  external_id TEXT,
  done_at INTEGER,
  UNIQUE(enquiry_id, kind)
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(status, next_at);
CREATE TABLE IF NOT EXISTS failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL, enquiry_id TEXT, kind TEXT, attempt INTEGER, error TEXT
);
CREATE TABLE IF NOT EXISTS spam_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, reason TEXT NOT NULL);
"""

_lock = threading.Lock()


def connect():
    c = sqlite3.connect(config.DB_PATH, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=FULL")  # an acknowledged enquiry must survive power loss
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("PRAGMA busy_timeout=30000")
    return c


def init():
    import os
    os.makedirs(config.DATA_DIR, exist_ok=True)
    os.makedirs(config.FILES_DIR, exist_ok=True)
    c = connect()
    c.executescript(SCHEMA)
    c.close()


@contextmanager
def tx():
    """BEGIN IMMEDIATE so the ID counter and idempotency check are serialised."""
    c = connect()
    try:
        c.execute("BEGIN IMMEDIATE")
        yield c
        c.execute("COMMIT")
    except BaseException:
        try:
            c.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        c.close()


def next_enquiry_id(c, now=None):
    year = time.gmtime(now or time.time()).tm_year
    c.execute("INSERT INTO counters(year, n) VALUES(?, 0) ON CONFLICT(year) DO NOTHING", (year,))
    c.execute("UPDATE counters SET n = n + 1 WHERE year = ?", (year,))
    n = c.execute("SELECT n FROM counters WHERE year = ?", (year,)).fetchone()[0]
    return f"RVX-{year}-{n:04d}"
