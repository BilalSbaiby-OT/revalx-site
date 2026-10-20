FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
HEALTHCHECK CMD wget -qO- http://127.0.0.1/healthz || exit 1
