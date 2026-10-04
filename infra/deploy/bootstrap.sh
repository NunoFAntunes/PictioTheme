#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu VM (tested on Oracle Cloud). Safe to re-run.
#   scp infra/deploy/bootstrap.sh ubuntu@<ip>:
#   ssh ubuntu@<ip> 'sudo bash bootstrap.sh <site-address>'    # e.g. 152-70-12-114.sslip.io
# Installs Docker, opens ports 80/443, adds swap on small VMs, creates /opt/pictiotheme with a .env
# of freshly generated secrets, and schedules the nightly backup. See docs/technical/deployment.md.
set -euo pipefail

site="${1:?usage: bootstrap.sh <site-address>}"
app_dir=/opt/pictiotheme
app_user="${SUDO_USER:-ubuntu}"
export DEBIAN_FRONTEND=noninteractive

echo "==> Docker"
if ! command -v docker > /dev/null; then
  apt-get update -q
  apt-get install -yq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Keep container logs from filling the disk.
if [[ ! -f /etc/docker/daemon.json ]]; then
  echo '{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }' > /etc/docker/daemon.json
  systemctl restart docker
fi
usermod -aG docker "$app_user"
systemctl enable --now docker

echo "==> Firewall"
# Oracle's Ubuntu images reject everything but SSH in iptables. Open HTTP, HTTPS and HTTP/3.
# (The VCN security list must allow them too: that's done in the Oracle Cloud console.)
for rule in tcp:80 tcp:443 udp:443; do
  proto="${rule%%:*}"
  port="${rule##*:}"
  if ! iptables -C INPUT -p "$proto" --dport "$port" -m state --state NEW -j ACCEPT 2> /dev/null; then
    reject_line="$(iptables -L INPUT --line-numbers | awk '$2 == "REJECT" { print $1; exit }')"
    iptables -I INPUT "${reject_line:-1}" -p "$proto" --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
if command -v netfilter-persistent > /dev/null; then netfilter-persistent save; fi

echo "==> Swap"
mem_mb="$(free -m | awk '/^Mem:/ { print $2 }')"
if [[ "$(swapon --noheadings | wc -l)" -eq 0 && "$mem_mb" -lt 4096 ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> ${app_dir}"
install -d -o "$app_user" -g "$app_user" "$app_dir" "$app_dir/backups" "$app_dir/certs"
if [[ ! -f "$app_dir/.env" ]]; then
  cat > "$app_dir/.env" << EOF
# Production settings. Secrets live only here: back this file up somewhere safe.
# Any server setting from apps/server/src/config.ts can be added (e.g. DECK_GENERATION=off).
SITE_ADDRESS=${site}
TLS_DIRECTIVE=
POSTGRES_PASSWORD=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
LOG_LEVEL=info
# AI deck generation. Set a monthly spending limit on the key at openrouter.ai.
OPENROUTER_API_KEY=
# Nightly backups to Cloudflare R2 (optional; local backups are kept either way).
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
# Set by deploy.sh.
IMAGE_TAG=
EOF
  chown "$app_user:$app_user" "$app_dir/.env"
  chmod 600 "$app_dir/.env"
fi

echo "==> Backup schedule"
echo "30 3 * * * $app_user $app_dir/backup.sh >> $app_dir/backups/backup.log 2>&1" > /etc/cron.d/pictiotheme-backup
chmod 644 /etc/cron.d/pictiotheme-backup

echo "==> Done. Docker $(docker --version | cut -d' ' -f3 | tr -d ,), $(dpkg --print-architecture), ${mem_mb} MB RAM"
