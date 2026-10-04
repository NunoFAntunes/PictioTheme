#!/usr/bin/env bash
# Lets only Cloudflare reach ports 80 and 443, so nobody can bypass its proxy by using the VM's IP.
# Run as root by pictiotheme-cloudflare-only.service at boot and weekly (installed by bootstrap.sh).
#
# The rules go in DOCKER-USER: Docker's published ports are forwarded to containers and never pass
# through INPUT. Only NEW connections arriving on the public interface are checked, so the
# containers' own outbound traffic (e.g. to OpenRouter) and its replies are untouched.
# Undo: systemctl disable --now pictiotheme-cloudflare-only.timer, then
#   iptables -D DOCKER-USER -j PICTIO-CF-GATE, and flush (-F) and delete (-X) both PICTIO-CF chains.
set -euo pipefail

# Used when https://www.cloudflare.com/ips-v4 can't be fetched (from 2026-10).
FALLBACK="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"

ranges="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 2> /dev/null | grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$' || true)"
if [[ "$(wc -l <<< "$ranges")" -lt 10 ]]; then
  echo "cloudflare-only: couldn't fetch Cloudflare's ranges, using the built-in list"
  ranges="$(tr ' ' '\n' <<< "$FALLBACK")"
fi

iface="$(ip -4 route show default | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }')"
[[ -n "$iface" ]] || { echo "cloudflare-only: no default route" >&2; exit 1; }

# PICTIO-CF: RETURN (allow) for Cloudflare, DROP for everyone else. Rebuilt on every run.
iptables -N PICTIO-CF 2> /dev/null || true
iptables -F PICTIO-CF
while read -r cidr; do
  iptables -A PICTIO-CF -s "$cidr" -j RETURN
done <<< "$ranges"
iptables -A PICTIO-CF -j DROP

# PICTIO-CF-GATE: picks the traffic to check (new web connections from outside).
iptables -N PICTIO-CF-GATE 2> /dev/null || true
iptables -F PICTIO-CF-GATE
iptables -A PICTIO-CF-GATE -i "$iface" -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j PICTIO-CF
iptables -A PICTIO-CF-GATE -i "$iface" -p udp --dport 443 -m conntrack --ctstate NEW -j PICTIO-CF

iptables -N DOCKER-USER 2> /dev/null || true
iptables -C DOCKER-USER -j PICTIO-CF-GATE 2> /dev/null || iptables -I DOCKER-USER 1 -j PICTIO-CF-GATE

echo "cloudflare-only: $(wc -l <<< "$ranges") Cloudflare ranges allowed on ${iface}"
