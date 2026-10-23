#!/usr/bin/env bash
# ==============================================================================
# MediChain - Deploy Medical Chaincode to Fabric Test Network
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
CHAINCODE_PATH="${FABRIC_DIR}/chaincode-medical"
FABRIC_SAMPLES_DIR="${FABRIC_DIR}/fabric-samples"

if [ ! -d "${FABRIC_SAMPLES_DIR}/test-network" ]; then
    echo "ERROR: Fabric test network not found. Run start-network.sh first."
    exit 1
fi

cd "${CHAINCODE_PATH}"
echo "=== [MediChain] Building Chaincode TypeScript ==="
npm install
npm run build

cd "${FABRIC_SAMPLES_DIR}/test-network"
echo "=== [MediChain] Deploying Chaincode 'medical' to 'mychannel' ==="
./network.sh deployCC -ccn medical -ccp "${CHAINCODE_PATH}" -ccl typescript -ccep "AND('Org1MSP.peer','Org2MSP.peer')"

echo "=== [MediChain] Chaincode deployed successfully ==="
