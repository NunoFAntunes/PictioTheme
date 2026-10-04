# The web image: Caddy serving the static site (apps/web/dist, built by CI) and proxying the API.
# Build context: the repo root (see .dockerignore).
FROM caddy:2

COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY apps/web/dist /srv
