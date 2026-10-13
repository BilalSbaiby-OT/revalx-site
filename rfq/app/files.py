import hashlib
import os
import re
import socket
import struct

from . import config

EICAR_NOTE = "ClamAV flags the EICAR test string; no special casing here."


def sniff(head: bytes):
    """Return detected type from magic bytes, or None."""
    if head.startswith(b"%PDF-"):
        return "pdf"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if re.match(rb"AC10\d\d", head):
        return "dwg"
    if head.startswith(b"AutoCAD Binary DXF"):
        return "dxf"
    text = head[:512].lstrip(b"\xef\xbb\xbf \t\r\n")
    if text.startswith(b"ISO-10303-21;"):
        return "step"
    if re.match(rb"0\s*\r?\n\s*SECTION", text):
        return "dxf"
    return None


EXT_TYPE = {"pdf": "pdf", "dwg": "dwg", "dxf": "dxf", "step": "step", "stp": "step", "jpg": "jpg", "jpeg": "jpg", "png": "png"}


def safe_name(name: str) -> str:
    name = os.path.basename((name or "file").replace("\\", "/"))
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name)[:120].strip(". ") or "file"
    return name


class ClamUnavailable(Exception):
    pass


def clam_scan(path: str):
    """Stream the file to clamd INSTREAM. Returns None when clean, else the signature name."""
    try:
        s = socket.create_connection((config.CLAMD_HOST, config.CLAMD_PORT), timeout=10)
        s.settimeout(120)
        with s:
            s.sendall(b"zINSTREAM\0")
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(64 * 1024)
                    if not chunk:
                        break
                    s.sendall(struct.pack("!I", len(chunk)) + chunk)
            s.sendall(struct.pack("!I", 0))
            resp = b""
            while not resp.endswith(b"\0") and len(resp) < 4096:
                part = s.recv(4096)
                if not part:
                    break
                resp += part
    except (OSError, socket.timeout) as e:
        raise ClamUnavailable(str(e))
    text = resp.rstrip(b"\0").decode("utf-8", "replace").strip()
    if text.endswith("OK"):
        return None
    if text.endswith("FOUND"):
        return text.split(":", 1)[-1].replace("FOUND", "").strip() or "malware"
    raise ClamUnavailable(f"clamd said: {text[:200]}")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
