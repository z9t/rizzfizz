#!/usr/bin/env bash
# Create (or update) an AI Gateway via the Cloudflare API.
#
# Required env:
#   CF_API_TOKEN     token with "AI Gateway: Edit" permission
#   CF_ACCOUNT_ID    your account id
# Optional env:
#   CF_GATEWAY       gateway slug (default: rizzfizz-gw)
#   CF_CACHE_TTL     default cache TTL in seconds (default: 0, caching off)
#   CF_RATE_LIMIT    per-interval request cap (default: 0, disabled)
#   CF_RATE_INTERVAL rate-limit window in seconds (default: 0)

set -euo pipefail

: "${CF_API_TOKEN:?set CF_API_TOKEN}"
: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}"
GW="${CF_GATEWAY:-rizzfizz-gw}"
CACHE_TTL="${CF_CACHE_TTL:-0}"
RATE_LIMIT="${CF_RATE_LIMIT:-0}"
RATE_INTERVAL="${CF_RATE_INTERVAL:-0}"

curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai-gateway/gateways" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{
    \"id\": \"${GW}\",
    \"cache_ttl\": ${CACHE_TTL},
    \"cache_invalidate_on_update\": true,
    \"collect_logs\": true,
    \"rate_limiting_interval\": ${RATE_INTERVAL},
    \"rate_limiting_limit\": ${RATE_LIMIT},
    \"rate_limiting_technique\": \"fixed\"
  }"
echo
