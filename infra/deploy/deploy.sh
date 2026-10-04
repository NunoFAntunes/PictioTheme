#!/usr/bin/env bash
# Deploys one release on the VM. Run by the Deploy workflow; also the way to roll back by hand:
#   /opt/pictiotheme/deploy.sh <image-tag>     # tags are commit SHAs on the production branch
# Migrations only go forward: rolling back past a migration needs an image that works with it.
set -euo pipefail
cd "$(dirname "$0")"

tag="${1:?usage: deploy.sh <image-tag>}"

# Record the release in .env so plain `docker compose ps|logs|...` works in this directory.
if grep -q '^IMAGE_TAG=' .env; then
  sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=${tag}/" .env && rm .env.bak
else
  echo "IMAGE_TAG=${tag}" >> .env
fi

echo "==> pulling ${tag}"
docker compose pull --quiet server web

echo "==> database"
docker compose up -d --wait postgres

echo "==> migrations"
docker compose run --rm migrate

echo "==> starting"
docker compose up -d --wait --remove-orphans

docker image prune -f > /dev/null
echo "==> deployed ${tag}"
