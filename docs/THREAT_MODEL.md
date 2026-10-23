# MediChain Threat Model & Mitigation Matrix

This document provides the formal security threat model for **MediChain: Secure Inter-Hospital Medical Record Sharing**, analyzing threat vectors, risk levels, and technical mitigations across both on-chain smart contracts and off-chain cryptographic storage.

---

## 1. Threat Analysis & Mitigations

| Threat Vector | Attack Scenario | Risk Level | Architectural & Cryptographic Mitigation |
| :--- | :--- | :--- | :--- |
| **1. Replay Attacks** | An attacker captures a valid signed authorization, consent transaction, or login challenge and replays it later to gain unauthorized access or repeat actions. | **High** | • **SIWE Challenge Nonces**: Authentication uses cryptographically random, single-use, time-expiring server nonces. Once verified, the nonce is invalidated immediately.<br>• **EVM Chain ID & Nonce Separation**: All on-chain transactions include Hardhat/Ethereum account nonces and `chainId` (EIP-155), preventing cross-network or duplicate execution.<br>• **Record Unique Identifiers**: New records generate distinct IDs derived from `keccak256(patientIdHash, recordHash, cipherHash, block.timestamp, counter)`. |
| **2. Impersonation & Identity Spoofing** | A malicious party attempts to pose as an accredited hospital, certified doctor, or patient to issue or read records. | **Critical** | • **Role-Based Access Control (`AccessControl`)**: Only consortium administrators can onboard hospitals into `HospitalRegistry`.<br>• **Cryptographic Attestation (ECDSA)**: Records require an ECDSA signature over the plaintext `recordHash` matching the issuing doctor's or hospital's verified wallet address on-chain (`ECDSA.recover`).<br>• **Pseudonymous Patient Binding**: Patients claim ownership of their pseudonymous identity hash on-chain; only the private key holding that address can execute consent grants. |
| **3. Data Tampering & Integrity Loss** | A rogue storage provider or network intermediary modifies an off-chain record file (e.g. changing diagnosis or drug dosage). | **Critical** | • **Dual-Hash Cryptographic Anchor**: Every record commits two SHA-256 hashes on-chain: `recordHash` (plaintext) and `cipherHash` (ciphertext).<br>• **Public Mathematical Verification**: Any consumer recalculates `SHA256(downloadedPlaintext)` and `SHA256(storedCiphertext)` and compares against the immutable contract ledger (`verifyRecordIntegrity`). Even a single bit change results in immediate `TAMPERED` status.<br>• **Immutable Versioning**: Updates never overwrite existing rows; they create append-only linked versions (`previousRecordId`). |
| **4. Insider & Unauthorized Access** | Hospital staff or unauthorized institutions attempt to browse records of patients without explicit clinical consent. | **High** | • **Granular Consent Manager**: `ConsentManager.sol` validates active consent before any decryption key is shared. Consents are time-limited and scoped (`SpecificRecord` or `AllRecords`).<br>• **Immutable On-Chain Audit Logging**: Every view attempt, authorized or denied, emits an on-chain event in `AuditLog.sol`, creating a tamper-proof trail visible to the patient.<br>• **Emergency "Break-Glass" Controls**: In emergency trauma scenarios where a patient is unconscious, active doctors can break glass. This automatically flags an on-chain alert, binds a strict 24-hour limit, and requires clinical justification recorded permanently. |
| **5. Key Leakage & Compromise** | A hospital's private key or a doctor's workstation is compromised. | **High** | • **Per-Record Symmetric Keys**: Records are encrypted client-side using random individual AES-256-GCM symmetric keys, not a single master key.<br>• **ECIES Recipient Key Wrapping**: Symmetric record keys are encrypted (wrapped) individually with the public key of each authorized hospital using ECIES (Elliptic Curve Integrated Encryption Scheme). A leak at Hospital B does not expose Hospital A's keys or unshared records.<br>• **Emergency Circuit Breaker (`Pausable`)**: Network admin can pause `HospitalRegistry`, `RecordRegistry`, and `ConsentManager` instantly if compromise is suspected.<br>• **Key Rotation & Suspension**: Admin can suspend or revoke any hospital wallet with immediate effect. |

---

## 2. On-Chain vs. Off-Chain Privacy Guarantees

```
                      +------------------------------------------+
                      |         Patient Privacy Perimeter        |
                      +------------------------------------------+
                                           |
        [On-Chain: Public & Immutable]     |    [Off-Chain: Local Encrypted Storage]
       - Hospital Identity & Public Key   |   - Raw Medical History (PDF, JSON, Images)
       - Doctor Accreditations            |   - Patient Name, SSN, DOB, Address
       - Pseudonymous Patient Hash        |   - Encrypted Ciphertext (AES-256-GCM)
       - Plaintext SHA-256 Hash           |   - Per-recipient Wrapped Keys (ECIES)
       - Ciphertext SHA-256 Hash          |   - Ephemeral Nonce & IV Values
       - Issuer ECDSA Signature           |
       - Time-bounded Consent Grants      |
       - Verifiable Audit Logs            |
```

> **Zero PII on Blockchain**: No patient names, birth dates, phone numbers, medical conditions, prescription names, or plain diagnostic reports are ever written to the blockchain. All on-chain identities use salted cryptographic hashes (`keccak256(patientId + salt)`).
