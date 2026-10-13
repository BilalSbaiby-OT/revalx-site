FROM node:22-alpine AS build
WORKDIR /app
ARG TURNSTILE_SITEKEY
ENV TURNSTILE_SITEKEY=$TURNSTILE_SITEKEY
COPY site ./site
RUN node site/build.mjs

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
ENV RFQ_UPSTREAM=http://rfq:8000
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/40-htpasswd.sh /docker-entrypoint.d/40-htpasswd.sh
RUN chmod +x /docker-entrypoint.d/40-htpasswd.sh
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/healthz || exit 1
