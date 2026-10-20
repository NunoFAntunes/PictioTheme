# The web image: Caddy serving the static sites (apps/web/dist and Doodle Tower's apps/tower-web/dist,
# built by CI) and proxying the API.
# Build context: the repo root (see .dockerignore).
FROM caddy:2

COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY apps/web/dist /srv
COPY apps/tower-web/dist /srv/tower
