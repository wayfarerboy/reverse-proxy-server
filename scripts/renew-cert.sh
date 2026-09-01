#!/usr/bin/env bash
# Renew Let's Encrypt certs and reload the proxy.
#
# IMPORTANT: run WITHOUT sudo, as alpagan. certbot config lives under the
# homebrew prefix (/opt/homebrew/etc/certbot) and is owned by alpagan. Running
# with `sudo` makes certbot write root-owned 0600 privkeys + a root-owned log,
# which the pm2 proxy (runs as alpagan) cannot read -> EACCES crash-loop.
#   /Users/alpagan/Documents/reverse-proxy-server/scripts/renew-cert.sh
set -euo pipefail

CERTBOT=/opt/homebrew/bin/certbot
PM2=/Users/alpagan/Library/pnpm/bin/pm2
HOST=home.generamics.co.uk
PORT=443
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "== [$STAMP] certbot renew =="
# --deploy-hook fires only when a cert actually renewed; --disable-hook-validation
# means a broken hook can never block renewal (the failure that let the cert expire).
"$CERTBOT" renew \
  --deploy-hook "'$PM2' restart all" \
  --disable-hook-validation

echo
echo "== Reloading reverse-proxy 'server' process =="
# Reload regardless, so the proxy picks up any renewed cert even if no hook ran.
"$PM2" restart server || true

echo
echo "== Verifying served cert dates =="
echo | timeout 15 openssl s_client \
  -connect "$HOST:$PORT" \
  -servername "$HOST" 2>/dev/null \
  | openssl x509 -noout -dates

echo
echo "== Done =="
echo "Check: the 'notAfter' above should be ~90 days in the future, and"
echo "https://$HOST should no longer show a connection-not-private warning."
