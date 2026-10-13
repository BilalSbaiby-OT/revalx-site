import os


def env(name, default=""):
    return os.environ.get(name, default)


DATA_DIR = env("RFQ_DATA_DIR", "/data")
DB_PATH = env("RFQ_DB_PATH", os.path.join(DATA_DIR, "rfq.db"))
FILES_DIR = env("RFQ_FILES_DIR", os.path.join(DATA_DIR, "files"))  # private volume, never mounted in nginx

MAX_FILES = 10
MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_BODY_BYTES = MAX_FILES * MAX_FILE_BYTES + 2 * 1024 * 1024
ALLOWED_EXT = {"pdf", "dwg", "dxf", "step", "stp", "jpg", "jpeg", "png"}

SIGNING_KEY = env("RFQ_SIGNING_KEY")  # required in prod
PUBLIC_BASE_URL = env("RFQ_PUBLIC_BASE_URL", "https://revalx.eu")
LINK_TTL_SECONDS = int(env("RFQ_LINK_TTL_SECONDS", str(7 * 86400)))

RATE_LIMIT_MAX = int(env("RFQ_RATE_LIMIT_MAX", "8"))
RATE_LIMIT_WINDOW = int(env("RFQ_RATE_LIMIT_WINDOW", "600"))

TURNSTILE_SECRET = env("TURNSTILE_SECRET_KEY")
CLAMD_HOST = env("CLAMD_HOST", "clamd")
CLAMD_PORT = int(env("CLAMD_PORT", "3310"))

RESEND_API_KEY = env("RESEND_API_KEY")
MAIL_FROM = env("RFQ_MAIL_FROM", "Revalx <rfq@revalx.eu>")
REVIEWER_EMAIL = env("RFQ_REVIEWER_EMAIL")
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = env("TELEGRAM_CHAT_ID")
NOTION_TOKEN = env("NOTION_TOKEN")
NOTION_DATABASE_ID = env("NOTION_DATABASE_ID")
DEFAULT_OWNER = env("RFQ_DEFAULT_OWNER", "Unassigned")

WORKER_INTERVAL = float(env("RFQ_WORKER_INTERVAL", "5"))
ALERT_AFTER_FAILURES = 3
BACKOFF_BASE = float(env("RFQ_BACKOFF_BASE", "30"))  # 30s, 2m, 8m, 32m ... capped at 6h
BACKOFF_CAP = 6 * 3600

RESEND_API_BASE = env("RESEND_API_BASE", "https://api.resend.com")
TELEGRAM_API_BASE = env("TELEGRAM_API_BASE", "https://api.telegram.org")
NOTION_API_BASE = env("NOTION_API_BASE", "https://api.notion.com")
TURNSTILE_VERIFY_URL = env("TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify")
