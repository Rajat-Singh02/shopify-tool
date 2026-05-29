#!/usr/bin/env bash
set -euo pipefail

VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-54.4.1}"
VERCEL_PROJECT_NAME="${VERCEL_PROJECT_NAME:-shopify-tool-live}"
STABLE_QA_URL="${STABLE_QA_URL:-https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app}"
STABLE_QA_ALIAS="${STABLE_QA_ALIAS:-shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app}"
SHOPIFY_PUBLIC_CLIENT_ID="${SHOPIFY_PUBLIC_CLIENT_ID:-507ec4018317a9c292eed04878307f58}"
SHOPIFY_TEST_SHOP="${SHOPIFY_TEST_SHOP:-mvqamy-m1.myshopify.com}"
SHOPIFY_CONFIG_FILE="${SHOPIFY_CONFIG_FILE:-shopify.app.antiquinn.toml}"
SHOPIFY_CONFIG_DEPLOY="${SHOPIFY_CONFIG_DEPLOY:-false}"
SHOPIFY_CONFIG_DEPLOYED="${SHOPIFY_CONFIG_DEPLOYED:-false}"
SHOPIFY_CONFIG_BASE_REF="${SHOPIFY_CONFIG_BASE_REF:-HEAD~1}"

vercel_args=()
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  vercel_args+=(--token "$VERCEL_TOKEN")
fi

vercel() {
  npx --yes "vercel@${VERCEL_CLI_VERSION}" "$@" "${vercel_args[@]}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command node
require_command npm
require_command curl
require_command grep
require_command git

is_truthy() {
  case "${1:-}" in
    1 | true | TRUE | yes | YES | on | ON) return 0 ;;
    *) return 1 ;;
  esac
}

require_line() {
  local file="$1"
  local pattern="$2"
  local message="$3"

  if ! grep -Eq "$pattern" "$file"; then
    echo "$message" >&2
    exit 1
  fi
}

validate_shopify_config_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  echo "Validating Shopify config: $file"
  require_line "$file" "^client_id[[:space:]]*=[[:space:]]*\"${SHOPIFY_PUBLIC_CLIENT_ID}\"" "$file client_id does not match the expected Shopify public client ID."
  require_line "$file" "^application_url[[:space:]]*=[[:space:]]*\"${STABLE_QA_URL}\"" "$file application_url must be ${STABLE_QA_URL}."
  require_line "$file" "^embedded[[:space:]]*=[[:space:]]*true" "$file must set embedded = true."
  require_line "$file" "\"${STABLE_QA_URL}/auth/callback\"" "$file must include the stable /auth/callback redirect URL."
  require_line "$file" "scopes[[:space:]]*=[[:space:]]*\"read_products\"" "$file must keep read_products scope."
  require_line "$file" "uri[[:space:]]*=[[:space:]]*\"/webhooks\"" "$file must keep the /webhooks subscription URI."
}

validate_shopify_configs() {
  validate_shopify_config_file "shopify.app.antiquinn.toml"
  validate_shopify_config_file "shopify.app.toml"
}

detect_shopify_config_changes() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 1
  fi

  if ! git rev-parse --verify "$SHOPIFY_CONFIG_BASE_REF" >/dev/null 2>&1; then
    return 1
  fi

  git diff --name-only "$SHOPIFY_CONFIG_BASE_REF" HEAD -- \
    shopify.app.antiquinn.toml \
    shopify.app.toml \
    extensions \
    | grep -E '^(shopify\.app(\.antiquinn)?\.toml|extensions/)'
}

handle_shopify_config_deploy() {
  validate_shopify_configs

  local changed_files
  changed_files="$(detect_shopify_config_changes || true)"

  if [[ -z "$changed_files" ]]; then
    echo "No Shopify TOML or theme extension changes detected since ${SHOPIFY_CONFIG_BASE_REF}."
    return 0
  fi

  echo "Shopify TOML or theme extension changes detected:"
  printf '%s\n' "$changed_files"

  if is_truthy "$SHOPIFY_CONFIG_DEPLOY"; then
    echo "Deploying Shopify config and theme extension with Shopify CLI"
    npx --yes shopify app deploy --config "$SHOPIFY_CONFIG_FILE"
    return 0
  fi

  if is_truthy "$SHOPIFY_CONFIG_DEPLOYED"; then
    echo "SHOPIFY_CONFIG_DEPLOYED is true; continuing after config-change detection."
    return 0
  fi

  echo "Shopify config/theme extension changes require a Shopify CLI deploy before Vercel aliasing." >&2
  echo "Run one of these after confirming Shopify CLI is logged into the existing app:" >&2
  echo "  npx shopify app deploy --config ${SHOPIFY_CONFIG_FILE}" >&2
  echo "  SHOPIFY_CONFIG_DEPLOYED=true npm run deploy:preview" >&2
  echo "Or let this script run Shopify CLI deploy:" >&2
  echo "  SHOPIFY_CONFIG_DEPLOY=true npm run deploy:preview" >&2
  exit 1
}

if [[ -f ".vercel/project.json" ]]; then
  linked_project="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('.vercel/project.json','utf8')); process.stdout.write(p.projectName || '')")"
  if [[ "$linked_project" != "$VERCEL_PROJECT_NAME" ]]; then
    echo "Wrong local Vercel project link: ${linked_project:-unknown}. Expected ${VERCEL_PROJECT_NAME}." >&2
    echo "Run: mv .vercel .vercel.old && npx vercel link, then choose ${VERCEL_PROJECT_NAME}." >&2
    exit 1
  fi
elif [[ -z "${VERCEL_PROJECT_ID:-}" || -z "${VERCEL_ORG_ID:-}" ]]; then
  echo "No .vercel/project.json found and VERCEL_PROJECT_ID/VERCEL_ORG_ID are not set." >&2
  echo "Local use: run npx vercel link and choose ${VERCEL_PROJECT_NAME}." >&2
  echo "GitHub Actions: set VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID secrets." >&2
  exit 1
fi

export STABLE_QA_URL
export APP_URL="$STABLE_QA_URL"
export SHOPIFY_APP_URL="$STABLE_QA_URL"
export PUBLIC_MEDIA_BASE_URL="${PUBLIC_MEDIA_BASE_URL:-${STABLE_QA_URL}/media}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-$STABLE_QA_URL}"
export SHOPIFY_API_KEY="$SHOPIFY_PUBLIC_CLIENT_ID"
export SHOPIFY_CLIENT_ID="$SHOPIFY_PUBLIC_CLIENT_ID"
export VITE_SHOPIFY_API_KEY="$SHOPIFY_PUBLIC_CLIENT_ID"
export VITE_SHOPIFY_CLIENT_ID="$SHOPIFY_PUBLIC_CLIENT_ID"
export PUBLIC_SHOPIFY_API_KEY="$SHOPIFY_PUBLIC_CLIENT_ID"

echo "Deploying ${VERCEL_PROJECT_NAME} preview to ${STABLE_QA_ALIAS}"
handle_shopify_config_deploy
echo "Cleaning local prebuilt output"
rm -rf .vercel/output apps/shopify-app/dist

echo "Pulling Vercel preview environment"
vercel pull --yes --environment=preview --git-branch main

echo "Building prebuilt Vercel output"
vercel build

echo "Verifying build output"
if ! grep -R "shopify-api-key\" content=\"${SHOPIFY_PUBLIC_CLIENT_ID}\"" .vercel/output apps/shopify-app/dist >/dev/null 2>&1; then
  echo "Build output does not contain the expected Shopify public client ID meta tag." >&2
  exit 1
fi

if ! grep -E "api/admin|api/storefront|widget" .vercel/output/config.json >/dev/null 2>&1; then
  echo "Vercel output config does not include expected admin/storefront/widget routes." >&2
  exit 1
fi

deploy_log="$(mktemp -t vercel-preview-deploy.XXXXXX.log)"
echo "Deploying prebuilt output"
set +e
vercel deploy --prebuilt --target=preview --logs 2>&1 | tee "$deploy_log"
deploy_status=${PIPESTATUS[0]}
set -e

if [[ "$deploy_status" -ne 0 ]]; then
  echo "Vercel deploy failed. Log: $deploy_log" >&2
  exit "$deploy_status"
fi

ready_url="$(grep -Eo "https://${VERCEL_PROJECT_NAME}-[a-z0-9]+-rajat-sahadev-s-projects\\.vercel\\.app" "$deploy_log" | tail -1)"
if [[ -z "$ready_url" ]]; then
  echo "Could not find a Vercel deployment URL in deploy output. Log: $deploy_log" >&2
  exit 1
fi

echo "Inspecting deployment: $ready_url"
inspect_log="$(mktemp -t vercel-preview-inspect.XXXXXX.log)"
vercel inspect "$ready_url" --wait --timeout 180s | tee "$inspect_log"
if ! grep -q "Ready" "$inspect_log"; then
  echo "Deployment is not Ready. Refusing to alias. Inspect log: $inspect_log" >&2
  exit 1
fi

echo "Assigning stable alias"
vercel alias set "$ready_url" "$STABLE_QA_ALIAS"

echo "Verifying stable alias"
alias_log="$(mktemp -t vercel-preview-alias.XXXXXX.log)"
vercel inspect "$STABLE_QA_URL" | tee "$alias_log"
if ! grep -q "Ready" "$alias_log"; then
  echo "Stable alias does not inspect as Ready." >&2
  exit 1
fi

health_status="$(curl -sS -o /tmp/shopify-tool-live-health.json -w "%{http_code}" "${STABLE_QA_URL}/health")"
if [[ "$health_status" != "200" ]]; then
  echo "Health route returned HTTP $health_status." >&2
  exit 1
fi

if ! curl -fsS "$STABLE_QA_URL/" | grep -i "shopify-api-key\\|app-bridge" >/dev/null; then
  echo "Root HTML is missing Shopify App Bridge metadata/script." >&2
  exit 1
fi

admin_status="$(curl -sS -o /tmp/shopify-tool-live-admin-videos.json -w "%{http_code}" "${STABLE_QA_URL}/api/admin/videos")"
case "$admin_status" in
  401|410) ;;
  *)
    echo "Admin videos route returned HTTP $admin_status; expected app-level unauthenticated 401/410." >&2
    exit 1
    ;;
esac

storefront_body="$(curl -sS "${STABLE_QA_URL}/api/storefront/widgets/test?shop=${SHOPIFY_TEST_SHOP}")"
if printf "%s" "$storefront_body" | grep -q '"code"[[:space:]]*:[[:space:]]*"NOT_FOUND"'; then
  echo "Storefront widget route returned Vercel NOT_FOUND instead of app-level JSON." >&2
  exit 1
fi

echo "Deployment complete"
echo "Ready URL: $ready_url"
echo "Stable URL: $STABLE_QA_URL"
