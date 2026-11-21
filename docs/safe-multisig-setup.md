# Safe 2-of-3 Multisig Consortium Governance (Ethereum Sepolia)

## 1. Overview
In a multi-institutional sovereign healthcare network, no single hospital, administrator, or cloud provider may hold unilateral authority to admit, suspend, or expel members. 

The consortium trust directory is governed by **FederationRegistry.sol** deployed on **Ethereum Sepolia (Chain ID: 11155111)**, with administrative ownership delegated to a **Safe (Gnosis Safe) 2-of-3 multi-signature contract**.

---

## 2. Governance Committee Structure (2-of-3 Threshold)

The Safe multisig requires signatures from **at least 2 out of 3** distinct institutional stakeholders before any governance action is executed:

1. **Owner 1: Ministry of Health / Federal Health Authority**
   - Public Wallet: Institutional compliance and statutory regulator.
2. **Owner 2: Hospital Association Representative**
   - Public Wallet: Elected peer representative representing participating hospital networks.
3. **Owner 3: Independent Security & Privacy Auditor**
   - Public Wallet: Third-party auditor verifying HIPAA/DPDP cryptographic standards and gateway key health.

---

## 3. Institution Lifecycle On-Chain

```
  [Application Submitted]
            │
            ▼
       ┌─────────┐
       │ APPLIED │
       └────┬────┘
            │ Safe Multisig Review (2-of-3 Signatures)
            ▼
       ┌─────────┐
       │ ACTIVE  ├────────┐
       └────┬────┘        │
            │             │ Key Compromise /
   Key      │ Compliance  │ Malicious Intent
   Rotation │ Inquiry     │
            ▼             ▼
       ┌───────────┐ ┌─────────┐
       │ SUSPENDED │ │ REMOVED │
       └───────────┘ └─────────┘
```

- **`APPLIED`**: Institution submits its credential packet (accreditation document IPFS CID, medical license number hash, gateway public key, chain classification). Zero cross-chain messages are accepted or routed for this member.
- **`ACTIVE`**: Safe committee reviews legal accreditation documents, sets a baseline trust level (1 to 5), and calls `approveInstitution(institutionId, trustLevel)`. The institution's gateway is immediately authorized across all hospital relays.
- **`SUSPENDED`**: Temporary freeze during compliance review or while rotating compromised keys (`suspendInstitution`). All gateways instantly reject envelopes to/from this member.
- **`REMOVED`**: Permanent revocation (`removeInstitution`).

---

## 4. How to Deploy & Configure Safe Multisig on Sepolia (Free)

1. Navigate to the official Safe Web UI: **[https://app.safe.global/](https://app.safe.global/)**.
2. Connect MetaMask on **Ethereum Sepolia Testnet**.
3. Click **"Create Safe Account"**:
   - Network: **Sepolia**
   - Name: `MediChain Consortium Root Safe`
   - Signers: Add 3 Sepolia addresses (or 3 of your own testnet accounts for viva examination).
   - Threshold: **2 out of 3**.
4. Confirm creation (costs standard Sepolia testnet ETH from a free faucet).
5. Copy the generated Safe contract address (e.g. `0x123...abc`).
6. Set in your `.env`:
   ```bash
   SEPOLIA_SAFE_MULTISIG_ADDRESS="0xYourSepoliaSafeAddressHere"
   ```

---

## 5. Proposing & Executing Consortium Governance Actions

Use the built-in proposal helper:

### Approve an Institution Application:
```bash
npm run multisig:propose APPROVE 0xInstitutionIdHex 4
```

### Suspend an Institution:
```bash
npm run multisig:propose SUSPEND 0xInstitutionIdHex "Failed annual ISO 27001 audit"
```

### Rotate a Gateway Public Key:
```bash
npm run multisig:propose ROTATE_KEY 0xInstitutionIdHex 0x04NewSecp256k1KeyHex...
```

The CLI outputs the exact encoded calldata and target address, which can be pasted directly into the Safe Web UI Transaction Builder or submitted programmatically via the Safe Transaction Service API.
