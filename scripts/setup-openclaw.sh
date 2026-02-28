#!/usr/bin/env bash
# =============================================================================
# ClawFin v2 — OpenClaw Setup Script
# Deploys workspace files to ~/.openclaw/ and validates the environment
# Usage: bash scripts/setup-openclaw.sh
# =============================================================================

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OPENCLAW_DIR="$HOME/.openclaw"

# ─── Step 0: Check OpenClaw is installed ──────────────────────────────────────
header "Step 0: Checking OpenClaw installation"

if ! command -v openclaw &>/dev/null; then
  error "OpenClaw is not installed or not in PATH."
  echo ""
  echo "  Install it with:"
  echo "    npm install -g openclaw@latest"
  echo ""
  echo "  Then run: openclaw onboard --install-daemon"
  exit 1
fi

OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
success "OpenClaw found: $OPENCLAW_VERSION"

# ─── Step 1: Load .env ────────────────────────────────────────────────────────
header "Step 1: Loading environment variables"

ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  error ".env file not found at $PROJECT_ROOT/.env"
  echo ""
  echo "  Run: cp .env.example .env"
  echo "  Then fill in your API keys and wallet keys."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a
success "Loaded .env"

# ─── Step 2: Validate required env vars ───────────────────────────────────────
header "Step 2: Validating required environment variables"

REQUIRED_VARS=(
  "OPENROUTER_API_KEY"
  "BUYER_WALLET_KEY"
  "SELLER_DISCOUNTER_WALLET_KEY"
  "SELLER_BUNDLER_WALLET_KEY"
  "CONVOS_GROUP_ID"
  "XMTP_ENV"
)

OPTIONAL_VARS=(
  "COMPOSIO_API_KEY"
  "USER_EMAIL"
  "DEAL_TRACKER_SHEET_ID"
  "VAPI_API_KEY"
  "ELEVENLABS_API_KEY"
  "ELEVENLABS_VOICE_ID"
)

MISSING_REQUIRED=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_REQUIRED+=("$var")
    error "Missing required: $var"
  else
    success "$var is set"
  fi
done

if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
  echo ""
  error "Missing ${#MISSING_REQUIRED[@]} required variable(s). Please fill in .env and try again."
  echo ""
  echo "  Wallet keys: run  npx ts-node scripts/gen-keys.ts"
  echo "  CONVOS_GROUP_ID: run  npm run setup:group  (or get it from the hackathon team)"
  echo "  OPENROUTER_API_KEY: openrouter.ai (redeem promo code for $10 free)"
  exit 1
fi

echo ""
info "Optional integrations:"
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    warn "$var not set (optional — Composio/Vapi/ElevenLabs features disabled)"
  else
    success "$var is set"
  fi
done

# ─── Step 3: Create ~/.openclaw directory ────────────────────────────────────
header "Step 3: Creating ~/.openclaw directory structure"

mkdir -p "$OPENCLAW_DIR"
success "Created $OPENCLAW_DIR"

# ─── Step 4: Deploy workspace files ──────────────────────────────────────────
header "Step 4: Deploying workspace files"

WORKSPACES=(
  "clawbuyer:workspace-clawbuyer"
  "dealdash:workspace-dealdash"
  "bundleking:workspace-bundleking"
)

for entry in "${WORKSPACES[@]}"; do
  SRC_NAME="${entry%%:*}"
  DEST_NAME="${entry##*:}"
  SRC="$PROJECT_ROOT/workspaces/$SRC_NAME"
  DEST="$OPENCLAW_DIR/$DEST_NAME"

  if [ ! -d "$SRC" ]; then
    error "Source workspace not found: $SRC"
    exit 1
  fi

  # Remove old destination if it exists (clean deploy)
  if [ -d "$DEST" ]; then
    rm -rf "$DEST"
    info "Removed old $DEST"
  fi

  cp -r "$SRC" "$DEST"
  success "Deployed $SRC_NAME → $DEST"

  # List what was copied
  find "$DEST" -type f | while read -r f; do
    info "  ✓ ${f#$OPENCLAW_DIR/}"
  done
done

# ─── Step 5: Substitute env vars in openclaw.json ─────────────────────────────
header "Step 5: Building openclaw.json with substituted env vars"

OPENCLAW_JSON_SRC="$PROJECT_ROOT/openclaw.json"
OPENCLAW_JSON_DEST="$OPENCLAW_DIR/openclaw.json"

if [ ! -f "$OPENCLAW_JSON_SRC" ]; then
  error "openclaw.json not found at $OPENCLAW_JSON_SRC"
  exit 1
fi

# Substitute ${VAR} patterns with actual env var values
SUBSTITUTED=$(cat "$OPENCLAW_JSON_SRC")

# Substitute each known var
for var in OPENROUTER_API_KEY CONVOS_GROUP_ID XMTP_ENV \
           BUYER_WALLET_KEY SELLER_DISCOUNTER_WALLET_KEY SELLER_BUNDLER_WALLET_KEY \
           COMPOSIO_API_KEY VAPI_API_KEY ELEVENLABS_API_KEY ELEVENLABS_VOICE_ID; do
  VALUE="${!var:-}"
  # Escape special characters for sed
  ESCAPED_VALUE=$(printf '%s\n' "$VALUE" | sed -e 's/[\/&]/\\&/g')
  SUBSTITUTED=$(echo "$SUBSTITUTED" | sed "s/\${$var}/$ESCAPED_VALUE/g")
done

echo "$SUBSTITUTED" > "$OPENCLAW_JSON_DEST"
success "Written: $OPENCLAW_JSON_DEST"
info "  CONVOS_GROUP_ID: ${CONVOS_GROUP_ID}"
info "  XMTP_ENV: ${XMTP_ENV}"

# ─── Step 6: Validate openclaw config ─────────────────────────────────────────
header "Step 6: Validating OpenClaw config"

if openclaw validate --config "$OPENCLAW_JSON_DEST" 2>/dev/null; then
  success "Config validated successfully"
else
  warn "openclaw validate not available or returned an error — check config manually"
  info "Config written to: $OPENCLAW_JSON_DEST"
fi

# ─── Step 7: Summary ──────────────────────────────────────────────────────────
header "Setup complete!"

echo ""
echo -e "${BOLD}Workspaces deployed:${NC}"
echo "  ~/.openclaw/workspace-clawbuyer/  (ClawBot — buyer orchestrator)"
echo "  ~/.openclaw/workspace-dealdash/   (DealDasher — aggressive discounter)"
echo "  ~/.openclaw/workspace-bundleking/ (BundleKing — value bundler)"
echo ""
echo -e "${BOLD}Config:${NC}"
echo "  ~/.openclaw/openclaw.json"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo "  1. Start the OpenClaw gateway:"
echo "     openclaw gateway --verbose"
echo ""
echo "  2. Open Convos and join the Deal Room group (ID: ${CONVOS_GROUP_ID})"
echo ""
echo "  3. Type in the group to trigger a negotiation:"
echo "     \"Find me the best deal on AirPods Max, budget \$450\""
echo ""
echo -e "${GREEN}ClawFin v2 is ready. Let the negotiation begin. 🏷️${NC}"
