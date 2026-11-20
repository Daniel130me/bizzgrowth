#!/bin/sh
set -eu

deployment_path=${1:?Usage: deploy-production.sh DEPLOYMENT_PATH}
compose_file="$deployment_path/compose.production.yaml"
env_file="$deployment_path/.env.production"
health_timeout_seconds=${DEPLOY_HEALTH_TIMEOUT_SECONDS:-180}

: "${APP_IMAGE:?APP_IMAGE is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

if [ ! -f "$compose_file" ] || [ ! -f "$env_file" ]; then
  echo "Deployment configuration is incomplete in $deployment_path" >&2
  exit 1
fi

case "$health_timeout_seconds" in
  *[!0-9]* | "" | "0")
    echo "DEPLOY_HEALTH_TIMEOUT_SECONDS must be a positive integer" >&2
    exit 1
    ;;
esac

cd "$deployment_path"
compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

current_container=$(compose ps -q app 2>/dev/null || true)
previous_image=""
if [ -n "$current_container" ]; then
  previous_image=$(docker inspect --format '{{.Config.Image}}' "$current_container" 2>/dev/null || true)
fi

export APP_IMAGE IMAGE_TAG
compose config --quiet
compose pull app

deploy_and_check_readiness() {
  compose up -d --remove-orphans --wait --wait-timeout "$health_timeout_seconds" \
    && compose exec -T app node -e \
      "fetch('http://127.0.0.1:3000/api/health?readiness=1').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
}

if deploy_and_check_readiness; then
  echo "Deployed $APP_IMAGE:$IMAGE_TAG"
  # The host is dedicated to this stack and has a 10 GB disk. Keep the running
  # images and recent rollback candidates, but remove week-old unused layers.
  docker image prune --all --force --filter "until=168h"
  exit 0
fi

failed_image="$APP_IMAGE:$IMAGE_TAG"
if [ -z "$previous_image" ] || [ "$previous_image" = "$failed_image" ]; then
  echo "Deployment failed and no previous image is available for rollback" >&2
  exit 1
fi

APP_IMAGE=${previous_image%:*}
IMAGE_TAG=${previous_image##*:}
export APP_IMAGE IMAGE_TAG
echo "Deployment failed; rolling back to $previous_image" >&2
deploy_and_check_readiness
exit 1
