#!/bin/sh
# Builds /etc/nginx/.htpasswd from PREVIEW_USER / PREVIEW_PASS. Refuses to start without them.
set -e
: "${PREVIEW_USER:?PREVIEW_USER not set}"; : "${PREVIEW_PASS:?PREVIEW_PASS not set}"
printf '%s:%s\n' "$PREVIEW_USER" "$(openssl passwd -apr1 "$PREVIEW_PASS")" > /etc/nginx/.htpasswd
chmod 640 /etc/nginx/.htpasswd; chown root:nginx /etc/nginx/.htpasswd
