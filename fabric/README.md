# MediChain Hyperledger Fabric Integration

This directory contains the production-grade Hyperledger Fabric implementation for MediChain.

## Technological Reality & Honest Labeling
- **Real Fabric Smart Contract:** Implemented in TypeScript under [`chaincode-medical/`](./chaincode-medical/) extending `fabric-contract-api`. It implements all medical record anchoring, Merkle proof calculation, patient consent evaluation, and tamper-evident audit logging.
- **Fabric Adapter:** [`interop/adapters/FabricAdapter.ts`](../interop/adapters/FabricAdapter.ts) integrates with `@hyperledger/fabric-gateway` and gRPC to invoke chaincode on Fabric peer nodes.
- **Local Host Docker Limitation:** If Docker / Docker Desktop is not running on the local host machine, Network C runs seamlessly via our **Fabric-style Permissioned Ledger (Simulated)** on port `9000`. It is truthfully labelled as `"Fabric-style permissioned ledger (simulated)"` across all UI screens, logs, and documentation to maintain strict academic honesty.

## Structure
- `chaincode-medical/`: Complete TypeScript chaincode (`MedicalContract.ts`, `package.json`, `tsconfig.json`).
- `scripts/start-network.sh`: Boots the official Hyperledger Fabric v2.5 test-network (with Org1 and Org2).
- `scripts/deploy-chaincode.sh`: Packages and commits the TypeScript chaincode to `mychannel`.
- `scripts/stop-network.sh`: Stops all Fabric Docker containers and cleans up.

## Running Real Fabric (When Docker is installed)
```bash
# 1. Start Fabric network
./fabric/scripts/start-network.sh

# 2. Deploy medical chaincode
./fabric/scripts/deploy-chaincode.sh

# 3. Stop network when done
./fabric/scripts/stop-network.sh
```
