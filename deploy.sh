#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  One-shot Azure Web App deployment for openai-contract-demo
#
# Run this ONCE from your local machine (needs Azure CLI + git):
#   chmod +x deploy.sh && ./deploy.sh
#
# What it does:
#   1. Logs you in to Azure
#   2. Creates a resource group
#   3. Provisions App Service Plan + Web App (Linux / Node 20)
#   4. Creates a service principal + OIDC federated credential for GitHub Actions
#   5. Prints the GitHub secrets to add (copy-paste ready)
#   6. Does the first zip-deploy of the app code
#   7. Prints the live URL
#
# After running once, every push to main/master auto-deploys via GitHub Actions.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configurable variables ────────────────────────────────────────────────────
APP_NAME="${APP_NAME:-openai-contract-$(head -c4 /dev/urandom | xxd -p)}"  # globally unique
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-openai-demo}"
LOCATION="${LOCATION:-eastus}"
SKU="${SKU:-B1}"
GITHUB_REPO="${GITHUB_REPO:-}"   # e.g. "myorg/myrepo"  (auto-detected from git remote if empty)
OPENAI_API_KEY="${OPENAI_API_KEY:-}"   # optional — can set in Azure portal afterward

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
command -v az   >/dev/null 2>&1 || die "Azure CLI not installed. Install from https://aka.ms/installazurecli"
command -v git  >/dev/null 2>&1 || die "git not found"
command -v zip  >/dev/null 2>&1 || die "zip not found"
command -v jq   >/dev/null 2>&1 || { warn "jq not found — some JSON parsing may fail"; }

# Auto-detect GitHub repo from git remote
if [[ -z "$GITHUB_REPO" ]]; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    GITHUB_REPO="${BASH_REMATCH[1]}"
    info "Detected GitHub repo: $GITHUB_REPO"
  fi
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Azure Web App Deployment — openai-contract-demo${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""
echo "  App name       : $APP_NAME"
echo "  Resource group : $RESOURCE_GROUP"
echo "  Location       : $LOCATION"
echo "  SKU            : $SKU"
echo "  GitHub repo    : ${GITHUB_REPO:-<not detected — see step 4>}"
echo ""

# ── Step 1: Azure login ───────────────────────────────────────────────────────
info "Step 1/6 — Azure login"
if ! az account show >/dev/null 2>&1; then
  az login
fi
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
success "Logged in — subscription: $SUBSCRIPTION_ID"

# ── Step 2: Resource group ────────────────────────────────────────────────────
info "Step 2/6 — Creating resource group '$RESOURCE_GROUP' in $LOCATION"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
success "Resource group ready"

# ── Step 3: Provision infrastructure via Bicep ────────────────────────────────
info "Step 3/6 — Deploying infrastructure (App Service Plan + Web App)"
BICEP_PARAMS="appName=$APP_NAME location=$LOCATION sku=$SKU"
if [[ -n "$OPENAI_API_KEY" ]]; then
  BICEP_PARAMS="$BICEP_PARAMS openAiApiKey=$OPENAI_API_KEY"
fi

az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$(dirname "$0")/infra/main.bicep" \
  --parameters $BICEP_PARAMS \
  --output none

APP_URL=$(az webapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostName -o tsv)
success "Web App provisioned: https://$APP_URL"

# ── Step 4: Service principal + OIDC federated credential ─────────────────────
info "Step 4/6 — Creating service principal for GitHub Actions (OIDC)"
SP_NAME="github-${APP_NAME}-deploy"

# Create SP (contributor on the resource group)
SP_JSON=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth 2>/dev/null || true)

# Get the client ID
CLIENT_ID=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || \
            echo "$SP_JSON" | grep -o '"clientId": *"[^"]*"' | cut -d'"' -f4)

if [[ -z "$CLIENT_ID" ]]; then
  warn "Could not determine client ID automatically. Check the Azure portal."
else
  # Add federated credential for main branch
  BRANCH="main"
  git branch -r 2>/dev/null | grep -q "origin/master" && ! git branch -r 2>/dev/null | grep -q "origin/main" && BRANCH="master"

  if [[ -n "$GITHUB_REPO" ]]; then
    az ad app federated-credential create \
      --id "$CLIENT_ID" \
      --parameters "{
        \"name\": \"github-${BRANCH}\",
        \"issuer\": \"https://token.actions.githubusercontent.com\",
        \"subject\": \"repo:${GITHUB_REPO}:ref:refs/heads/${BRANCH}\",
        \"audiences\": [\"api://AzureADTokenExchange\"]
      }" --output none 2>/dev/null || warn "Federated credential may already exist — skipping"
    success "Federated credential created for $GITHUB_REPO (branch: $BRANCH)"
  else
    warn "GitHub repo not detected. Add the federated credential manually (see README)."
  fi
fi

# ── Step 5: Zip deploy (first deployment) ─────────────────────────────────────
info "Step 5/6 — Deploying app code (zip deploy)"
DEPLOY_DIR=$(mktemp -d)
ZIP_FILE="$DEPLOY_DIR/app.zip"

# Build the zip — exclude dev artifacts
zip -r "$ZIP_FILE" . \
  --exclude "*.git*" \
  --exclude "node_modules/*" \
  --exclude "uploads/*" \
  --exclude "data/contracts.json" \
  --exclude ".env" \
  --exclude "deploy.sh" \
  --quiet

# Install prod deps into a temp dir and add them
(cd "$DEPLOY_DIR" && mkdir app && cd app && cp "$ZIP_FILE" . && \
  unzip -q app.zip && rm app.zip && \
  npm ci --omit=dev --quiet && \
  zip -r "$ZIP_FILE" . --quiet)

az webapp deploy \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --src-path "$ZIP_FILE" \
  --type zip \
  --output none

rm -rf "$DEPLOY_DIR"
success "App deployed"

# ── Step 6: Health check ───────────────────────────────────────────────────────
info "Step 6/6 — Waiting for app to come online..."
for i in 1 2 3 4 5 6; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_URL/api/health" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    success "Health check passed"
    break
  fi
  echo "  Attempt $i/6 (HTTP $STATUS) — retrying in 10s..."
  sleep 10
done

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Deployment complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  Live URL      : ${CYAN}https://$APP_URL${NC}"
echo -e "  📋  Contracts     : ${CYAN}https://$APP_URL/contracts.html${NC}"
echo ""
echo -e "${YELLOW}── GitHub Actions secrets (add these in repo Settings → Secrets):${NC}"
echo ""
echo "  AZURE_CLIENT_ID       = $CLIENT_ID"
echo "  AZURE_TENANT_ID       = $TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID"
echo "  AZURE_WEBAPP_NAME     = $APP_NAME"
echo ""
if [[ -z "$OPENAI_API_KEY" ]]; then
  echo -e "${YELLOW}  ⚠  OPENAI_API_KEY not set. Add it in Azure portal:${NC}"
  echo "     portal.azure.com → App Services → $APP_NAME → Configuration → Application settings"
  echo ""
fi
echo "  Once secrets are added, every push to $BRANCH auto-deploys via GitHub Actions."
echo ""
