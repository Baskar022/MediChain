#!/usr/bin/env bash
# ==============================================================================
# MediChain - Hyperledger Fabric Test Network Bootstrap
# Starts Fabric 2.5 test-network with 2 Organizations and a channel
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
FABRIC_SAMPLES_DIR="${FABRIC_DIR}/fabric-samples"

echo "=== [MediChain] Checking Docker Environment ==="
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not running on this host."
    echo "Network C will run via the Simulated Fabric Permissioned Ledger on port 9000."
    exit 1
fi

if [ ! -d "$FABRIC_SAMPLES_DIR" ]; then
    echo "Downloading official fabric-samples..."
    curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
    chmod +x install-fabric.sh
    ./install-fabric.sh --fabric-version 2.5.4 binary docker
    mv fabric-samples "$FABRIC_DIR/"
    rm install-fabric.sh
fi

cd "${FABRIC_SAMPLES_DIR}/test-network"
echo "=== [MediChain] Starting Fabric Test Network & Channel 'mychannel' ==="
./network.sh down
./network.sh up createChannel -c mychannel -ca

echo "=== [MediChain] Fabric Test Network is running ==="
