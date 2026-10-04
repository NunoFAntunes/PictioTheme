#!/usr/bin/env bash
# Nightly database backup, run by cron (installed by bootstrap.sh). Keeps 14 days on the VM.
# If R2_* is set in .env, also uploads to Cloudflare R2: daily/ kept 14 days, weekly/ (Sundays) 8 weeks.
set -euo pipefail
cd "$(dirname "$0")"

# Read only the R2 settings (.env is in Compose format, not always valid shell).
env_value() { sed -n "s/^$1=//p" .env | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/'; }
R2_ACCOUNT_ID="$(env_value R2_ACCOUNT_ID)"
R2_ACCESS_KEY_ID="$(env_value R2_ACCESS_KEY_ID)"
R2_SECRET_ACCESS_KEY="$(env_value R2_SECRET_ACCESS_KEY)"
R2_BUCKET="$(env_value R2_BUCKET)"

mkdir -p backups
file="pictiotheme-$(date -u +%Y-%m-%dT%H%MZ).dump"
docker compose exec -T postgres pg_dump -U pictio -d pictiotheme --format=custom > "backups/${file}.part"
mv "backups/${file}.part" "backups/${file}"
find backups -name '*.dump' -mtime +14 -delete
echo "backup: backups/${file} ($(du -h "backups/${file}" | cut -f1))"

if [[ -z "${R2_BUCKET:-}" ]]; then
  echo "backup: R2_BUCKET not set, skipping upload"
  exit 0
fi

rclone() {
  docker run --rm -v "$PWD/backups:/backups:ro" \
    -e RCLONE_CONFIG_R2_TYPE=s3 \
    -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID:?}.r2.cloudflarestorage.com" \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:?}" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:?}" \
    -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
    rclone/rclone:1 "$@"
}

rclone copyto "/backups/${file}" "r2:${R2_BUCKET}/daily/${file}"
rclone delete --min-age 15d "r2:${R2_BUCKET}/daily"
if [[ "$(date -u +%u)" == 7 ]]; then
  rclone copyto "/backups/${file}" "r2:${R2_BUCKET}/weekly/${file}"
  rclone delete --min-age 57d "r2:${R2_BUCKET}/weekly"
fi
echo "backup: uploaded to r2:${R2_BUCKET}"
