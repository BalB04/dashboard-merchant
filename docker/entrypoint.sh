#!/bin/sh
set -eu

read_secret() {
  secret_name="$1"
  file="/run/secrets/$secret_name"

  if [ -f "$file" ]; then
    cat "$file"
    return 0
  fi

  return 1
}

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(read_secret database_url || true)"
  export DATABASE_URL
fi

if [ -z "${AUTH_SESSION_SECRET:-}" ]; then
  AUTH_SESSION_SECRET="$(read_secret auth_session_secret || true)"
  export AUTH_SESSION_SECRET
fi

if [ -z "${ADMIN_ASSET_SHARED_SECRET:-}" ]; then
  ADMIN_ASSET_SHARED_SECRET="$(read_secret admin_asset_shared_secret || true)"
  export ADMIN_ASSET_SHARED_SECRET
fi

exec "$@"
