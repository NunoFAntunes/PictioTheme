# Deployment

How PictioTheme gets to the VM. The topology and why are in [architecture.md](architecture.md#deployment) and decision D5 in [decisions.md](decisions.md).

## How a release happens

**Merge `main` into `production`** (a PR from `main` to `production`, or `git push origin main:production`). Every push to `production` runs [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml):

1. **CI**: the whole CI workflow (checks, unit tests, e2e).
2. **Images**: builds the web site and the server bundle on the runner, then pushes two images to GHCR, both tagged with the commit SHA and built for amd64 + arm64:
   - `ghcr.io/nunofantunes/pictiotheme-server`: the bundle on `node:24-slim` ([infra/server.Dockerfile](../../infra/server.Dockerfile))
   - `ghcr.io/nunofantunes/pictiotheme-web`: Caddy plus `apps/web/dist` ([infra/web.Dockerfile](../../infra/web.Dockerfile), [infra/Caddyfile](../../infra/Caddyfile))
3. **Deploy**: copies [compose.prod.yaml](../../infra/compose.prod.yaml) to the VM as `compose.yaml`, then runs [deploy.sh](../../infra/deploy/deploy.sh) `<sha>` over SSH. It pulls the images, runs migrations and the curated-deck seed as a one-off container, and restarts the server and Caddy. It waits for the healthchecks, then calls `$PUBLIC_URL/api/ready`.

The workflow can also be started by hand (Actions → Deploy → Run workflow). A deploy **ends live games** (accepted for v1), so release at quiet hours.

## On the VM

Everything lives in `/opt/pictiotheme`:

| File | What it is |
|---|---|
| `compose.yaml` | Copied on every deploy. Don't edit it on the VM |
| `.env` | Secrets and settings, created once by `bootstrap.sh`. **Only copy: back it up.** Any server setting from `apps/server/src/config.ts` can go here |
| `deploy.sh`, `backup.sh`, `cloudflare-only.sh` | Copied on every deploy |
| `backups/` | Nightly `pg_dump` files (14 days) and `backup.log` |
| `certs/` | Optional Cloudflare Origin certificate |

Useful commands, run in `/opt/pictiotheme`:

```sh
docker compose ps
docker compose logs -f server
./deploy.sh <older-sha>           # rollback (see the warning below)
docker compose restart server     # after editing .env
./backup.sh                       # backup now
```

**Rollbacks:** migrations only go forward. Rolling back to an image older than the last migration only works if that image still runs against the new schema.

**Restore a backup:** `docker compose exec -T postgres pg_restore -U pictio -d pictiotheme --clean --if-exists < backups/<file>.dump`.

## TLS and domain

**Production today:** `https://pictio.tierney.one`, proxied by Cloudflare (SSL Full (strict)) with a Cloudflare Origin certificate for `*.tierney.one` that expires in 2041. The VM is `152.70.12.114` (Oracle, arm64).

Caddy serves `SITE_ADDRESS` from `.env`:

- **No domain yet:** `152-70-12-114.sslip.io`. sslip.io resolves to the IP inside the name, and Caddy gets a Let's Encrypt certificate automatically.
- **Own domain, DNS only:** point an A record at the VM, set `SITE_ADDRESS=<domain>`. Let's Encrypt again.
- **Own domain behind the Cloudflare proxy (the plan in D5):** SSL mode Full (strict), a Cloudflare Origin certificate saved as `certs/origin.pem` and `certs/origin.key`, and `TLS_DIRECTIVE=tls /certs/origin.pem /certs/origin.key`.

After changing them: `docker compose up -d web server`, and update the `PUBLIC_URL` variable in GitHub. `PUBLIC_ORIGIN` is derived from `SITE_ADDRESS`, and the server rejects writes from any other origin.

Caddy trusts Cloudflare's IP ranges for the client IP and sends it on to the server, which trusts only the private Docker network (`TRUST_PROXY=uniquelocal`). So IP rate limits see real clients (rule F10).

## Only Cloudflare reaches the web ports

So nobody can skip Cloudflare by using the VM's IP, [cloudflare-only.sh](../../infra/deploy/cloudflare-only.sh) lets only [Cloudflare's IPv4 ranges](https://www.cloudflare.com/ips-v4) open connections to ports 80 and 443. The rules live in Docker's `DOCKER-USER` chain, because published container ports never pass through `INPUT`. SSH is unaffected, and so is the containers' outbound traffic.

The `pictiotheme-cloudflare-only` systemd service applies the rules at boot and whenever Docker starts, and a weekly timer refreshes the ranges. There's a built-in fallback list if the fetch fails.

- Check: `sudo iptables -L PICTIO-CF -v -n` (the DROP counter shows blocked attempts).
- Reapply now: `sudo systemctl start pictiotheme-cloudflare-only`.
- To serve without Cloudflare (e.g. back to sslip.io), turn it off first: `sudo systemctl disable --now pictiotheme-cloudflare-only.timer pictiotheme-cloudflare-only.service`, then `sudo iptables -D DOCKER-USER -j PICTIO-CF-GATE`.

## Setting up a new VM

1. In the cloud console, allow inbound TCP 80 and 443 and UDP 443 (Oracle: the subnet's security list or an NSG).
2. Run the bootstrap. It installs Docker, opens the same ports in the VM's iptables, adds swap on small VMs, creates `/opt/pictiotheme/.env` with generated secrets, schedules the 03:30 UTC backup, and installs the Cloudflare-only service (active after the first deploy copies its script):
   ```sh
   scp infra/deploy/bootstrap.sh ubuntu@<ip>:
   ssh ubuntu@<ip> 'sudo bash bootstrap.sh <site-address>'
   ```
3. Create a deploy key pair (`ssh-keygen -t ed25519 -f deploy_key -N '' -C github-deploy`) and append `deploy_key.pub` to `~/.ssh/authorized_keys` on the VM.
4. In GitHub → Settings → Environments, create **`production`** with these secrets and variable:

   | Name | Kind | Value |
   |---|---|---|
   | `DEPLOY_HOST` | secret | the VM's IP |
   | `DEPLOY_USER` | secret | `ubuntu` |
   | `DEPLOY_SSH_KEY` | secret | contents of `deploy_key` (the private key) |
   | `DEPLOY_KNOWN_HOSTS` | secret | output of `ssh-keyscan -t ed25519 <ip>` |
   | `PUBLIC_URL` | variable | `https://<site-address>` (for the smoke test) |

   Under the environment's deployment branches, allow only `production`. Optionally add yourself as a required reviewer to approve each deploy.
5. Protect the `production` branch so it only changes through PRs with passing CI.
6. Push to `production`.

## Backups

`backup.sh` runs nightly. It writes a `pg_dump` (custom format) to `backups/` and keeps 14 days. If `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` are set in `.env`, it also uploads with rclone: `daily/` is kept 15 days and `weekly/` (Sundays) 8 weeks. The R2 token needs Object Read & Write on that bucket only. Practise a restore before launch.
