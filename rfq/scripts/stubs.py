"""Local stand-ins for Resend, Telegram, Notion, Turnstile and clamd, used by acceptance.py."""
import json
import socketserver
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE = {"notion_down": False, "resend": [], "telegram": [], "notion": {}, "turnstile_bad": "bad-token"}
LOCK = threading.Lock()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n)
        p = self.path
        with LOCK:
            if p == "/emails":
                j = json.loads(body)
                STATE["resend"].append({"to": j["to"][0], "subject": j["subject"], "idem": self.headers.get("Idempotency-Key")})
                return self._send(200, {"id": "re_%d" % len(STATE["resend"])})
            if p.startswith("/bot"):
                j = json.loads(body)
                STATE["telegram"].append(j["text"])
                return self._send(200, {"ok": True, "result": {"message_id": 1000 + len(STATE["telegram"])}})
            if p.startswith("/v1/databases/") and p.endswith("/query"):
                if STATE["notion_down"]:
                    return self._send(503, {"message": "outage"})
                t = json.loads(body)["filter"]["title"]["equals"]
                return self._send(200, {"results": [{"id": STATE["notion"][t]}] if t in STATE["notion"] else []})
            if p == "/v1/pages":
                if STATE["notion_down"]:
                    return self._send(503, {"message": "outage"})
                j = json.loads(body)
                t = j["properties"]["Enquiry ID"]["title"][0]["text"]["content"]
                STATE["notion"][t] = "page-%s" % t
                return self._send(200, {"id": STATE["notion"][t]})
            if p == "/turnstile":
                ok = STATE["turnstile_bad"].encode() not in body
                return self._send(200, {"success": ok})
        self._send(404, {})


class Clam(socketserver.StreamRequestHandler):
    def handle(self):
        if self.rfile.read(10) != b"zINSTREAM\0":
            return
        data = b""
        while True:
            n = struct.unpack("!I", self.rfile.read(4))[0]
            if n == 0:
                break
            data += self.rfile.read(n)
        if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in data:
            self.wfile.write(b"stream: Win.Test.EICAR_HDB-1 FOUND\0")
        else:
            self.wfile.write(b"stream: OK\0")


def start(http_port, clam_port):
    srv = ThreadingHTTPServer(("127.0.0.1", http_port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    class S(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
    cs = S(("127.0.0.1", clam_port), Clam)
    threading.Thread(target=cs.serve_forever, daemon=True).start()
    return srv, cs
