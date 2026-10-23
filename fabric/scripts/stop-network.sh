#!/usr/bin/env bash
# ==============================================================================
# MediChain - Stop Fabric Test Network
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
FABRIC_SAMPLES_DIR="${FABRIC_DIR}/fabric-samples"

if [ -d "${FABRIC_SAMPLES_DIR}/test-network" ]; then
    cd "${FABRIC_SAMPLES_DIR}/test-network"
    ./network.sh down
    echo "Fabric network stopped and volumes pruned."
else
    echo "No running Fabric test network directory found."
fi
