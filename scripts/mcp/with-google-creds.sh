#!/usr/bin/env bash
# Launches a Google MCP server (Search Console, GA4, SEO audit) with a service account key.
#
# Cloud sessions only get environment variables, not files, so the key can come in two ways:
#   GOOGLE_APPLICATION_CREDENTIALS  path to the service account JSON (local machines)
#   GOOGLE_SERVICE_ACCOUNT_JSON     the JSON itself (cloud environment secret)
# When only the JSON is set, it is written to a private temp file that is removed on exit.
# The key file path is also passed as GSC_CREDENTIALS_PATH for the Search Console server.
set -euo pipefail

if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -n "${GOOGLE_SERVICE_ACCOUNT_JSON:-}" ]]; then
  umask 077
  key_file="$(mktemp "${TMPDIR:-/tmp}/gsa-XXXXXX.json")"
  printf '%s' "$GOOGLE_SERVICE_ACCOUNT_JSON" > "$key_file"
  trap 'rm -f "$key_file"' EXIT
  export GOOGLE_APPLICATION_CREDENTIALS="$key_file"
fi
unset GOOGLE_SERVICE_ACCOUNT_JSON

if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  export GSC_CREDENTIALS_PATH="${GSC_CREDENTIALS_PATH:-$GOOGLE_APPLICATION_CREDENTIALS}"
else
  echo "with-google-creds: no Google key set (GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON); see docs/lead-mcps.md" >&2
fi

# Not exec: the trap has to run after the server exits so the temp key is deleted.
"$@"
