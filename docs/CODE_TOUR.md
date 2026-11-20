# MediChain: Comprehensive Code Tour & Architectural Walkthrough

This document provides a folder-by-folder guide to the MediChain codebase, details the responsibility of each layer, and traces the exact end-to-end path of a clinical record through the code from browser to blockchain.

---

## 1. Directory Structure Overview

```
BE-Project/
├── contracts/               # Solidity Smart Contracts (EVM Consortium)
│   ├── contracts/           # Core Ethereum contracts (^0.8.24)
│   │   ├── AccessControl.sol        # Role-based access control (Admin, Doctor, Hospital)
│   │   ├── HospitalRegistry.sol     # Sovereign institution registry & status tracking
│   │   ├── RecordRegistry.sol       # Dual-hash commitment & ECDSA attestation ledger
│   │   ├── ConsentManager.sol       # Patient consent grants, expiry & emergency break-glass
│   │   ├── FederationRegistry.sol   # Cross-chain consortium directory & record locator
│   │   └── AuditLog.sol             # Immutable append-only access & verification logs
│   ├── scripts/             # Deployment and multi-chain orchestration scripts
│   │   └── deploy-all.ts    # Deploys independent contract instances to Networks A, B, and Fed
│   ├── test/                # Hardhat unit & integration test suite (32 tests)
│   ├── hardhat.config.ts    # Multi-network EVM RPC configuration (31337, 31338, 31340)
│   └── package.json
│
├── fabric/                  # Hyperledger Fabric Chaincode & Artifacts (Network C)
│   ├── chaincode/           # Smart contract logic in TypeScript
│   │   ├── src/
│   │   │   ├── RecordContract.ts    # registerRecord, getRecordProof, checkConsent, logAudit
│   │   │   └── index.ts             # Chaincode contract exports
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── README.md            # Fabric network deployment instructions & architecture notes
│
├── interop/                 # Cross-Chain Interoperability Engine & Gateways
│   ├── adapters/            # Polymorphic Chain Adapters (implements ChainAdapter interface)
│   │   ├── IChainAdapter.ts         # Unified interface for EVM and Non-EVM ledgers
│   │   ├── EvmAdapter.ts            # Ethers v6 implementation for Networks A, B, and Fed
│   │   ├── FabricAdapter.ts         # Gateway adapter for Network C (@hyperledger/fabric-gateway)
│   │   └── SimulatedLedgerAdapter.ts# Local HTTP REST adapter for simulated Network C ledger
│   ├── core/                # Hub & Messaging Core
│   │   ├── MessageEnvelope.ts       # FHIR-inspired signed message envelope schema
│   │   ├── InteropHub.ts            # Anti-replay router, message validation & delivery queue
│   │   └── HospitalGateway.ts       # ECIES key re-wrapping, inclusion proof verification
│   ├── ledger/              # Network C Permissioned Ledger Service
│   │   ├── LedgerNode.ts            # SHA-256 hash-chained block engine & REST API (Port 9000)
│   │   └── MerkleTree.ts            # Merkle inclusion proof generator & verification logic
│   ├── test/                # Cross-chain test suite (55 automated tests)
│   └── tsconfig.json
│
├── web/                     # Full-Stack Next.js 14 Web3 Application
│   ├── src/
│   │   ├── app/             # Next.js App Router (Pages, Layouts, Server API routes)
│   │   │   ├── layout.tsx           # Root HTML layout with Web3Provider & typography
│   │   │   ├── page.tsx             # Editorial asymmetrical landing page & SVG diagram
│   │   │   ├── globals.css          # Custom CSS tokens, Google fonts, print styles
│   │   │   ├── dashboard/           # Consortium dashboard & telemetry overview
│   │   │   ├── verify/              # Public cryptographic verifier & proof panel
│   │   │   ├── doctor/              # Clinical operations (upload, directory, emergency)
│   │   │   ├── patient/             # Patient sovereign portal (records, consents, register)
│   │   │   ├── admin/               # Consortium admin (federation, hospitals, inspector)
│   │   │   ├── explorer/            # Multi-chain block and ledger explorer
│   │   │   └── api/                 # Serverless zero-PHI backend REST routes
│   │   │       ├── records/upload   # Enforces 25 MB limit, writes storage/*.enc, indexes SQLite
│   │   │       ├── records/verify   # Multi-chain verification API (checks on-chain & storage)
│   │   │       ├── transfers        # State machine transition engine (Requested -> Available)
│   │   │       ├── federation/      # Institution onboarding & key rotation
│   │   │       ├── patients/        # Sovereign patient registration & wallet creation
│   │   │       └── admin/inspector  # Read-only database table & file inspector
│   │   ├── components/      # React UI components
│   │   │   ├── layout/              # AppShell, Header (breadcrumbs, network switcher), Sidebar
│   │   │   └── ui/                  # BrandLogo, DataTable, CommandPalette, VerificationCertificate
│   │   ├── context/         # Web3Context.tsx (MetaMask connection, SIWE, active network)
│   │   ├── config/          # project-info.ts (institution, supervisor, team credentials)
│   │   └── lib/             # Core Cryptographic & Persistence Libraries
│   │       ├── crypto/              # AES-256-GCM, ECIES key wrapping, SHA-256 hashing
│   │       ├── auth/                # Sign-In with Ethereum (SIWE, EIP-4361), JWT tokens
│   │       └── db/                  # SQLite zero-PHI database manager (sql.js / node:sqlite)
│   ├── tailwind.config.js   # Institutional color palette (#0F1F2E, #1F7A7A, #F6F4EF)
│   └── package.json
│
├── storage/                 # Off-Chain Zero-PHI Persistent Storage
│   ├── medichain.db         # SQLite relational database (metadata, keys, transfer states)
│   ├── ledger-network-c.json# Network C simulated block ledger state persistence
│   └── *.enc                # AES-256-GCM encrypted ciphertext payloads
│
├── scripts/                 # System Management & Operational Tooling
│   ├── dev-all.ts           # Boots all chains, gateways, and web application
│   ├── clean-start.ts       # Boots system with zero pre-seeded records (clean state)
│   ├── seed-demo.ts         # Optional seed script for instant demo data
│   ├── status.ts            # Terminal health check & block height telemetry reporter
│   └── reset-all.ts         # Wipes SQLite, storage files, and chains cleanly
│
├── tests/                   # End-to-End Automated Test Suite
│   └── e2e/
│       └── medichain-e2e.spec.ts    # 11-stage Playwright test suite (clean start to verify)
│
└── docs/                    # Architectural Specifications & Presentation Materials
    ├── CODE_TOUR.md         # (This file) Folder map and request trace
    ├── DEMO_SCRIPT.md       # 10-minute live presentation guide & examiner test checklist
    ├── TECH_STACK.md        # Technical specifications, languages, and design rationales
    ├── INTEROP_EXPLAINED.md # Cross-chain mechanics, sequence diagrams & trust model
    ├── VIVA_QA.md           # 40+ anticipated examination questions & detailed answers
    └── test-report.md       # Comprehensive automated test matrix (126 passing tests)
```

---

## 2. Architectural Layers

MediChain separates concerns into five strictly segregated architectural layers:

```
+-----------------------------------------------------------------------------------+
| 1. CLIENT / PRESENTATION LAYER                                                   |
|    Next.js 14 App Router, Web3Context (Ethers.js v6 / SIWE), Browser AES-256-GCM  |
+-----------------------------------------------------------------------------------+
                                         │  (JSON / HTTP REST)
                                         ▼
+-----------------------------------------------------------------------------------+
| 2. APPLICATION & ZERO-PHI STORAGE API                                            |
|    Next.js Server Routes (/api/*), SQLite dbManager, Local Disk (/storage/*.enc)  |
+-----------------------------------------------------------------------------------+
                                         │  (Signed Envelopes)
                                         ▼
+-----------------------------------------------------------------------------------+
| 3. FEDERATION & INTEROPERABILITY HUB                                              |
|    InteropHub Router, Anti-Replay Nonce Store, Exponential Backoff Message Queue  |
+-----------------------------------------------------------------------------------+
                                         │  (IChainAdapter Polymorphism)
                                         ▼
+-----------------------------------------------------------------------------------+
| 4. SOVEREIGN ADAPTER LAYER                                                        |
|    EvmAdapter (JSON-RPC) ─── FabricAdapter (@fabric-gateway) ─── SimulatedAdapter  |
+-----------------------------------------------------------------------------------+
                                         │  (Consensus & Merkle Commitments)
                                         ▼
+-----------------------------------------------------------------------------------+
| 5. SOVEREIGN DISTRIBUTED LEDGERS                                                  |
|    Network A (EVM 31337) ── Network B (EVM 31338) ── Network C (Port 9000)       |
+-----------------------------------------------------------------------------------+
```

---

## 3. End-to-End Request Trace: Clinical Record Upload & Anchor

Here is the exact step-by-step path of an attending physician uploading a diagnostic MRI scan and anchoring it across the system:

```
[Browser: Doctor Upload] 
         │ (1. Client-Side AES-256-GCM + Dual SHA-256 + Doctor ECDSA Sign)
         ▼
[Server: /api/records/upload] 
         │ (2. Enforce 25MB, Validate Hash Match, Write storage/*.enc, Index SQLite)
         ▼
[Chain: EvmAdapter.ts] 
         │ (3. Formats Transaction & Gas Estimation)
         ▼
[Smart Contract: RecordRegistry.sol] 
         │ (4. Commit Hashes, Verify Doctor Role, Emit RecordAnchored Event)
         ▼
[Relayer: InteropHub.ts] 
         │ (5. Ingest Inclusion Proof & Attest to Federation Registry)
         ▼
[Destination: Network C / FabricAdapter]
         │ (6. ForeignRecordRef Registered on Permissioned Ledger)
```

### Detailed Code Execution Flow:

#### Step 1: Client-Side Encryption & Dual Hashing
- **File:** [`web/src/app/doctor/upload/page.tsx`](file:///c:/Users/Baskar/Desktop/BE-Project/web/src/app/doctor/upload/page.tsx)
- The physician selects a file (e.g. `mri-lumbar.pdf`, 12 MB) and inputs clinical observations.
- The browser calls [`encryptAesGcm(plaintextBuffer)`](file:///c:/Users/Baskar/Desktop/BE-Project/web/src/lib/crypto/aes.ts):
  - Generates a random 256-bit symmetric key: `crypto.getRandomValues(new Uint8Array(32))`.
  - Encrypts the payload with a 96-bit Initialization Vector (`iv`).
  - Produces `ciphertext` and `authTag`.
- Computes dual hashes:
  - `recordHash = computeSha256(plaintext)`: Represents clinical truth.
  - `cipherHash = computeSha256(ciphertext)`: Represents storage commitment.
- Prompts doctor's wallet (MetaMask or in-browser keystore) to sign `recordHash` via ECDSA (`secp256k1`), yielding `issuerSignature`.

#### Step 2: Off-Chain Storage & Zero-PHI Ingestion
- **File:** [`web/src/app/api/records/upload/route.ts`](file:///c:/Users/Baskar/Desktop/BE-Project/web/src/app/api/records/upload/route.ts)
- Receives the request with JWT bearer authentication.
- Checks file size: Rejects payloads $> 25\text{ MB}$ with `413 Payload Too Large`.
- Re-verifies ciphertext integrity: Checks `computeSha256(ciphertext) === cipherHash` to prevent in-transit tampering.
- Writes encrypted payload to disk: `storage/{recordId}.enc` (pure ciphertext + IV, unreadable without key).
- Inserts metadata into SQLite ([`dbManager.insertRecord()`](file:///c:/Users/Baskar/Desktop/BE-Project/web/src/lib/db/index.ts)): Stores only hashes, record ID, patient pseudonym, and physician address.

#### Step 3: Sovereign Blockchain Anchoring
- **File:** [`interop/adapters/EvmAdapter.ts`](file:///c:/Users/Baskar/Desktop/BE-Project/interop/adapters/EvmAdapter.ts)
- Connects to Network A via JSON-RPC (`http://127.0.0.1:8545`).
- Invokes `RecordRegistry.sol::registerRecord()`:
  ```solidity
  function registerRecord(
      bytes32 recordId,
      bytes32 patientPseudonym,
      bytes32 recordHash,
      bytes32 cipherHash,
      bytes calldata issuerSignature,
      string calldata storageUri
  ) external onlyRole(DOCTOR_ROLE);
  ```
- Smart contract checks:
  1. Caller holds `DOCTOR_ROLE`.
  2. `recordId` does not already exist.
  3. `ecrecover` over `recordHash` matches caller address.
  4. Contract is not paused.
- The transaction is committed to Block #$N$, emitting `event RecordRegistered(...)`.

#### Step 4: Cross-Chain Inclusion Attestation
- **File:** [`interop/core/InteropHub.ts`](file:///c:/Users/Baskar/Desktop/BE-Project/interop/core/InteropHub.ts)
- When a cross-chain transfer is initiated to Network C (Metro Diagnostics Lab):
  - Gateway A packages a `RECORD_PACKAGE` envelope containing the block number, transaction hash, and state root inclusion proof.
  - Interop Hub validates sender signature, verifies active Federation membership, and checks against replay cache (`messageId` and `nonce`).
  - The Hub signs a cryptographic attestation statement.

#### Step 5: Heterogeneous Anchoring on Network C
- **File:** [`interop/adapters/FabricAdapter.ts`](file:///c:/Users/Baskar/Desktop/BE-Project/interop/adapters/FabricAdapter.ts) or [`SimulatedLedgerAdapter.ts`](file:///c:/Users/Baskar/Desktop/BE-Project/interop/adapters/SimulatedLedgerAdapter.ts)
- Invokes `RegisterForeignProof` on Network C:
  - Commits `recordId`, `sourceChain: "NETWORK_A"`, `recordHash`, `cipherHash`, and `attestationSignature`.
  - On simulated Network C, this commits an append-only JSON block with a SHA-256 hash pointer to the previous block.
  - On real Hyperledger Fabric, this invokes chaincode `RecordContract::registerRecord` via the fabric-gateway gRPC client.
- The record reference is now permanently discoverable and verifiable across both chains.
