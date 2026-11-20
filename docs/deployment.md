# Production deployment on one DigitalOcean Droplet

This deployment runs the Next.js standalone server behind Nginx on a single
Docker host. Neon remains the PostgreSQL provider. GitHub Actions validates the
application, publishes an immutable image to GHCR, and deploys that image over
host-key-verified SSH.

No DigitalOcean resource is created by this repository. Create and harden the
Droplet separately, then follow this guide.

## 1. Prepare the host

The current target is a Basic Droplet with 1 regular vCPU, 512 MB RAM, 10 GB
disk, and 500 GB transfer. Use a supported Ubuntu LTS release. Install Docker Engine and the Compose
plugin from Docker's official repository. Create a dedicated, non-root deploy
user that can run Docker, disable password SSH login, and allow only ports 22,
80, and 443 through both UFW and the DigitalOcean firewall. Point the domain's
A/AAAA records at the Droplet before requesting a certificate.

Because 512 MB leaves little room for transient work, add a 1 GB swap file
before starting Docker. Swap is a safety net for short spikes, not a substitute
for RAM; sustained swapping means the Droplet should be resized.

```sh
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -qF '/swapfile none swap sw 0 0' /etc/fstab || \
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Create the deployment directory and production environment file:

```sh
sudo install -d -m 0750 -o deploy -g deploy /opt/bizzgrowth
cd /opt/bizzgrowth
cp .env.example .env.production
chmod 600 .env.production
```

Fill every required value in `.env.production`. Keep
`AUTH_COOKIE_INSECURE` unset. Generate `CONNECTIONS_ENCRYPTION_KEY` once and
back it up securely; rotating it without re-encrypting connector tokens makes
those tokens unreadable.

## 2. Bootstrap HTTPS once

The Nginx container intentionally refuses to start without a valid certificate.
With ports 80/443 free and DNS already resolving, create the named certificate
volume and request the first certificate (replace the placeholders):

```sh
docker volume create bizzgrowth_letsencrypt
docker run --rm -p 80:80 \
  -v bizzgrowth_letsencrypt:/etc/letsencrypt \
  certbot/certbot:v5.1.0 certonly --standalone \
  --agree-tos --no-eff-email --email ops@example.com -d app.example.com
```

The domain passed to Certbot must exactly match `DOMAIN` in `.env.production`.

## 3. Start the stack

For a private GHCR package, authenticate with a fine-grained, read-only package
token. Then start an immutable image tag:

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin
export APP_IMAGE=ghcr.io/owner/repository
export IMAGE_TAG=sha-<full-git-commit>
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up -d --wait
```

Verify `https://app.example.com/api/health` returns `{"status":"alive"}` and
`https://app.example.com/api/health?readiness=1` returns
`{"status":"ready"}`. The container uses the liveness form so frequent checks
do not keep Neon awake. Deployments use the readiness form once; its `SELECT 1`
checks connectivity without reading business data.

The committed resource defaults are specifically sized for this 512 MB plan:
Node receives a 192 MB heap inside a 288 MB app container, while Nginx is capped
at 32 MB. This is appropriate only for low initial traffic and modest
concurrency. Monitor OOM kills, swap use, response latency, and CPU saturation;
resize to at least 1 GB RAM if pressure is sustained.

## 4. Configure GitHub Actions

Create a protected GitHub environment named `production`. Require approval if
the release process needs a manual gate. Add these environment variables:

- `DEPLOY_HOST`: Droplet hostname or IP.
- `DEPLOY_PORT`: SSH port; omit to use 22.
- `DEPLOY_USER`: dedicated deploy user.
- `DEPLOY_PATH`: absolute path, normally `/opt/bizzgrowth`.

Add these environment secrets:

- `DROPLET_SSH_PRIVATE_KEY`: private key for the deploy user.
- `DROPLET_SSH_KNOWN_HOSTS`: trusted `known_hosts` line captured during the
  host's initial trusted setup. Do not populate it with an unverified CI-time
  `ssh-keyscan`.
- `GHCR_USERNAME`: account that can read the package.
- `GHCR_TOKEN`: fine-grained token with read-only package access.

Pull requests run lint and a real Next.js build. A main-branch push publishes
both an immutable `sha-...` tag and `latest`; deployment always uses the
immutable tag. The workflow updates only Compose/Nginx maintenance files and
never overwrites `.env.production` or certificate data. If the new services do
not become healthy, the deployment script restores the previously running
immutable image and leaves the workflow failed for investigation.

## 5. Certificate renewal and operations

Install a root-owned monthly systemd timer or cron entry that passes the image
variables and invokes:

```sh
cd /opt/bizzgrowth
APP_IMAGE=ghcr.io/owner/repository IMAGE_TAG=latest \
  ./deploy/renew-certificates.sh /opt/bizzgrowth
```

Certbot writes the renewed files through the shared volume; Nginx reloads only
after a successful renewal. Use `docker compose logs --since 30m app nginx` for
diagnostics. Pass `--env-file .env.production` to other manual Compose commands
as well. Docker's configured log rotation prevents unbounded disk growth. After
a healthy release, the deploy script removes unused images and layers older
than seven days; the running images are never pruned.

Back up the `bizzgrowth_letsencrypt`, `bizzgrowth_chat_fallback_data`, and
`bizzgrowth_ai_gateway_data` volumes. Neon backups remain managed separately.
The Next.js cache volume is disposable.

## Database changes

Do **not** run `prisma db push`, `prisma migrate deploy`, or the existing
`db:push` script against production. This repository's Prisma schema is a
partial view of an existing Neon database, so automatic schema reconciliation
could remove unmodelled tables. Review and apply additive files under
`prisma/sql/` using `DATABASE_URL_UNPOOLED`, then verify them independently.

This manual, additive SQL process is a non-standard implementation and is the
main operational exception in this deployment. It is preserved deliberately
until the full production schema is represented by migrations.

## Other deliberate exceptions

- Chat persistence normally uses Neon, but database failures fall back to a
  local Docker volume. This single-host fallback is durable across container
  replacement but is not replicated; monitor and back it up.
- AI gateway usage/cooldown state is also a local volume. Losing it does not
  lose business data, but it resets provider cooldown history.
- Certificate renewal is host-scheduled instead of giving a container access
  to the Docker socket. This adds one host timer while avoiding a high-privilege
  socket mount.
- Nginx access logs intentionally omit query strings, which keeps OAuth codes
  and other URL-carried secrets out of container logs.
- The repository's existing `Caddyfile` is not part of this production stack.
