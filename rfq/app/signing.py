import hashlib
import hmac
import time

from . import config


def _mac(file_id, exp):
    return hmac.new(config.SIGNING_KEY.encode(), f"{file_id}.{exp}".encode(), hashlib.sha256).hexdigest()


def sign_path(file_id, ttl=None, now=None):
    exp = int((now or time.time()) + (ttl or config.LINK_TTL_SECONDS))
    return f"/api/rfq/files/{file_id}?e={exp}&s={_mac(file_id, exp)}"


def sign_url(file_id, ttl=None):
    return config.PUBLIC_BASE_URL.rstrip("/") + sign_path(file_id, ttl)


def verify(file_id, exp, sig, now=None):
    try:
        exp = int(exp)
    except (TypeError, ValueError):
        return False
    if not config.SIGNING_KEY or exp < (now or time.time()):
        return False
    return hmac.compare_digest(_mac(file_id, exp), sig or "")
