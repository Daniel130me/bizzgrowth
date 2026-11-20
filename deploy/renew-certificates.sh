#!/bin/sh
set -eu

deployment_dir=${1:?Usage: renew-certificates.sh DEPLOYMENT_PATH}
compose_file="$deployment_dir/compose.production.yaml"

if [ ! -f "$compose_file" ]; then
  echo "Compose file not found: $compose_file" >&2
  exit 1
fi

cd "$deployment_dir"
docker compose --env-file .env.production -f "$compose_file" --profile maintenance run --rm certbot \
  renew --webroot --webroot-path /var/www/certbot --quiet
docker compose --env-file .env.production -f "$compose_file" exec -T nginx nginx -s reload
