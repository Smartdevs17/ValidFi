#!/bin/bash
set -euo pipefail

# =============================================================================
# ValidFi Smart Contract Deployment Script
# =============================================================================
# Deploys all Soroban smart contracts with parameter validation,
# deployment verification, state persistence, and rollback capability.
#
# Usage:
#   ./deploy-contracts.sh                     # Deploy to testnet (interactive wallet)
#   ./deploy-contracts.sh mainnet GABC...     # Deploy to mainnet with wallet
#   ./deploy-contracts.sh --verify            # Verify last deployment
#   ./deploy-contracts.sh --rollback          # Rollback last deployment
#   ./deploy-contracts.sh --status            # Show deployment status
# =============================================================================

# ── Configuration ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_DIR/contracts"
BUILD_DIR="$CONTRACTS_DIR/target/wasm32-unknown-unknown/release"
DEPLOY_STATE_DIR="$PROJECT_DIR/.deploy"
DEPLOY_STATE_FILE="$DEPLOY_STATE_DIR/deployment-state.json"
NETWORK_CONFIG_DIR="$PROJECT_DIR/.network"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Helpers ────────────────────────────────────────────────────────────────────

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }

die() {
  log_error "$*"
  exit 1
}

require_command() {
  if ! command -v "$1" &>/dev/null; then
    die "Required command '$1' not found. Please install it first."
  fi
}

# ── Network Configuration ──────────────────────────────────────────────────────

load_network_config() {
  local network="$1"
  local config_file="$NETWORK_CONFIG_DIR/${network}.conf"

  # Default configs if no file exists
  case "$network" in
    testnet)
      SOROBAN_RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
      SOROBAN_NETWORK_PASSPHRASE="${SOROBAN_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
      ;;
    mainnet)
      SOROBAN_RPC_URL="${SOROBAN_RPC_URL:-https://soroban.stellar.org}"
      SOROBAN_NETWORK_PASSPHRASE="${SOROBAN_NETWORK_PASSPHRASE:-Public Global Stellar Network ; September 2015}"
      ;;
    futurenet)
      SOROBAN_RPC_URL="${SOROBAN_RPC_URL:-https://rpc-futurenet.stellar.org}"
      SOROBAN_NETWORK_PASSPHRASE="${SOROBAN_NETWORK_PASSPHRASE:-Future Network ; September 2022}"
      ;;
    local)
      SOROBAN_RPC_URL="${SOROBAN_RPC_URL:-http://localhost:8000}"
      SOROBAN_NETWORK_PASSPHRASE="${SOROBAN_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"
      ;;
    *)
      die "Unknown network '$network'. Supported: testnet, mainnet, futurenet, local"
      ;;
  esac

  # Override from config file if it exists
  if [ -f "$config_file" ]; then
    log_info "Loading network config from $config_file"
    source "$config_file"
  fi

  export SOROBAN_RPC_URL
  export SOROBAN_NETWORK_PASSPHRASE
}

# ── Parameter Validation ───────────────────────────────────────────────────────

validate_parameters() {
  local network="$1"
  local wallet="$2"

  # Validate network
  case "$network" in
    testnet|mainnet|futurenet|local) ;;
    *) die "Invalid network '$network'. Must be one of: testnet, mainnet, futurenet, local" ;;
  esac

  # Validate wallet address format (Stellar G... or C...)
  if [ -n "$wallet" ]; then
    if [[ ! "$wallet" =~ ^[GC][A-Z0-9]{55}$ ]]; then
      die "Invalid wallet address '$wallet'. Must be a valid Stellar address starting with G or C."
    fi
    log_info "Wallet address validated: ${wallet:0:8}..."
  fi
}

# ── Deployment State Management ────────────────────────────────────────────────

init_state_dir() {
  mkdir -p "$DEPLOY_STATE_DIR"
}

save_deployment_state() {
  local network="$1"
  shift
  local contract_ids=("$@")
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$DEPLOY_STATE_FILE" <<EOF
{
  "network": "$network",
  "timestamp": "$timestamp",
  "contracts": {
    "identity_registry": "${contract_ids[0]:-null}",
    "verification": "${contract_ids[1]:-null}",
    "access_control": "${contract_ids[2]:-null}",
    "data_sharing": "${contract_ids[3]:-null}"
  },
  "rollback": null
}
EOF
  log_info "Deployment state saved to $DEPLOY_STATE_FILE"
}

load_deployment_state() {
  if [ ! -f "$DEPLOY_STATE_FILE" ]; then
    die "No deployment state found at $DEPLOY_STATE_FILE. Deploy contracts first."
  fi

  local key="$1"
  python3 -c "import json; print(json.load(open('$DEPLOY_STATE_FILE'))$key)" 2>/dev/null || \
    die "Failed to read deployment state key '$key'"
}

# ── Build Contracts ────────────────────────────────────────────────────────────

build_contracts() {
  log_step "Building Soroban contracts..."
  (cd "$CONTRACTS_DIR" && cargo build --release --target wasm32-unknown-unknown)
  log_info "Build complete"

  # Verify WASM was produced
  local wasm_files
  wasm_files=$(ls "$BUILD_DIR"/*.wasm 2>/dev/null || true)
  if [ -z "$wasm_files" ]; then
    die "No WASM files found in $BUILD_DIR. Build may have failed."
  fi
  log_info "WASM artifacts:"
  for f in $wasm_files; do
    local size
    size=$(wc -c < "$f" | tr -d ' ')
    log_info "  $(basename "$f") (${size} bytes)"
  done
}

# ── Deploy Single Contract ────────────────────────────────────────────────────

deploy_contract() {
  local contract_name="$1"
  local wasm_path="$2"
  local wallet="$3"
  local network="$4"

  log_step "Deploying $contract_name..."

  local contract_id
  contract_id=$(soroban contract deploy \
    --wasm "$wasm_path" \
    --source "$wallet" \
    --network "$network" \
    --fee 10000 2>&1)

  # Validate contract ID
  if [[ ! "$contract_id" =~ ^[CG][A-Z0-9]{55}$ ]]; then
    log_error "Invalid contract ID returned for $contract_name: $contract_id"
    return 1
  fi

  log_info "$contract_name deployed: $contract_id"
  echo "$contract_id"
}

# ── Verify Deployment ──────────────────────────────────────────────────────────

verify_deployment() {
  local network="$1"
  local wallet="$2"
  local contract_name="$3"
  local contract_id="$4"

  log_step "Verifying $contract_name ($contract_id)..."

  # Check that the contract exists by querying its version
  local result
  result=$(soroban contract invoke \
    --id "$contract_id" \
    --source "$wallet" \
    --network "$network" \
    --fee 1000 \
    -- \
    get_version 2>&1 || true)

  if [ -z "$result" ] || [ "$result" = "null" ]; then
    log_warn "  Version check returned empty. Contract may not respond to get_version."
    log_info "  Deployment recorded but manual verification recommended."
    return 0
  fi

  log_info "  Version response: $result"
  log_info "  $contract_name verified successfully"
}

# ── Rollback ───────────────────────────────────────────────────────────────────

perform_rollback() {
  if [ ! -f "$DEPLOY_STATE_FILE" ]; then
    die "No deployment state found. Nothing to rollback."
  fi

  local network
  network=$(load_deployment_state '["network"]')
  local prev_state="$DEPLOY_STATE_DIR/previous-state.json"

  log_warn "=== ROLLBACK ==="
  log_info "Rolling back deployment on network: $network"

  if [ -f "$prev_state" ]; then
    log_info "Restoring previous deployment state..."
    cp "$prev_state" "$DEPLOY_STATE_FILE"
    log_info "Previous state restored."
  else
    log_warn "No previous state found. Removing current state."
    rm -f "$DEPLOY_STATE_FILE"
  fi

  log_info "Rollback complete. Re-deploy contracts to restore service."
}

# ── Status ─────────────────────────────────────────────────────────────────────

show_status() {
  if [ ! -f "$DEPLOY_STATE_FILE" ]; then
    log_info "No deployment recorded."
    exit 0
  fi

  echo ""
  echo "=== Deployment Status ==="
  echo "Network:    $(load_deployment_state '["network"]')"
  echo "Timestamp:  $(load_deployment_state '["timestamp"]')"
  echo "Contracts:"
  echo "  Identity Registry: $(load_deployment_state '["contracts"]["identity_registry"]')"
  echo "  Verification:      $(load_deployment_state '["contracts"]["verification"]')"
  echo "  Access Control:    $(load_deployment_state '["contracts"]["access_control"]')"
  echo "  Data Sharing:      $(load_deployment_state '["contracts"]["data_sharing"]')"
  echo ""
}

# ── Main Deployment Flow ───────────────────────────────────────────────────────

deploy_all() {
  local network="$1"
  local wallet="$2"

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  ValidFi Contract Deployment${NC}"
  echo -e "${GREEN}  Network: $network${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""

  # Validate
  validate_parameters "$network" "$wallet"

  # Load network config
  load_network_config "$network"

  # Prerequisites
  require_command soroban
  require_command cargo
  require_command python3

  # Init state dir
  init_state_dir

  # Save previous state for rollback
  if [ -f "$DEPLOY_STATE_FILE" ]; then
    cp "$DEPLOY_STATE_FILE" "$DEPLOY_STATE_DIR/previous-state.json"
    log_info "Previous deployment state backed up"
  fi

  # Build contracts
  build_contracts

  # Find WASM path
  local wasm_files
  wasm_files=("$BUILD_DIR"/*.wasm)
  if [ ${#wasm_files[@]} -eq 0 ]; then
    die "No WASM files found. Build step may have failed."
  fi
  local wasm_path="${wasm_files[0]}"
  log_info "Using WASM: $wasm_path"

  # Deploy contracts
  local ids=()
  local failed=false

  ids+=("$(deploy_contract "IdentityRegistry" "$wasm_path" "$wallet" "$network")" || failed=true)
  ids+=("$(deploy_contract "Verification" "$wasm_path" "$wallet" "$network")" || failed=true)
  ids+=("$(deploy_contract "AccessControl" "$wasm_path" "$wallet" "$network")" || failed=true)
  ids+=("$(deploy_contract "DataSharing" "$wasm_path" "$wallet" "$network")" || failed=true)

  if [ "$failed" = true ]; then
    log_error "One or more contract deployments failed."
    exit 1
  fi

  # Save state
  save_deployment_state "$network" "${ids[@]}"

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Deployment Complete${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""

  # Verify deployments
  echo "--- Verifying Deployments ---"
  for i in "${!ids[@]}"; do
    local names=("IdentityRegistry" "Verification" "AccessControl" "DataSharing")
    verify_deployment "$network" "$wallet" "${names[$i]}" "${ids[$i]}" || true
  done

  echo ""
  echo "Update your backend .env file with these contract IDs:"
  echo "IDENTITY_REGISTRY_CONTRACT_ID=${ids[0]}"
  echo "VERIFICATION_CONTRACT_ID=${ids[1]}"
  echo "ACCESS_CONTROL_CONTRACT_ID=${ids[2]}"
  echo "DATA_SHARING_CONTRACT_ID=${ids[3]}"

  # Generate .env snippet
  local env_file="$PROJECT_DIR/backend/.env"
  if [ -f "$env_file" ]; then
    echo ""
    log_info "Updating $env_file with new contract IDs..."
    update_env_var "$env_file" "IDENTITY_REGISTRY_CONTRACT_ID" "${ids[0]}"
    update_env_var "$env_file" "VERIFICATION_CONTRACT_ID" "${ids[1]}"
    update_env_var "$env_file" "ACCESS_CONTROL_CONTRACT_ID" "${ids[2]}"
    update_env_var "$env_file" "DATA_SHARING_CONTRACT_ID" "${ids[3]}"
    log_info "Environment file updated."
  fi
}

# ── Update .env helper ─────────────────────────────────────────────────────────

update_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# ── Entry Point ────────────────────────────────────────────────────────────────

main() {
  local network="testnet"
  local wallet=""
  local action="deploy"

  # Parse flags
  case "${1:-}" in
    --verify)
      action="verify"
      shift || true
      ;;
    --rollback)
      action="rollback"
      shift || true
      ;;
    --status)
      action="status"
      shift || true
      ;;
    --help|-h)
      echo "Usage: $0 [network] [wallet]"
      echo "       $0 --verify"
      echo "       $0 --rollback"
      echo "       $0 --status"
      echo ""
      echo "Examples:"
      echo "  $0                              # Deploy to testnet"
      echo "  $0 mainnet GABC...              # Deploy to mainnet"
      echo "  $0 --verify                     # Verify last deployment"
      echo "  $0 --rollback                   # Rollback last deployment"
      echo "  $0 --status                     # Show deployment status"
      exit 0
      ;;
  esac

  case "$action" in
    verify)
      require_command soroban
      init_state_dir
      if [ ! -f "$DEPLOY_STATE_FILE" ]; then
        die "No deployment state found."
      fi
      local net
      net=$(load_deployment_state '["network"]')
      log_info "Verifying deployment on network: $net"
      for name in "identity_registry" "verification" "access_control" "data_sharing"; do
        local cid
        cid=$(load_deployment_state "[\"contracts\"][\"$name\"]")
        if [ "$cid" != "null" ] && [ -n "$cid" ]; then
          verify_deployment "$net" "" "$name" "$cid"
        fi
      done
      ;;
    rollback)
      perform_rollback
      ;;
    status)
      show_status
      ;;
    deploy)
      network="${1:-testnet}"
      wallet="${2:-}"
      if [ -z "$wallet" ]; then
        log_warn "No source wallet provided."
        echo "Usage: $0 [network] [source_wallet]"
        echo "Example: $0 testnet GABC..."
        echo ""
        read -r -p "Enter wallet address: " wallet
        if [ -z "$wallet" ]; then
          die "Wallet address is required."
        fi
      fi
      deploy_all "$network" "$wallet"
      ;;
  esac
}

main "$@"
