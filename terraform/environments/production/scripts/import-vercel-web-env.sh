#!/usr/bin/env bash
# Import vercel_project_environment_variable resources for module.web_app[0] after
# vercel_project.this is already imported. Requires jq and curl.
#
# Usage (from this directory: terraform/environments/production):
  #  export VERCEL_TOKEN=''           # same scope as Terraform (team access)
  #  export VERCEL_TEAM_ID=''
  #  export VERCEL_PROJECT_ID=''  # e.g. background-agents-web project id
  #  ./scripts/import-vercel-web-env.sh
#
# If a key is missing in Vercel, that index is skipped; run terraform apply to create it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROD_DIR"

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN (Vercel account token with team access)}"
: "${VERCEL_TEAM_ID:?Set VERCEL_TEAM_ID}"
: "${VERCEL_PROJECT_ID:?Set VERCEL_PROJECT_ID}"

# Order must match web-vercel.tf environment_variables[]
KEYS=(
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  NEXTAUTH_URL
  NEXTAUTH_SECRET
  CONTROL_PLANE_URL
  NEXT_PUBLIC_WS_URL
  INTERNAL_CALLBACK_SECRET
  ALLOWED_USERS
  ALLOWED_EMAIL_DOMAINS
)

JSON="$(curl -sS -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}&decrypt=false")"

if ! echo "$JSON" | jq -e . >/dev/null 2>&1; then
  echo "Invalid JSON from Vercel API. Response:" >&2
  echo "$JSON" >&2
  exit 1
fi

# Pick env id for key: prefer a single Vercel row whose targets are exactly production+preview (sorted).
pick_id() {
  local k="$1"
  echo "$JSON" | jq -r --arg k "$k" '
    (.envs // []) | map(select(.key == $k)) as $rows |
    if ($rows | length) == 0 then empty
    elif ($rows | length) == 1 then $rows[0].id
    else (
      ([ $rows[] | select((.target // []) | sort == ["preview","production"]) ] | .[0]) as $m
      | if $m != null then $m.id else $rows[0].id end
    )
    end
  '
}

for i in "${!KEYS[@]}"; do
  key="${KEYS[$i]}"
  id="$(pick_id "$key" || true)"
  if [[ -z "${id:-}" || "$id" == "null" ]]; then
    echo "skip env[$i] $key — not found in Vercel; terraform apply will create it"
    continue
  fi
  addr="module.web_app[0].vercel_project_environment_variable.env[${i}]"
  import_id="${VERCEL_PROJECT_ID}/${id}"
  echo "terraform import '${addr}' '${import_id}'"
  terraform import "$addr" "$import_id"
done

echo "Done. Run: terraform plan"
